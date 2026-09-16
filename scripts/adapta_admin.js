/* Terceira passada sobre o app.js: o painel do administrador falando com o banco.
   Sem isto, o admin continuaria gerando o código CT-AAAAMMDD-XXXXXX, que no modo
   nuvem não libera nada — quem responde sobre assinatura passou a ser o servidor.
   Roda DEPOIS de adapta_auth.js.
   Uso: node scripts/adapta_admin.js */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const ARQ = path.join(RAIZ, 'public', 'assets', 'js', 'app.js');
let s = fs.readFileSync(ARQ, 'utf8');
const feitas = [];
function troca(nome, de, para) {
  const n = s.split(de).length - 1;
  if (!n) throw new Error('âncora não encontrada: ' + nome);
  if (n > 1) throw new Error('âncora ambígua (' + n + 'x): ' + nome);
  s = s.replace(de, para); feitas.push(nome);
}

/* ---------- 1. liberar o Premium direto no banco ---------- */
troca('liberar assinatura no banco',
  'async function admGerar(){',
  [
    '/* Com banco configurado, liberar o Premium é uma linha na tabela `assinaturas`,',
    '   criada pela função admin_liberar(). Vale em qualquer aparelho do aluno, e ele',
    '   não consegue forjar — é o servidor que responde se a assinatura existe. */',
    'let admAlunos = null, admCarregando = false, admBusca = \'\';',
    '',
    'async function admLiberar(){',
    '  const e = String(admEmail||\'\').trim().toLowerCase();',
    '  if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(e)){ toast(\'Digite um e-mail válido.\'); return; }',
    '  const p = PLANOS.find(x=>x.id===admPlano);',
    '  try{',
    '    const {data, error} = await nuvem.sb.rpc(\'admin_liberar\', {',
    '      p_email: e, p_plano: p.id, p_meses: p.meses, p_obs: null',
    '    });',
    '    if(error) throw error;',
    '    admCodigo = {email:e, plano:p.nome.toLowerCase(), id:data, meses:p.meses};',
    '    admAlunos = null;',
    '    toast(\'Premium liberado para \' + e + \' ⭐\');',
    '    render();',
    '  }catch(err){',
    '    const m = String(err.message||\'\');',
    '    toast(/administrador/i.test(m) ? \'Sua conta não tem permissão de administrador.\'',
    '          : \'Não consegui liberar: \' + m);',
    '  }',
    '}',
    '',
    '/* A lista de alunos vem de admin_alunos(), que só responde para admin. */',
    'async function admCarregarAlunos(){',
    '  if(admCarregando) return;',
    '  admCarregando = true; render();',
    '  try{',
    '    const {data, error} = await nuvem.sb.rpc(\'admin_alunos\');',
    '    if(error) throw error;',
    '    admAlunos = data || [];',
    '  }catch(err){',
    '    admAlunos = [];',
    '    toast(\'Não consegui carregar os alunos: \' + err.message);',
    '  }finally{ admCarregando = false; render(); }',
    '}',
    '',
    'async function admGerar(){'
  ].join('\n'));

