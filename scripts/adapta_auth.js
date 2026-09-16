/* Segunda passada sobre o app.js: login pela nuvem, avisos de carregamento,
   selo de sincronia e exportação do conteúdo pelo painel do admin.
   Roda DEPOIS de adapta_logic.js. Falha se uma âncora sumir.
   Uso: node scripts/adapta_auth.js */
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

/* ---------- 1. o formulário de conta fala com o Supabase ---------- */
troca('formulário de conta',
  "  const users = store.get(K_USERS) || {};\n  $('auth-btn').disabled=true; $('auth-btn').textContent='Aguarde…';\n  try{\n    if(authMode==='signup'){",
  [
    "  $('auth-btn').disabled=true; $('auth-btn').textContent='Aguarde…';",
    '',
    '  /* Com banco configurado, a conta é do servidor: o mesmo e-mail e senha',
    '     entram em qualquer aparelho, e o progresso vem junto. */',
    '  if(nuvemLigada()){',
    '    try{',
    "      if(authMode==='signup'){",
    "        if(!nome || nome.length<2){ authErr('Digite seu nome completo.'); return; }",
    '        const r = await nuvemCadastrar(nome, email, senha);',
    '        if(r.confirmar){',
    "          $('auth-msg').innerHTML = '<div class=\"auth-ok\">Conta criada. Enviamos um e-mail de confirmação para <b>'",
    "            + esc(email) + '</b> — confirme e depois volte para entrar.</div>';",
    '          return;',
    '        }',
    '      } else {',
    '        await nuvemEntrar(email, senha);',
    '      }',
    '      const u = await nuvemSessao();',
    "      if(!u){ authErr('Não consegui abrir a sessão. Tente de novo.'); return; }",
    '      await entrarComNuvem(u);',
    "      if(authMode==='signup') toast('Conta criada! Bons estudos 🎓');",
    '      return;',
    '    }catch(err){ authErr(err.message); return; }',
    "    finally{ $('auth-btn').disabled=false; $('auth-btn').textContent = authMode==='login' ? 'Entrar' : 'Criar minha conta'; }",
    '  }',
    '',
    '  /* modo local — sem banco configurado, tudo fica neste navegador */',
    '  const users = store.get(K_USERS) || {};',
    '  try{',
    "    if(authMode==='signup'){"
  ].join('\n'));

/* ---------- 2. sair encerra a sessão do servidor também ---------- */
/* logout já era async no logic.js — não reescrever a assinatura, só o corpo */
troca('logout na nuvem',
  'async function logout(){',
  'async function logout(){\n  if(nuvemLigada()){ await nuvemEnviarProgresso(); await nuvemSair(); }');

/* ---------- 3. esqueci minha senha (só existe com banco) ---------- */
troca('link de recuperar senha',
  "function authErr(m){ $('auth-msg').innerHTML='<div class=\"auth-err\">'+esc(m)+'</div>'; }",
  [
    "function authErr(m){ $('auth-msg').innerHTML='<div class=\"auth-err\">'+esc(m)+'</div>'; }",
    '',
    '/* Sem banco não há como recuperar senha: a conta existe só neste navegador. */',
    'async function esqueciSenha(){',
    "  const email = $('in-email').value.trim().toLowerCase();",
    "  if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) return authErr('Digite seu e-mail no campo acima e clique de novo.');",
    '  try{',
    '    await nuvemRecuperarSenha(email);',
    "    $('auth-msg').innerHTML = '<div class=\"auth-ok\">Enviamos um link de nova senha para <b>'+esc(email)+'</b>.</div>';",
    '  }catch(e){ authErr(e.message); }',
    '}'
  ].join('\n'));

/* ---------- 4. aviso de carregamento do conteúdo ---------- */
troca('aviso de carregamento',
  'function toast(msg',
  [
    '/* Enquanto o tema é baixado (uns 400 KB), a tela precisa dizer que está vindo.',
    '   Só aparece depois de 250 ms: numa conexão boa o aluno nem vê. */',
    'let _carrTimer = null;',
    'function mostrarCarregando(n){',
    '  clearTimeout(_carrTimer);',
    '  _carrTimer = setTimeout(()=>{',
    "    let el = document.getElementById('carregando');",
    '    if(!el){',
    "      el = document.createElement('div');",
    "      el.id = 'carregando'; el.className = 'carregando';",
    "      el.innerHTML = '<div class=\"carr-cx\"><div class=\"carr-giro\"></div><b>Baixando os flashcards…</b>'",
    "        + '<span>' + (n>1 ? n + ' temas' : 'primeira vez neste tema — depois abre na hora') + '</span></div>';",
    '      document.body.appendChild(el);',
    '    }',
    '  }, 250);',
    '}',
    'function esconderCarregando(){',
    '  clearTimeout(_carrTimer);',
    "  const el = document.getElementById('carregando');",
    '  if(el) el.remove();',
    '}',
    '',
    'function toast(msg'
  ].join('\n'));

