/* Transforma o logic.js do app de arquivo único no app.js do repositório.
   Cada troca abaixo tem um porquê comentado. O script FALHA se uma âncora não
   for encontrada — assim uma mudança no logic.js nunca passa despercebida.
   Uso: node scripts/adapta_logic.js [caminho/para/logic.js] */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const FONTE = process.argv[2] || path.resolve(RAIZ, '..', 'logic.js');
let s = fs.readFileSync(FONTE, 'utf8');
const trocas = [];

function troca(nome, de, para, opt) {
  const n = s.split(de).length - 1;
  if (!n) { if (opt) return; throw new Error('âncora não encontrada: ' + nome); }
  if (n > 1 && !opt) throw new Error('âncora ambígua (' + n + 'x): ' + nome);
  s = s.replace(de, para);
  trocas.push(nome);
}

/* ------------------------------------------------------------------
   1. DECKS não vem mais embutido: quem preenche é o conteudo.js
   ------------------------------------------------------------------ */
troca('DECKS externo',
  "const DECKS = JSON.parse(document.getElementById('decks-data').textContent);",
  "/* DECKS é preenchido por conteudo.js a partir de data/index.json */");

/* ------------------------------------------------------------------
   2. (Removido) A partir da FSRS-5, gradeCard() já grava cs.ts=now
      nativamente em logic.js — deixou de ser um transform de build e
      passou a ser parte do próprio algoritmo (ele precisa desse
      carimbo para calcular quanto tempo passou desde a última
      revisão). A mistura de progresso entre aparelhos em nuvem.js
      continua funcionando sem nenhuma mudança, porque ela já mesclava
      o objeto cs inteiro por card, e cs.ts é só mais um campo dele.
   ------------------------------------------------------------------ */

/* ------------------------------------------------------------------
   3. Toda gravação de progresso agenda o envio para a nuvem.
   ------------------------------------------------------------------ */
troca('saveProg envia para a nuvem',
  'function saveProg(){ store.set(kProg(user.email), prog); }',
  'function saveProg(){\n  store.set(kProg(user.email), prog);\n  if(typeof nuvemAgendarEnvio === \'function\') nuvemAgendarEnvio();\n}');

/* ------------------------------------------------------------------
   4. Estudar exige o texto das cartas: baixa o tema antes de montar
      a sessão. startStudy vira assíncrona — os onclick continuam
      funcionando porque ninguém usa o retorno dela.
   ------------------------------------------------------------------ */
troca('startStudy carrega o conteúdo',
  'function startStudy(target){',
  'async function startStudy(target){\n  if(typeof garantirConteudo === \'function\' && !(await garantirConteudo(target))) return;');

/* ------------------------------------------------------------------
   5. O Premium passa a ser resposta do servidor. O código local
      continua valendo como plano B (quando não há banco configurado).
   ------------------------------------------------------------------ */
troca('assinatura vem do servidor',
  'function assinaturaValida(){ const d = diasRestantesAssinatura(); return d!==null && d>0; }',
  [
    '/* Com banco configurado, quem diz se o aluno é Premium é o servidor — o',
    '   código CT-AAAAMMDD-XXXXXX vira apenas o plano B do modo local. */',
    'function assinaturaValida(){',
    '  if(typeof nuvemLigada === \'function\' && nuvemLigada())',
    '    return !!(nuvem.assinatura && nuvem.assinatura.dias_restantes > 0);',
    '  const d = diasRestantesAssinatura(); return d!==null && d>0;',
    '}'
  ].join('\n'));

troca('dias restantes vêm do servidor',
  'function diasRestantesAssinatura(){\n  const a = assinatura(); if(!a || !a.ate) return null;',
  'function diasRestantesAssinatura(){\n  if(typeof nuvemLigada === \'function\' && nuvemLigada())\n    return nuvem.assinatura ? nuvem.assinatura.dias_restantes : null;\n  const a = assinatura(); if(!a || !a.ate) return null;');

/* ------------------------------------------------------------------
   6. Admin e trilha da residência saem do perfil no banco.
   ------------------------------------------------------------------ */
troca('admin vem do perfil',
  "function isAdmin(){ return store.get(K_ADMIN)==='1'; }",
  [
    'function isAdmin(){',
    '  if(typeof nuvemLigada === \'function\' && nuvemLigada())',
    '    return !!(nuvem.perfil && nuvem.perfil.admin);',
    "  return store.get(K_ADMIN)==='1';",
    '}'
  ].join('\n'));

troca('residência vem do perfil',
  "function revUnlocked(){ return store.get(K_REV)==='1' || store.get(K_ADMIN)==='1' || assinaturaTrilha()==='residencia'; }",
  [
    'function revUnlocked(){',
    '  if(typeof nuvemLigada === \'function\' && nuvemLigada())',
    '    return !!(nuvem.perfil && (nuvem.perfil.residencia || nuvem.perfil.admin)) || assinaturaTrilha()===\'residencia\';',
    "  return store.get(K_REV)==='1' || store.get(K_ADMIN)==='1' || assinaturaTrilha()==='residencia';",
    '}'
  ].join('\n'));

/* ------------------------------------------------------------------
   7. O gênero dos troféus acompanha o aluno entre aparelhos.
   ------------------------------------------------------------------ */