/* ---------- 2. a tela do admin muda conforme haja banco ou não ---------- */
troca('painel de assinaturas com banco',
  "function admAssinaturasHtml(){\n  return '<h2 class=\"sec-t\">⭐ Assinaturas do CT Premium</h2>'",
  [
    'function admAssinaturasHtml(){',
    '  return nuvemLigada() ? admAssinaturasNuvemHtml() : admAssinaturasLocalHtml();',
    '}',
    '',
    '/* ---- com banco: libera de verdade, e mostra quem está ativo ---- */',
    'function admAssinaturasNuvemHtml(){',
    '  const p = PLANOS.find(x=>x.id===admPlano);',
    '  let h = \'<h2 class="sec-t">⭐ Assinaturas do CT Premium</h2>\'',
    '    + \'<div class="card">\'',
    '    + \'<p style="color:var(--txt2);font-size:13px;margin-bottom:14px">Depois que o aluno pagar, libere aqui pelo e-mail. \'',
    '    + \'Vale na hora, em qualquer aparelho, e não precisa de código. Pode liberar antes mesmo de ele criar a conta — \'',
    '    + \'quando se cadastrar com esse e-mail, o acesso já estará lá.</p>\'',
    '    + \'<div class="fld"><label for="adm-email">E-mail do aluno</label>\'',
    '    + \'<input id="adm-email" type="email" value="\'+esc(admEmail)+\'" oninput="admEmail=this.value" placeholder="aluno@exemplo.com"></div>\'',
    '    + \'<div class="fld"><label>Plano assinado</label><div class="chip-row">\'',
    '    + PLANOS.map(x=>\'<button class="chip\'+(admPlano===x.id?\' on\':\'\')+\'" onclick="admPlano=\\\'\'+x.id+\'\\\';render()">\'+x.nome+\' · \'+x.meses+\' \'+(x.meses===1?\'mês\':\'meses\')+\'</button>\').join(\'\')',
    '    + \'</div></div>\'',
    '    + \'<button class="btn" onclick="admLiberar()">Liberar Premium por \'+p.meses+\' \'+(p.meses===1?\'mês\':\'meses\')+\'</button>\';',
    '',
    '  if(admCodigo && admCodigo.id)',
    '    h += \'<div class="plan-box ok" style="margin:16px 0 0"><b>✓ \'+esc(admCodigo.email)+\' está com o Premium ativo</b>\'',
    '      + \'<span class="plan-nota">Plano \'+esc(admCodigo.plano)+\', por \'+admCodigo.meses+\' \'+(admCodigo.meses===1?\'mês\':\'meses\')+\'. \'',
    '      + \'Avise o aluno para entrar (ou recarregar) e o acesso completo aparece.</span></div>\';',
    '',
    '  h += \'</div>\';',
    '  h += admListaAlunosHtml();',
    '  return h;',
    '}',
    '',
    'function admListaAlunosHtml(){',
    '  let h = \'<h2 class="sec-t">👥 Alunos</h2><div class="card">\';',
    '  if(admAlunos === null){',
    '    h += admCarregando',
    '      ? \'<p style="color:var(--txt2);font-size:13px">Carregando…</p>\'',
    '      : \'<p style="color:var(--txt2);font-size:13px;margin-bottom:12px">Quem criou conta, quem está com Premium e quanto cada um estudou.</p>\'',
    '        + \'<button class="btn-o btn-sm" onclick="admCarregarAlunos()">Ver alunos</button>\';',
    '    return h + \'</div>\';',
    '  }',
    '  if(!admAlunos.length) return h + \'<p style="color:var(--txt2);font-size:13px">Nenhum aluno cadastrado ainda.</p></div>\';',
    '',
    '  const q = admBusca.trim().toLowerCase();',
    '  const lista = q ? admAlunos.filter(a => (a.email+\' \'+(a.nome||\'\')).toLowerCase().includes(q)) : admAlunos;',
    '  const comPlano = admAlunos.filter(a=>a.plano).length;',
    '',
    '  h += \'<p style="color:var(--txt2);font-size:13px;margin-bottom:12px"><b style="color:var(--txt)">\'+admAlunos.length+\'</b> \'',
    '    + (admAlunos.length===1?\'aluno\':\'alunos\')+\' · <b style="color:var(--gold)">\'+comPlano+\'</b> com Premium ativo</p>\'',
    '    + \'<div class="fld"><input type="search" value="\'+esc(admBusca)+\'" oninput="admBusca=this.value;render()" placeholder="Buscar por nome ou e-mail"></div>\';',
    '',
    '  h += lista.slice(0,120).map(a=>{',
    '    const dias = a.fim ? Math.ceil((new Date(a.fim+\'T23:59:59\') - new Date())/864e5) : null;',
    '    const selo = a.plano',
    '      ? \'<span class="sr-tag free">\'+esc(a.plano)+\' · \'+dias+\'d</span>\'',
    '      : \'\';',
    '    const adm = a.admin ? \'<span class="sr-tag lock">admin</span>\' : \'\';',
    '    return \'<div class="lst-row"><div class="sr-name"><b>\'+esc(a.nome||a.email.split(\'@\')[0])+\'</b>\'+selo+adm',
    '      + \'<span>\'+esc(a.email)+\'</span></div>\'',
    '      + \'<div class="sr-nums"><span class="n-done"><b>\'+(a.cartas_estudadas||0)+\'</b> cartas</span>\'',
    '      + \'<span class="n-due"><b>\'+(a.revisoes||0)+\'</b> revisões</span></div>\'',
    '      + \'<button class="btn-o btn-sm" onclick="admEmail=\\\'\'+esc(a.email)+\'\\\';render()">Liberar</button></div>\';',
    '  }).join(\'\');',
    '  if(lista.length > 120) h += \'<p style="color:var(--txt3);font-size:12px;margin-top:10px">Mostrando 120 de \'+lista.length+\' — use a busca.</p>\';',
    '  h += \'<div class="lst-acoes" style="margin-top:12px"><button class="btn-o btn-sm" onclick="admAlunos=null;render()">Atualizar</button></div>\';',
    '  return h + \'</div>\';',
    '}',
    '',
    '/* ---- sem banco: o código continua sendo o único jeito ---- */',
    'function admAssinaturasLocalHtml(){',
    "  return '<h2 class=\"sec-t\">⭐ Assinaturas do CT Premium</h2>'"
  ].join('\n'));