/* ---------- 5. exportar as cartas criadas pelo admin ---------- */
troca('exportação para o GitHub',
  'function isAdmin(){',
  [
    '/* No repositório o conteúdo é versionado no Git. O que o admin cria aqui sai',
    '   como arquivo para subir ao GitHub — assim toda mudança de conteúdo tem',
    '   histórico e dá para voltar atrás. */',
    'function exportarCartas(){',
    "  const pend = store.get('fcct_pendentes') || [];",
    "  if(!pend.length) return toast('Não há cartas novas para exportar.');",
    '  const porSub = {};',
    "  for(const c of pend){ (porSub[c.sub] = porSub[c.sub] || []).push({f:c.f, v:c.v, ...(c.ex?{ex:c.ex}:{})}); }",
    '  const txt = JSON.stringify(porSub, null, 1);',
    "  const a = document.createElement('a');",
    "  a.href = URL.createObjectURL(new Blob([txt], {type:'application/json'}));",
    "  a.download = 'cartas-novas-' + todayKey() + '.json';",
    '  a.click();',
    '  setTimeout(()=>URL.revokeObjectURL(a.href), 4000);',
    "  toast('Arquivo baixado — envie para subir ao GitHub 📄');",
    '}',
    '',
    'function isAdmin(){'
  ].join('\n'));

/* ---------- 6. selo de sincronia no perfil ---------- */
troca('selo de sincronia',
  'function vPerfil(){',
  [
    '/* Uma linha honesta sobre onde os dados do aluno estão. */',
    'function seloNuvemHtml(){',
    '  if(!nuvemLigada())',
    '    return \'<div class="nuv nuv-local"><b>💾 Salvo neste aparelho</b><span>Seu progresso fica guardado neste navegador. \'',
    "      + 'Se trocar de celular ou limpar os dados do site, ele não vem junto.</span></div>';",
    "  if(nuvem.estado === 'erro')",
    '    return \'<div class="nuv nuv-erro"><b>⚠️ Sincronia com problema</b><span>Você pode estudar normalmente — \'',
    "      + 'assim que a conexão voltar, tudo sobe sozinho.</span></div>';",
    '  return \'<div class="nuv nuv-ok"><b>☁️ Sincronizado na sua conta</b><span>Entre com \'',
    "    + esc(user.email) + ' em qualquer aparelho e seu progresso estará lá.</span></div>';",
    '}',
    'function atualizarSelosNuvem(){',
    "  if(typeof curView !== 'undefined' && curView === 'perfil' && typeof render === 'function') render();",
    '}',
    '',
    'function vPerfil(){'
  ].join('\n'));

/* ---------- 7. o selo aparece no topo do Perfil ---------- */
troca('selo no Perfil',
  "  return '<h1 class=\"pg-t\">Perfil</h1><p class=\"pg-s\">Sua conta no Flashcards CT.</p>'",
  "  return '<h1 class=\"pg-t\">Perfil</h1><p class=\"pg-s\">Sua conta no Flashcards CT.</p>'\n    + seloNuvemHtml()");

/* ---------- 8. "esqueci minha senha" só com banco, e só na aba Entrar ---------- */
troca('mostrar o link de senha',
  "  $('auth-msg').innerHTML='';\n}",
  [
    "  $('auth-msg').innerHTML='';",
    "  const rec = $('auth-rec');",
    "  if(rec) rec.hidden = !(mode==='login' && typeof nuvemLigada==='function' && nuvemLigada());",
    '}'
  ].join('\n'));

fs.writeFileSync(ARQ, s);
console.log(feitas.length + ' adaptações de conta/nuvem aplicadas:');
feitas.forEach(t => console.log('  · ' + t));