troca('gênero sincroniza',
  'function setGenero(g){',
  'function setGenero(g){\n  if(typeof nuvemSalvarPerfil === \'function\' && nuvemLigada()) nuvemSalvarPerfil({genero:g});');

/* ------------------------------------------------------------------
   8. Os links de checkout saem do config.js, para o CT trocar sem
      mexer no código do app.
   ------------------------------------------------------------------ */
troca('checkout do config',
  /const CHECKOUT = \{[\s\S]*?\};/,
  "const CHECKOUT = (window.CT_CONFIG && window.CT_CONFIG.CHECKOUT) || {estagio:{mensal:'',semestral:'',anual:''}, residencia:{mensal:'',semestral:'',anual:''}};");

/* ------------------------------------------------------------------
   9. O auto-publish do artifact não existe no repositório: o conteúdo
      mora em arquivos versionados. Vira exportação para o GitHub.
   ------------------------------------------------------------------ */
if (s.includes('function buildSelfHtml')) {
  s = s.replace(/function buildSelfHtml\(\)\{[\s\S]*?\n\}\n/,
    '/* No repositório o conteúdo mora em data/temas/*.json, versionado no Git.\n' +
    '   O painel do admin exporta um arquivo para o CT subir ao GitHub — ver exportarCartas(). */\n');
  trocas.push('auto-publish removido');
}

/* ------------------------------------------------------------------
   10. O boot passa a ser assíncrono: índice → sessão → nuvem → app.
   ------------------------------------------------------------------ */
troca('boot assíncrono',
  /\/\* ================= BOOT ================= \*\/[\s\S]*$/,
  [
    '/* ================= BOOT ================= */',
    '/* A ordem importa: sem o índice não há DECKS, e sem DECKS nenhuma tela desenha. */',
    'async function boot(){',
    '  try{',
    '    await carregarIndice();',
    '  }catch(e){',
    '    document.body.innerHTML = \'<div style="max-width:520px;margin:18vh auto;padding:0 24px;font-family:system-ui;color:#fff;text-align:center">\'',
    '      + \'<h1 style="font-size:22px;margin-bottom:10px">Não consegui carregar os flashcards</h1>\'',
    '      + \'<p style="opacity:.7;line-height:1.6">Verifique sua conexão e recarregue a página. Se continuar, avise o CT.</p>\'',
    '      + \'<button onclick="location.reload()" style="margin-top:18px;background:#3d85d8;color:#fff;border:0;border-radius:8px;padding:12px 24px;font-size:14px;font-weight:600;cursor:pointer">Tentar de novo</button></div>\';',
    '    console.error(e); return;',
    '  }',
    '',
    '  initLanding();',
    '  await iniciarNuvem();',
    '',
    '  if(nuvemLigada()){',
    '    const u = await nuvemSessao();',
    '    if(u){ await entrarComNuvem(u); return; }',
    '    showPage(\'landing\');',
    '    return;',
    '  }',
    '',
    '  /* modo local — igual ao app de arquivo único */',
    '  const sess = store.get(K_SESS);',
    '  if(sess){',
    '    const users = store.get(K_USERS)||{};',
    '    if(users[sess]){ enterApp(users[sess]); return; }',
    '  }',
    '  showPage(\'landing\');',
    '}',
    '',
    '/* Entra no app com uma sessão do Supabase: perfil, assinatura e a mistura',
    '   do progresso do servidor com o que já havia neste aparelho. */',
    'async function entrarComNuvem(u){',
    '  await nuvemPerfil();',
    '  await nuvemAssinatura();',
    '  const nome = (nuvem.perfil && nuvem.perfil.nome) || u.email.split(\'@\')[0];',
    '  const conta = {nome, email: u.email};',
    '',
    '  const local = store.get(kProg(u.email));',
    '  let remoto = null;',
    '  try{ remoto = await nuvemBaixarProgresso(); }catch(e){ console.warn(e); }',
    '  if(remoto){',
    '    const juntos = misturarProgresso(local, remoto);',
    '    store.set(kProg(u.email), juntos);',
    '  }',
    '',
    '  enterApp(conta);',
    '  if(nuvem.perfil && nuvem.perfil.genero && !prog.genero){ prog.genero = nuvem.perfil.genero; saveProg(); }',
    '  /* o que o servidor ainda não tem (estudo offline) sobe agora */',
    '  nuvemAgendarEnvio();',
    '  nuvem.estado = \'ok\';',
    '  /* adianta o tema de maior peso do plano, para a 1ª sessão abrir na hora */',
    '  const s0 = (typeof subsPriorizados === \'function\' ? subsPriorizados() : [])[0];',
    '  if(s0 && s0.t) preCarregar([s0.t.id]);',
    '}',
    '',
    'boot();',
    ''
  ].join('\n'));

fs.mkdirSync(path.join(RAIZ, 'public', 'assets', 'js'), { recursive: true });
const saida = path.join(RAIZ, 'public', 'assets', 'js', 'app.js');
fs.writeFileSync(saida, s);

console.log(trocas.length + ' adaptações aplicadas:');
trocas.forEach(t => console.log('  · ' + t));
console.log('\n→ ' + (s.length / 1024).toFixed(0) + ' KB em public/assets/js/app.js');