/* ---------- 3. exportar cartas novas ----------
   A publicação de dentro do app dependia do runtime do claude.ai, que não
   existe no GitHub Pages. Aqui o conteúdo é versionado no Git: o admin baixa
   um arquivo e sobe ao repositório — assim toda mudança tem histórico. */
troca('exportar lê a fila em memória',
  "  const pend = store.get('fcct_pendentes') || [];\n  if(!pend.length) return toast('Não há cartas novas para exportar.');",
  "  if(!pend.length) return toast('Não há cartas na lista para exportar.');");

troca('publicar vira exportar quando não há runtime do claude.ai',
  "      + (pubBusy?'💾 Publicando…':'💾 Publicar '+pend.length+(pend.length>1?' cartões':' cartão')+' para os estudantes')+'</button>';",
  [
    "      + (pubBusy?'💾 Publicando…':'💾 Publicar '+pend.length+(pend.length>1?' cartões':' cartão')+' para os estudantes')+'</button>';",
    "    if(!(window.claude && window.claude.use))",
    "      h += '<button class=\"btn btn-block\" style=\"margin-top:10px;padding:15px\" onclick=\"exportarCartas()\">'",
    "        + '📄 Baixar arquivo para subir ao GitHub</button>'",
    "        + '<p style=\"color:var(--txt3);font-size:12.5px;margin-top:8px;line-height:1.5\">Neste site o conteúdo mora em arquivos versionados. '",
    "        + 'Baixe o arquivo e envie para mim, ou suba direto em <code>public/data/temas/</code> — ver docs/OPERACAO.md.</p>';",
  ].join('\n'));

/* ---------- 4. aviso honesto no rodapé do painel ---------- */
troca('rodapé honesto do painel',
  "  h += '<p style=\"color:var(--txt3);font-size:12.5px;margin-top:18px\">A IA e a publicação funcionam quando o app é aberto pelo claude.ai na conta do dono (CT). A publicação cria uma nova versão do app no mesmo link; os cartões novos aparecem como \"novas\" para os estudantes sem afetar o progresso deles.</p>';",
  [
    "  h += (window.claude && window.claude.use)",
    "    ? '<p style=\"color:var(--txt3);font-size:12.5px;margin-top:18px\">A publicação cria uma nova versão do app no mesmo link; os cartões novos aparecem como novas para os estudantes, sem afetar o progresso deles.</p>'",
    "    : '<p style=\"color:var(--txt3);font-size:12.5px;margin-top:18px;line-height:1.6\">Neste endereço a organização por IA não está disponível — ela depende do app aberto dentro do claude.ai. '",
    "      + 'Adicione as cartas à mão aqui, baixe o arquivo e suba ao GitHub: o conteúdo passa a ter histórico de versões e dá para voltar atrás.</p>';",
  ].join('\n'));

/* ---------- 5. esconder o organizador por IA sem o runtime ---------- */
troca('IA some quando não há runtime',
  "  h += '<div class=\"card\" style=\"margin-bottom:16px\"><h3 style=\"font-size:16px;margin-bottom:8px\">🤖 Adicionar com IA</h3>'",
  "  if(window.claude && window.claude.use) h += '<div class=\"card\" style=\"margin-bottom:16px\"><h3 style=\"font-size:16px;margin-bottom:8px\">🤖 Adicionar com IA</h3>'");

troca('botão de exportar cartas',
  "    + '<button class=\"btn\" onclick=\"admGerar()\">Gerar código de acesso</button>'",
  [
    "    + '<button class=\"btn\" onclick=\"admGerar()\">Gerar código de acesso</button>'",
    "    + '<div class=\"lst-acoes\" style=\"margin-top:14px\"><button class=\"btn-o btn-sm\" onclick=\"exportarCartas()\">Baixar cartas novas (JSON)</button></div>'"
  ].join('\n'));

fs.writeFileSync(ARQ, s);
console.log(feitas.length + ' adaptações do painel do admin aplicadas:');
feitas.forEach(t => console.log('  · ' + t));
