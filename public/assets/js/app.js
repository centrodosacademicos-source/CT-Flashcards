/* ================= FONTE CANÔNICA (para o auto-publish do admin) ===== */
const APP_CODE = (document.currentScript && document.currentScript.textContent) || '';
/*__SHELL__*/
/* DECKS é preenchido por conteudo.js a partir de data/index.json */

/* ================= ARMAZENAMENTO ================= */
const MEM = {};
const store = {
  get(k){ try{ const v = localStorage.getItem(k); return v===null ? (k in MEM ? MEM[k] : null) : JSON.parse(v); }catch(e){ return k in MEM ? MEM[k] : null; } },
  set(k,v){ MEM[k]=v; try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },
  del(k){ delete MEM[k]; try{ localStorage.removeItem(k); }catch(e){} }
};
const K_USERS='fcct_users', K_SESS='fcct_session', K_ADMIN='fcct_admin', K_REV='fcct_revisao';
const ADMIN_HASH='5489193c50256d4cd97ccbb8b1306c17099e8d2b683aef673e6e0235d17bc566';
/* senha da trilha CT Residência (a 2ª é o código antigo, mantido válido) */
const RES_HASHES=['dbc8d0efaf567d356e587927842481fd8364d15fecb26ae8e9c47a77702632a2',
                  'ca3c166d8ef415fe2f50949f0b6e1c60d930f01634178c3afb7154bc1a1ae80d'];
const kProg = email => 'fcct_prog_'+email;

/* ================= HELPERS ================= */
const $ = id => document.getElementById(id);
/* Trilhas: CT Estágio (aberta) e CT Residência (restrita por senha) */
const TRILHAS = {
  estagio:    {id:'estagio',    ic:'🎓', nome:'CT Estágio',    curto:'Estágio',
               desc:'Clínica médica e SUS — os temas que caem nas provas de estágio acadêmico.'},
  residencia: {id:'residencia', ic:'🏥', nome:'CT Residência', curto:'Residência',
               desc:'Acesso completo: todos os flashcards do app, incluindo Cirurgia, GO, Pediatria e Preventiva.'}
};
const trilhaDe = t => t.restrito ? 'residencia' : 'estagio';
/* A trilha CT Residência abre pela senha do CT ou por um código Premium da
   trilha Residência especificamente — o código da trilha Estágio não abre
   este conteúdo (veja assinaturaTrilha, mais abaixo). */
function revUnlocked(){
  if(typeof nuvemLigada === 'function' && nuvemLigada())
    return !!(nuvem.perfil && (nuvem.perfil.residencia || nuvem.perfil.admin)) || assinaturaTrilha()==='residencia';
  return store.get(K_REV)==='1' || store.get(K_ADMIN)==='1' || assinaturaTrilha()==='residencia';
}
function decksDaTrilha(tr){ return tr==='residencia'
  ? DECKS.filter(t=>t.restrito).concat(DECKS.filter(t=>!t.restrito))
  : DECKS.filter(t=>!t.restrito); }
function visibleDecks(){ return DECKS.filter(t => !t.restrito || revUnlocked()); }
function hasRestrito(){ return DECKS.some(t => t.restrito); }
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const todayKey = (d=new Date()) => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const totalCards = () => visibleDecks().reduce((a,t)=>a+t.subs.reduce((b,s)=>b+s.cards.length,0),0) + totalMeus();
const totalSubs = () => visibleDecks().reduce((a,t)=>a+t.subs.length,0);
function findSub(subId){ for(const t of DECKS) for(const s of t.subs) if(s.id===subId) return {t,s}; return null; }
function cardsOfSub(subId){ const r=findSub(subId); return r ? r.s.cards.map(c=>({...c, cid:c.id, deck:r.t, sub:r.s})) : []; }
function cardsOfTheme(tid){ const t=DECKS.find(x=>x.id===tid); return t ? t.subs.flatMap(s=>s.cards.map(c=>({...c, cid:c.id, deck:t, sub:s}))) : []; }
function allCards(){ return visibleDecks().flatMap(t=>cardsOfTheme(t.id)).concat(meusCards()); }
async function hash(txt){
  try{
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }catch(e){
    let h=0; for(let i=0;i<txt.length;i++){ h=((h<<5)-h+txt.charCodeAt(i))|0; } return 'x'+(h>>>0).toString(16);
  }
}
/* ===== Janela modal própria (prompt/confirm nativos são bloqueados no iframe) ===== */
let mdlEsc = null;
function closeModal(){
  const r = $('mdl-root'); if(r) r.innerHTML='';
  if(mdlEsc){ document.removeEventListener('keydown', mdlEsc); mdlEsc=null; }
}
function ask(o){
  return new Promise(res=>{
    const root = $('mdl-root');
    if(!root){ res((o.senha||o.campo) ? null : true); return; }   // fallback: nunca trava o app
    root.innerHTML =
      '<div class="mdl-bg" id="mdl-bg"><div class="mdl" role="dialog" aria-modal="true" aria-label="'+esc(o.title)+'">'
      + '<h3>'+esc(o.title)+'</h3>'
      + (o.texto ? '<p>'+o.texto+'</p>' : '')
      + (o.senha||o.campo ? '<input id="mdl-in" type="'+(o.campo==='texto'?'text':'password')+'" autocomplete="off" spellcheck="false" maxlength="'+(o.max||60)+'" placeholder="'+esc(o.ph||'Digite aqui')+'" value="'+esc(o.valor||'')+'">' : '')
      + '<div class="mdl-row">'
      + '<button class="btn-o btn-sm" id="mdl-no">'+esc(o.cancelLb||'Cancelar')+'</button>'
      + '<button class="btn btn-sm" id="mdl-yes">'+esc(o.okLb||'Confirmar')+'</button>'
      + '</div></div></div>';
    const fim = v => { closeModal(); res(v); };
    $('mdl-no').onclick = () => fim(null);
    $('mdl-yes').onclick = () => fim((o.senha||o.campo) ? $('mdl-in').value.trim() : true);
    $('mdl-bg').onclick = e => { if(e.target===$('mdl-bg')) fim(null); };
    mdlEsc = e => {
      if(e.key==='Escape') fim(null);
      else if(e.key==='Enter'){ e.preventDefault(); const b=$('mdl-yes'); if(b) b.click(); }
    };
    document.addEventListener('keydown', mdlEsc);
    if(o.senha||o.campo){ const i=$('mdl-in'); if(i) setTimeout(()=>{i.focus(); i.select&&i.select();},40); }
  });
}
/* Enquanto o tema é baixado (uns 400 KB), a tela precisa dizer que está vindo.
   Só aparece depois de 250 ms: numa conexão boa o aluno nem vê. */
let _carrTimer = null;
function mostrarCarregando(n){
  clearTimeout(_carrTimer);
  _carrTimer = setTimeout(()=>{
    let el = document.getElementById('carregando');
    if(!el){
      el = document.createElement('div');
      el.id = 'carregando'; el.className = 'carregando';
      el.innerHTML = '<div class="carr-cx"><div class="carr-giro"></div><b>Baixando os flashcards…</b>'
        + '<span>' + (n>1 ? n + ' temas' : 'primeira vez neste tema — depois abre na hora') + '</span></div>';
      document.body.appendChild(el);
    }
  }, 250);
}
function esconderCarregando(){
  clearTimeout(_carrTimer);
  const el = document.getElementById('carregando');
  if(el) el.remove();
}

function toast(msg){
  const t=document.createElement('div'); t.className='toast'; t.textContent=msg;
  document.body.appendChild(t); setTimeout(()=>t.remove(),2600);
}

/* ================= MEUS FLASHCARDS (baralhos do usuário) ================= */
const MAX_BARALHOS = 30;
const DECK_MEUS = {id:'meus', nome:'Meus flashcards', ic:'✏️'};
/* as cartas do usuário guardam texto puro; as do app já vêm em HTML */
const nl2br = s => esc(s||'').replace(/\n/g,'<br>');
const cFront = c => c.own ? nl2br(c.f) : c.f;
const cBack  = c => c.own ? nl2br(c.v) : c.v;
const cDica  = c => c.own ? nl2br(c.ex) : c.ex;
function meusBaralhos(){ return (prog && Array.isArray(prog.meus)) ? prog.meus : []; }
function baralhoById(id){ return meusBaralhos().find(b=>b.id===id); }
function embrulha(b, c){ return {...c, own:true, cid:c.id, deck:DECK_MEUS, sub:{id:b.id, nome:b.nome}}; }
function cardsDoBaralho(id){ const b=baralhoById(id); return b ? b.cards.map(c=>embrulha(b,c)) : []; }
function meusCards(){ return meusBaralhos().flatMap(b=>b.cards.map(c=>embrulha(b,c))); }
function totalMeus(){ return meusBaralhos().reduce((a,b)=>a+b.cards.length,0); }

async function criarBaralho(){
  if(meusBaralhos().length>=MAX_BARALHOS){ toast('Você já tem '+MAX_BARALHOS+' baralhos.'); return; }
  const nome = await ask({title:'Criar baralho', texto:'Dê um nome ao baralho — por exemplo "Farmaco da prova" ou "Doses que eu esqueço".', campo:'texto', ph:'Nome do baralho', max:40, okLb:'Criar baralho'});
  if(nome===null) return;
  const n = String(nome).trim().slice(0,40);
  if(!n){ toast('O baralho precisa de um nome.'); return; }
  const b = {id:'b'+Date.now().toString(36), nome:n, criado:Date.now(), cards:[]};
  prog.meus.push(b); saveProg(); toast('Baralho "'+n+'" criado ✓'); render();
  editorCarta(b.id, null);
}
async function renomearBaralho(bid){
  const b = baralhoById(bid); if(!b) return;
  const nome = await ask({title:'Renomear baralho', campo:'texto', ph:'Nome do baralho', max:40, valor:b.nome, okLb:'Salvar'});
  if(nome===null) return;
  const n = String(nome).trim().slice(0,40);
  if(!n){ toast('O baralho precisa de um nome.'); return; }
  b.nome = n; saveProg(); toast('Baralho renomeado.'); render();
}
async function excluirBaralho(bid){
  const b = baralhoById(bid); if(!b) return;
  if(!(await ask({title:'Excluir "'+b.nome+'"?', texto:'Os '+b.cards.length+' flashcard'+(b.cards.length===1?'':'s')+' deste baralho serão apagados. Isso não pode ser desfeito.', okLb:'Excluir baralho'}))) return;
  prog.meus = prog.meus.filter(x=>x.id!==bid);
  saveProg(); toast('Baralho excluído.'); render();
}
function editorCarta(bid, cid){
  const b = baralhoById(bid); if(!b) return;
  const c = cid ? b.cards.find(x=>x.id===cid) : null;
  showModal('<h3>'+(c?'Editar flashcard':'Novo flashcard')+'</h3>'
    + '<p>Baralho: <b>'+esc(b.nome)+'</b></p>'
    + '<label class="ed-lb" for="ed-f">Frente — a pergunta</label>'
    + '<textarea id="ed-f" class="ed-ta" maxlength="600" placeholder="O que você quer lembrar?">'+esc(c?c.f:'')+'</textarea>'
    + '<label class="ed-lb" for="ed-v">Verso — a resposta</label>'
    + '<textarea id="ed-v" class="ed-ta ed-alta" maxlength="1400" placeholder="A resposta, do jeito que você quer revisar.">'+esc(c?c.v:'')+'</textarea>'
    + '<label class="ed-lb" for="ed-x">Dica ou pegadinha <span>(opcional)</span></label>'
    + '<input id="ed-x" class="ed-in" maxlength="200" placeholder="Um macete, uma armadilha de prova…" value="'+esc(c&&c.ex?c.ex:'')+'">'
    + '<div class="mdl-row"><button class="btn-o btn-sm" id="mdl-no" onclick="closeModal()">Cancelar</button>'
    + '<button class="btn btn-sm" onclick="salvarCarta(\''+bid+'\','+(cid?"'"+cid+"'":'null')+')">Salvar flashcard</button></div>');
  setTimeout(()=>{ const i=$('ed-f'); if(i) i.focus(); }, 40);
}
function salvarCarta(bid, cid){
  const b = baralhoById(bid); if(!b) return;
  const f = ($('ed-f')||{}).value||'', v = ($('ed-v')||{}).value||'', x = ($('ed-x')||{}).value||'';
  if(!f.trim() || !v.trim()){ toast('Preencha a frente e o verso.'); return; }
  if(cid){
    const c = b.cards.find(y=>y.id===cid); if(!c) return;
    c.f=f.trim(); c.v=v.trim(); if(x.trim()) c.ex=x.trim(); else delete c.ex;
    toast('Flashcard atualizado ✓');
  } else {
    b.cards.push({id:'meu-'+bid+'-'+Date.now().toString(36)+Math.floor(Math.random()*900+100), f:f.trim(), v:v.trim(), ...(x.trim()?{ex:x.trim()}:{}), criado:Date.now()});
    toast('Flashcard salvo ✓');
  }
  saveProg(); closeModal(); render();
}
async function excluirCarta(bid, cid){
  const b = baralhoById(bid); if(!b) return;
  if(!(await ask({title:'Excluir este flashcard?', texto:'Ele sai do baralho e do seu histórico de revisões.', okLb:'Excluir'}))) return;
  b.cards = b.cards.filter(c=>c.id!==cid);
  saveProg(); toast('Flashcard excluído.'); render();
}
function vMeus(){
  const bs = meusBaralhos(), tot = totalMeus();
  let h = '<h1 class="pg-t">✏️ Meus flashcards</h1>'
    + '<p class="pg-s">Crie seus próprios baralhos, escreva a frente e o verso de cada carta e estude junto com o resto do app. Eles são só seus — ficam salvos na sua conta, neste dispositivo.</p>'
    + '<div class="fav-head" style="padding-bottom:16px"><div><b>'+bs.length+'</b> de '+MAX_BARALHOS+' baralhos · <b>'+tot+'</b> flashcard'+(tot===1?'':'s')+'</div>'
    + '<button class="btn" '+(bs.length>=MAX_BARALHOS?'disabled style="opacity:.45;cursor:default" ':'')+'onclick="criarBaralho()">＋ Criar baralho</button></div>';
  if(!bs.length) return h
    + '<div class="card" style="max-width:720px"><h3 style="font-size:16px;font-weight:700;margin-bottom:8px">Comece pelo primeiro baralho</h3>'
    + '<p class="lst-vazio" style="padding:0">Um baralho é um conjunto de cartas suas — o que você errou no plantão, as doses que não param na cabeça, o resumo daquela aula. '
    + 'Você escreve a pergunta na frente, a resposta no verso, salva, e pode editar quando quiser. Depois é só clicar em <b>Estudar</b>: elas entram na revisão espaçada como qualquer carta do app.</p>'
    + '<button class="btn" style="margin-top:16px" onclick="criarBaralho()">＋ Criar meu primeiro baralho</button></div>';
  for(const b of bs){
    const c = countsFor(cardsDoBaralho(b.id));
    h += '<div class="meu-deck"><div class="fav-head">'
      + '<div><b>'+esc(b.nome)+'</b> <span class="qt">'+b.cards.length+' carta'+(b.cards.length===1?'':'s')+'</span>'
      + (b.cards.length?'<div class="meu-nums"><span class="n-new"><b>'+c.nov+'</b> novas</span><span class="n-due"><b>'+c.due+'</b> a revisar</span><span class="n-done"><b>'+c.done+'</b> dominadas</span></div>':'')
      + '</div><div class="lst-acoes">'
      + (b.cards.length?'<button class="btn btn-sm" onclick="startStudy(\'meu:'+b.id+'\')">▶ Estudar</button>':'')
      + '<button class="btn-o btn-sm" onclick="editorCarta(\''+b.id+'\',null)">＋ Flashcard</button>'
      + '<button class="btn-o btn-sm" onclick="renomearBaralho(\''+b.id+'\')">Renomear</button>'
      + '<button class="danger btn-sm" onclick="excluirBaralho(\''+b.id+'\')">Excluir</button>'
      + '</div></div>';
    h += b.cards.length
      ? '<div class="fav-list">' + b.cards.map(x=>
          '<div class="fav-row"><button class="q" onclick="verCarta(\''+x.id+'\')" title="Ver a carta">'
          + '<b>'+esc(x.f.length>96?x.f.slice(0,96)+'…':x.f)+'</b><span>'+esc(x.v.replace(/\n/g,' ').slice(0,70))+(x.v.length>70?'…':'')+'</span></button>'
          + '<button class="fav-x" title="Editar" onclick="editorCarta(\''+b.id+'\',\''+x.id+'\')">✏️</button>'
          + '<button class="fav-x" title="Excluir" onclick="excluirCarta(\''+b.id+'\',\''+x.id+'\')">✕</button></div>').join('') + '</div>'
      : '<p class="lst-vazio">Nenhum flashcard ainda. Clique em <b>＋ Flashcard</b> para escrever o primeiro.</p>';
    h += '</div>';
  }
  return h;
}

/* ================= FAVORITOS & LISTAS ================= */
const MAX_LISTAS = 10;
const HEART = '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M12 20.7 3.9 12.6a5.1 5.1 0 0 1 7.2-7.2l.9.9.9-.9a5.1 5.1 0 0 1 7.2 7.2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
function cardById(cid){
  for(const t of DECKS) for(const s of t.subs) for(const c of s.cards)
    if(c.id===cid) return {...c, cid:c.id, deck:t, sub:s};
  for(const b of meusBaralhos()) for(const c of b.cards) if(c.id===cid) return embrulha(b,c);
  return null;
}
const visivel = c => !c.deck.restrito || revUnlocked();
const isFav = cid => !!(prog && prog.fav && prog.fav[cid]);
function favCards(){ return Object.keys(prog.fav||{}).map(cardById).filter(Boolean); }
function listaById(id){ return (prog.listas||[]).find(l=>l.id===id); }
function listaCards(id){ const l=listaById(id); return l ? l.cards.map(cardById).filter(Boolean) : []; }
function toggleFav(cid){
  if(prog.fav[cid]){ delete prog.fav[cid]; toast('Removido dos favoritos'); }
  else { prog.fav[cid]=Date.now(); toast('Salvo nos favoritos ❤️'); }
  saveProg(); render();
}
function cardActionsHtml(cid){
  const nl = (prog.listas||[]).filter(l=>l.cards.includes(cid)).length;
  return '<div class="st-acts">'
    + '<button class="c-fav'+(isFav(cid)?' on':'')+'" aria-label="Favoritar" title="'+(isFav(cid)?'Remover dos favoritos':'Favoritar')+'" onclick="toggleFav(\''+cid+'\')">'+HEART+'</button>'
    + '<button class="c-add'+(nl?' on':'')+'" aria-label="Adicionar a uma lista" title="Adicionar a uma lista" onclick="openListMenu(\''+cid+'\')">+'
    + (nl?'<i class="badge-n">'+nl+'</i>':'') + '</button></div>';
}
function showModal(inner){
  const root=$('mdl-root'); if(!root) return;
  root.innerHTML='<div class="mdl-bg" id="mdl-bg"><div class="mdl" role="dialog" aria-modal="true">'+inner+'</div></div>';
  $('mdl-bg').onclick = e => { if(e.target===$('mdl-bg')) closeModal(); };
  if(mdlEsc) document.removeEventListener('keydown', mdlEsc);
  mdlEsc = e => { if(e.key==='Escape') closeModal(); };
  document.addEventListener('keydown', mdlEsc);
}
function openListMenu(cid){
  const ls = prog.listas||[];
  const corpo = ls.length
    ? ls.map(l=>'<button class="lst-row'+(l.cards.includes(cid)?' on':'')+'" onclick="toggleLista(\''+l.id+'\',\''+cid+'\')">'
        + '<span class="nm">'+esc(l.nome)+'</span><span class="qt">'+l.cards.length+'</span>'
        + '<span class="ck">'+(l.cards.includes(cid)?'✓':'')+'</span></button>').join('')
    : '<p class="lst-vazio">Você ainda não tem listas. Crie a primeira para organizar seus flashcards do seu jeito.</p>';
  showModal('<h3>Adicionar a uma lista</h3>'
    + '<p>Clique numa lista para incluir ou tirar este flashcard. Você pode ter até '+MAX_LISTAS+'.</p>'
    + '<div class="lst-box">'+corpo+'</div>'
    + '<div class="mdl-row"><button class="btn-o btn-sm" id="mdl-no" onclick="closeModal()">Fechar</button>'
    + '<button class="btn btn-sm" '+(ls.length>=MAX_LISTAS?'disabled style="opacity:.45;cursor:default" ':'')
    + 'onclick="criarLista(\''+cid+'\')">＋ Criar lista</button></div>'
    + (ls.length>=MAX_LISTAS?'<p class="lst-lim">Limite de '+MAX_LISTAS+' listas atingido — exclua uma no Perfil para criar outra.</p>':''));
}
function toggleLista(lid, cid){
  const l = listaById(lid); if(!l) return;
  const menuAberto = !!$('mdl-bg');
  const i = l.cards.indexOf(cid);
  if(i>=0){ l.cards.splice(i,1); toast('Tirado de "'+l.nome+'"'); }
  else { l.cards.push(cid); toast('Adicionado a "'+l.nome+'" ✓'); }
  saveProg(); render(); if(menuAberto) openListMenu(cid);
}
async function criarLista(cid){
  if((prog.listas||[]).length>=MAX_LISTAS){ toast('Você já tem '+MAX_LISTAS+' listas.'); return; }
  closeModal();
  const nome = await ask({title:'Criar lista', texto:'Dê um nome para organizar seus flashcards — por exemplo "Revisar antes da prova" ou "Errei duas vezes".', campo:'texto', ph:'Nome da lista', max:40, okLb:'Criar lista'});
  if(nome===null){ if(cid) openListMenu(cid); return; }
  const n = String(nome).trim().slice(0,40);
  if(!n){ toast('A lista precisa de um nome.'); if(cid) openListMenu(cid); return; }
  prog.listas.push({id:'l'+Date.now().toString(36), nome:n, cards: cid?[cid]:[]});
  saveProg(); toast('Lista "'+n+'" criada'+(cid?' com este flashcard ✓':' ✓'));
  render(); if(cid) openListMenu(cid);
}
async function renomearLista(lid){
  const l = listaById(lid); if(!l) return;
  const nome = await ask({title:'Renomear lista', campo:'texto', ph:'Nome da lista', max:40, valor:l.nome, okLb:'Salvar'});
  if(nome===null) return;
  const n = String(nome).trim().slice(0,40);
  if(!n){ toast('A lista precisa de um nome.'); return; }
  l.nome = n; saveProg(); toast('Lista renomeada.'); render();
}
async function excluirLista(lid){
  const l = listaById(lid); if(!l) return;
  if(!(await ask({title:'Excluir a lista "'+l.nome+'"?', texto:'Os flashcards continuam no app — só a lista é apagada.', okLb:'Excluir lista'}))) return;
  prog.listas = prog.listas.filter(x=>x.id!==lid);
  saveProg(); toast('Lista excluída.'); render();
}
function verCarta(cid){
  const c = cardById(cid); if(!c) return;
  showModal('<h3>'+esc(c.deck.nome)+' · '+esc(c.sub.nome)+'</h3>'
    + '<div class="prev-q">'+cFront(c)+'</div><div class="st-a" style="margin-top:14px;padding-top:14px"><div class="lb">Resposta</div><div class="tx">'+cBack(c)+'</div>'
    + (c.ex?'<div class="ex">💡 '+cDica(c)+'</div>':'')+'</div>'
    + '<div class="mdl-row"><button class="btn btn-sm" onclick="closeModal()">Fechar</button></div>');
}
function cardRowsHtml(cards, acao){
  if(!cards.length) return '<p class="lst-vazio">Nenhum flashcard aqui ainda.</p>';
  return '<div class="fav-list">' + cards.map(c=>
    '<div class="fav-row"><button class="q" onclick="verCarta(\''+c.cid+'\')" title="Ver a carta">'
    + '<b>'+esc(c.f.length>96?c.f.slice(0,96)+'…':c.f)+'</b><span>'+c.deck.ic+' '+esc(c.sub.nome)+'</span></button>'
    + acao(c) + '</div>').join('') + '</div>';
}

/* ================= ESTADO ================= */
let user = null;
let prog = null;
let session = null;
let curView = 'dashboard';

function loadProg(){
  prog = store.get(kProg(user.email)) || {cards:{}, log:{}};
  if(!prog.cards) prog.cards={};
  if(!prog.log) prog.log={};
  if(!prog.fav) prog.fav={};
  if(!Array.isArray(prog.listas)) prog.listas=[];
  if(!Array.isArray(prog.meus)) prog.meus=[];
  if(!prog.plano || typeof prog.plano!=='object') prog.plano=null;
  if(!prog.trofeus || typeof prog.trofeus!=='object') prog.trofeus={};
  if(prog.genero!=='f' && prog.genero!=='m') prog.genero=null;
}
function saveProg(){
  store.set(kProg(user.email), prog);
  if(typeof nuvemAgendarEnvio === 'function') nuvemAgendarEnvio();
}

/* ================= NAVEGAÇÃO DE PÁGINAS ================= */
function showPage(p){
  $('pg-landing').hidden = p!=='landing';
  $('pg-auth').hidden    = p!=='auth';
  $('pg-app').hidden     = p!=='app';
  window.scrollTo(0,0);
}

/* ================= AUTH ================= */
let authMode='login';
function goAuth(mode){ authMode=mode; showPage('auth'); authTab(mode); $('auth-msg').innerHTML=''; }
function authTab(mode){
  authMode=mode;
  $('tab-login').classList.toggle('on', mode==='login');
  $('tab-signup').classList.toggle('on', mode==='signup');
  $('fld-nome').hidden = mode==='login';
  $('auth-btn').textContent = mode==='login' ? 'Entrar' : 'Criar minha conta';
  $('in-senha').autocomplete = mode==='login' ? 'current-password' : 'new-password';
  $('auth-msg').innerHTML='';
  const rec = $('auth-rec');
  if(rec) rec.hidden = !(mode==='login' && typeof nuvemLigada==='function' && nuvemLigada());
}
function authErr(m){ $('auth-msg').innerHTML='<div class="auth-err">'+esc(m)+'</div>'; }

/* Sem banco não há como recuperar senha: a conta existe só neste navegador. */
async function esqueciSenha(){
  const email = $('in-email').value.trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return authErr('Digite seu e-mail no campo acima e clique de novo.');
  try{
    await nuvemRecuperarSenha(email);
    $('auth-msg').innerHTML = '<div class="auth-ok">Enviamos um link de nova senha para <b>'+esc(email)+'</b>.</div>';
  }catch(e){ authErr(e.message); }
}

$('auth-form').addEventListener('submit', async e=>{
  e.preventDefault();
  const nome=$('in-nome').value.trim(), email=$('in-email').value.trim().toLowerCase(), senha=$('in-senha').value;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return authErr('Digite um e-mail válido.');
  if(senha.length<6) return authErr('A senha precisa ter pelo menos 6 caracteres.');
  $('auth-btn').disabled=true; $('auth-btn').textContent='Aguarde…';

  /* Com banco configurado, a conta é do servidor: o mesmo e-mail e senha
     entram em qualquer aparelho, e o progresso vem junto. */
  if(nuvemLigada()){
    try{
      if(authMode==='signup'){
        if(!nome || nome.length<2){ authErr('Digite seu nome completo.'); return; }
        const r = await nuvemCadastrar(nome, email, senha);
        if(r.confirmar){
          $('auth-msg').innerHTML = '<div class="auth-ok">Conta criada. Enviamos um e-mail de confirmação para <b>'
            + esc(email) + '</b> — confirme e depois volte para entrar.</div>';
          return;
        }
      } else {
        await nuvemEntrar(email, senha);
      }
      const u = await nuvemSessao();
      if(!u){ authErr('Não consegui abrir a sessão. Tente de novo.'); return; }
      await entrarComNuvem(u);
      if(authMode==='signup') toast('Conta criada! Bons estudos 🎓');
      return;
    }catch(err){ authErr(err.message); return; }
    finally{ $('auth-btn').disabled=false; $('auth-btn').textContent = authMode==='login' ? 'Entrar' : 'Criar minha conta'; }
  }

  /* modo local — sem banco configurado, tudo fica neste navegador */
  const users = store.get(K_USERS) || {};
  try{
    if(authMode==='signup'){
      if(!nome || nome.length<2){ authErr('Digite seu nome completo.'); return; }
      if(users[email]){ authErr('Já existe uma conta com este e-mail neste dispositivo. Use a aba Entrar.'); return; }
      const salt = Math.random().toString(36).slice(2)+Date.now().toString(36);
      users[email] = {nome, email, salt, hash: await hash(salt+senha), created: Date.now()};
      store.set(K_USERS, users);
      store.set(K_SESS, email);
      enterApp(users[email]);
      toast('Conta criada! Bons estudos 🎓');
    } else {
      const u = users[email];
      if(!u){ authErr('Conta não encontrada neste dispositivo. Crie sua conta na aba ao lado.'); return; }
      if(u.hash !== await hash(u.salt+senha)){ authErr('Senha incorreta. Tente novamente.'); return; }
      store.set(K_SESS, email);
      enterApp(u);
    }
  } finally {
    $('auth-btn').disabled=false;
    $('auth-btn').textContent = authMode==='login' ? 'Entrar' : 'Criar minha conta';
  }
});

function enterApp(u){
  user = {nome:u.nome, email:u.email, created:u.created};
  loadProg();
  loadAtalhos();
  const first = u.nome.trim().split(/\s+/)[0];
  $('s-nome').textContent = first;
  $('s-email').textContent = u.email.length>24 ? u.email.slice(0,22)+'…' : u.email;
  $('s-av').textContent = (u.nome[0]||'?').toUpperCase();
  showPage('app');
  nav('dashboard');
  vigiaVirada();
  checarConquistas();
}
async function logout(){
  if(nuvemLigada()){ await nuvemEnviarProgresso(); await nuvemSair(); }
  if(session && !(await ask({title:'Sair da conta?', texto:'Você está no meio de uma sessão de estudo. As cartas já respondidas ficam salvas.', okLb:'Sair mesmo assim'}))) return;
  session=null; user=null; prog=null;
  store.del(K_SESS);
  showPage('landing');
}

/* ================= SRS (revisão espaçada) — FSRS-5 =================
   FSRS ("Free Spaced Repetition Scheduler") é hoje o algoritmo de repetição
   espaçada com mais evidência publicada de superioridade sobre o SM-2
   clássico para retenção de longo prazo — é o que o Anki usa por padrão
   desde 2023. Trocamos aqui a fórmula SM-2 simplificada (ease factor fixo)
   de antes por ele.

   Cada carta guarda dois números que representam a memória:
     · dificuldade (D)  — de 1 (fácil) a 10 (difícil);
     · estabilidade (S) — em dias: o intervalo em que a chance de lembrar
       cai para 90%. É esse número, e não um "ease factor", que cresce ou
       encolhe a cada resposta.
   A cada revisão, o algoritmo olha quanto tempo passou desde a última vez
   (o que dá a chance atual de lembrar, R) e a nota dada, e recalcula D e S.
   Cartas difíceis voltam rápido porque a estabilidade cai; cartas fáceis
   voltam cada vez mais espaçadas porque ela sobe.

   Os pesos abaixo são os pesos padrão publicados pelo projeto
   open-spaced-repetition para a FSRS-5 — o mesmo ponto de partida que o
   Anki usa antes de alguém rodar a "otimização" com o próprio histórico
   (que precisaria de milhares de revisões por aluno para valer a pena;
   os pesos padrão já são calibrados num banco grande e público de dados
   reais de revisão, então funcionam bem sem isso). */
const FSRS_W = [0.40255,1.18385,3.173,15.69105,7.1949,0.5345,1.4604,0.0046,
                1.54575,0.1192,1.01925,1.9395,0.11,0.29605,2.2698,0.2315,
                2.9898,0.51655,0.6621];
const FSRS_DECAY = -0.5;
const FSRS_FACTOR = 19/81;         // faz a retrievability valer exatamente 90% quando o tempo passado = S
const FSRS_RETENCAO = 0.9;         // meta de 90% de chance de lembrar — padrão da literatura e do Anki
const FSRS_MAX_IVL = 3650;         // teto de segurança (10 anos) — não é uma meta, é um limite
const NEW_PER_DAY = 20;
/* Teto de cartas NOVAS por clique em "Estudar tema"/"Estudar" (subtema) — não
   é por dia, não é compartilhado entre temas, e não depende da meta do plano
   (ver buildSession). Maior que o maior subtema do app (51 cartas), então um
   subtema nunca fica truncado; para um tema inteiro, cada clique entrega um
   pedaço deste tamanho, e as revisões vencidas continuam vindo por inteiro. */
const NOVAS_POR_ALVO = 60;
const clampD = d => Math.max(1, Math.min(10, d));
function fsrsD0(g){ return clampD(FSRS_W[4] - Math.exp(FSRS_W[5]*(g-1)) + 1); }
const FSRS_D0_FACIL = fsrsD0(4);   // alvo da "reversão à média" da dificuldade (FSRS-5 usa D0(fácil))
/* chance de lembrar hoje, dado quanto tempo passou e a estabilidade atual */
function fsrsRetrievability(elapsedDias, s){
  return Math.pow(1 + FSRS_FACTOR*Math.max(0,elapsedDias)/s, FSRS_DECAY);
}
/* em quantos dias a chance de lembrar cai até a meta de retenção */
function fsrsIntervalo(s, retencao){
  return (s/FSRS_FACTOR) * (Math.pow(retencao, 1/FSRS_DECAY) - 1);
}
function fsrsProximaDificuldade(d, g){
  const delta = -FSRS_W[6]*(g-3);
  const dp = d + delta*((10-d)/9);
  return clampD(FSRS_W[7]*FSRS_D0_FACIL + (1-FSRS_W[7])*dp);
}
function fsrsEstabilidadeAcerto(d, s, r, g){
  const penalDificil = g===2 ? FSRS_W[15] : 1;
  const bonusFacil   = g===4 ? FSRS_W[16] : 1;
  const inc = Math.exp(FSRS_W[8]) * (11-d) * Math.pow(s,-FSRS_W[9])
            * (Math.exp(FSRS_W[10]*(1-r)) - 1) * penalDificil * bonusFacil + 1;
  return s*inc;
}
function fsrsEstabilidadeErro(d, s, r){
  const sf = FSRS_W[11] * Math.pow(d,-FSRS_W[12]) * (Math.pow(s+1,FSRS_W[13]) - 1) * Math.exp(FSRS_W[14]*(1-r));
  return Math.min(sf, s);   // depois de esquecer, a nova estabilidade nunca supera a de antes
}

function gradeCard(cs, g){ // g: 0 errei · 1 difícil · 2 bom · 3 fácil (UI) → notação da FSRS: 1..4
  const now = Date.now();
  const fg = g+1;                    // 1 errei · 2 difícil · 3 bom · 4 fácil
  cs.reps = (cs.reps||0)+1;
  cs.lapses = cs.lapses||0;

  if(cs.s===undefined && cs.iv>0){
    /* migração: esta carta tem histórico de antes da FSRS (a fórmula SM-2
       simplificada usada até aqui) — aproveita o intervalo e a facilidade
       já calculados como ponto de partida, em vez de jogar fora o que o
       aluno já estudou. */
    cs.s = Math.max(0.1, cs.iv);
    cs.d = clampD(11 - (cs.ef||2.5)*3);
    /* o formato antigo não guardava quando a carta foi revisada por último,
       só o "vencimento" (due) e o intervalo que levou até ele — dá para
       voltar no tempo e estimar: due − iv dias atrás. Sem isso, a conta de
       "quanto tempo passou" desta primeira revisão pós-migração assumiria
       elapsed=0, como se a carta tivesse acabado de ser vista agora mesmo. */
    if(cs.due) cs.ts = cs.due - cs.iv*864e5;
  }
  if(cs.s===undefined){
    /* carta nova de verdade, sem nenhum histórico: o ponto de partida vem
       direto dos pesos publicados, só pela nota dada agora. */
    cs.s = FSRS_W[fg-1];
    cs.d = fsrsD0(fg);
  } else {
    const elapsed = Math.max(0, (now-(cs.ts||now))/864e5);
    const r = fsrsRetrievability(elapsed, cs.s);
    const novoD = fsrsProximaDificuldade(cs.d, fg);
    cs.s = fg===1 ? fsrsEstabilidadeErro(cs.d, cs.s, r) : fsrsEstabilidadeAcerto(cs.d, cs.s, r, fg);
    cs.d = novoD;
  }
  cs.ts = now;              // quando foi revisada — usado na próxima chance de lembrar e para sincronizar entre aparelhos
  delete cs.ef;             // campo do algoritmo antigo — não existe mais na FSRS

  if(g===0){
    cs.lapses++;
    cs.iv = 0;              // errou: volta em instantes, dentro da própria sessão (não é bem "vencida" ainda)
    cs.due = now + 60*1000;
  } else {
    cs.iv = Math.max(1, Math.min(FSRS_MAX_IVL, Math.round(fsrsIntervalo(cs.s, FSRS_RETENCAO))));
    cs.due = now + cs.iv*864e5;
  }
}
function previewIv(cs, g){
  const s = Object.assign({}, cs||{});
  gradeCard(s, g);
  if(g===0) return '&lt;1 min';
  return s.iv===1 ? '1 dia' : s.iv<31 ? s.iv+' dias' : (Math.round(s.iv/30*10)/10)+' meses';
}
function countsFor(cards){
  const now=Date.now(); let nov=0, due=0, done=0;
  for(const c of cards){
    const cs = prog.cards[c.cid];
    if(!cs) nov++;
    else if(cs.due<=now) due++;
    else if((cs.iv||0)>=21) done++;
  }
  return {nov, due, done, total: cards.length};
}
function newIntroducedToday(){ return (prog.log[todayKey()]||{}).nov||0; }
/* Orçamento de cartas NOVAS de hoje. A meta do plano conta o TOTAL do dia
   (revisões + novas), então as revisões vencidas entram primeiro e as novas
   ocupam o que sobrar. Em dia de folga o aluno ainda pode estudar: usamos a
   meta cheia se ele abrir uma sessão mesmo assim. */
function newBudget(devidasAgora){
  const p = plano();
  const teto = ehDiaDeEstudo() ? restanteHoje() : Math.max(0, p.meta - feitoHoje());
  return Math.max(0, teto - (devidasAgora||0));
}
/* ---- Revisão rápida (v30): só as cartas de base, marcadas com b:1 ----
   'base:all', 'base:tema:<id>' e 'base:sub:<id>' reaproveitam o alvo de dentro. */
function ehBase(target){ return (target||'').startsWith('base:'); }
function cartasBase(target){ return poolFor((target||'base:all').slice(5)).filter(c=>c.b); }
function contaBase(target){ return cartasBase(target).length; }

function poolFor(target){
  if(ehBase(target)) return cartasBase(target);
  if(!target || target==='all') return allCards();
  if(target.startsWith('tema:')) return cardsOfTheme(target.slice(5));
  if(target.startsWith('sub:')) return cardsOfSub(target.slice(4));
  if(target==='fav') return favCards().filter(visivel);
  if(target.startsWith('lista:')) return listaCards(target.slice(6)).filter(visivel);
  if(target.startsWith('meu:')) return cardsDoBaralho(target.slice(4));
  return [];
}
function labelFor(target){
  if(ehBase(target)) return '⚡ Revisão rápida · ' + (labelFor(target.slice(5)) || 'Todos os temas');
  if(!target || target==='all') return 'Todos os temas';
  if(target.startsWith('tema:')){ const t=DECKS.find(x=>x.id===target.slice(5)); return t? t.ic+' '+t.nome : ''; }
  if(target.startsWith('sub:')){ const r=findSub(target.slice(4)); return r? r.t.ic+' '+r.t.nome+' · '+r.s.nome : ''; }
  return '';
}
function buildSession(target){
  const now=Date.now();
  const pool = poolFor(target);
  /* Revisão rápida: passa pelas cartas de base na ordem didática, sem teto diário
     e sem esperar o intervalo do SRS — é uma leitura de revisão, não uma sessão
     de memorização. As respostas continuam contando para o progresso. */
  if(ehBase(target)){
    const q = permitidas(pool);
    const trancadas = pool.length - q.length;
    if(q.length) return {target, queue:q, idx:0, again:[], flipped:false, rev:0, ok:0, trancadas};
    return trancadas ? {target, queue:[], idx:0, again:[], flipped:false, rev:0, ok:0, trancadas} : null;
  }
  if(target==='fav' || (target||'').startsWith('lista:') || (target||'').startsWith('meu:')){
    const q = pool.slice();
    for(let i=q.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [q[i],q[j]]=[q[j],q[i]]; }
    return q.length ? {target, queue:q, idx:0, again:[], flipped:false, rev:0, ok:0} : null;
  }
  /* Tema ou subtema escolhidos de propósito pelo aluno (botão "Estudar tema"
     ou "Estudar" de um subtema específico): a sessão NÃO é mais rateada pela
     meta diária do plano. Antes, `tema:`/`sub:` passavam pelo mesmo teto de
     "Estudar agora" (`restanteHoje()`), compartilhado por TODO o app — então
     um aluno que já tivesse batido a meta estudando outros temas via
     "Estudar agora" via essa sessão vir vazia ("Nada para estudar agora
     aqui"), mesmo com milhares de cartas nunca vistas ali dentro. As revisões
     vencidas do alvo entram todas (nunca ficam represadas por um teto
     alheio); as cartas novas entram até `NOVAS_POR_ALVO` — teto por
     sessão/alvo, não por dia nem compartilhado entre temas — grande o
     bastante para nunca truncar um subtema inteiro (o maior tem 51 cartas)
     e ainda deixar um tema grande (podem passar de mil cartas) em pedaços
     administráveis por sessão, sem depender do quanto já foi estudado em
     outro lugar hoje. */
  if(target.startsWith('tema:') || target.startsWith('sub:')){
    const livre = permitidas(pool);
    const trancadas = pool.length - livre.length;
    const due = livre.filter(c=>{ const cs=prog.cards[c.cid]; return cs && cs.due<=now; });
    const novos = livre.filter(c=>!prog.cards[c.cid]).slice(0, NOVAS_POR_ALVO);
    const queue = [...due, ...novos];
    if(!queue.length) return trancadas ? {target, queue:[], idx:0, again:[], flipped:false, rev:0, ok:0, trancadas} : null;
    return {target, queue, idx:0, again:[], flipped:false, rev:0, ok:0, trancadas};
  }
  const p = plano();
  const teto = ehDiaDeEstudo() ? restanteHoje() : Math.max(0, p.meta - feitoHoje());
  const livre = permitidas(pool);
  const trancadas = pool.length - livre.length;      // quantas o Premium abriria
  const due = livre.filter(c=>{ const cs=prog.cards[c.cid]; return cs && cs.due<=now; }).slice(0, teto);
  const vagas = newBudget(due.length);
  /* em 'Estudar agora' as cartas novas seguem a prioridade do plano (peso do
     subtema); dentro de um tema ou subtema, seguem a ordem didática. */
  const novos = (!target || target==='all')
    ? novasNaOrdemDoPlano(vagas)
    : livre.filter(c=>!prog.cards[c.cid]).slice(0, vagas);
  const queue=[...due, ...novos];
  if(!queue.length) return trancadas ? {target, queue:[], idx:0, again:[], flipped:false, rev:0, ok:0, trancadas} : null;
  return {target, queue, idx:0, again:[], flipped:false, rev:0, ok:0, trancadas};
}

/* ================= PREMIUM / FREEMIUM (v28) ================= */
/* ⚠️ COLE AQUI OS LINKS DE CHECKOUT DE CADA PLANO (Kiwify, Hotmart, Mercado Pago…),
   um para cada trilha — o preço muda entre elas, então o produto no checkout
   também precisa ser outro. Enquanto ficarem vazios, o botão avisa que a
   assinatura abre em breve. */
const CHECKOUT = (window.CT_CONFIG && window.CT_CONFIG.CHECKOUT) || {estagio:{mensal:'',semestral:'',anual:''}, residencia:{mensal:'',semestral:'',anual:''}};
/* Duração e rótulo de cada plano — isto NÃO muda por trilha. */
const PLANOS = [
  {id:'mensal',    nome:'Mensal',    meses:1,  cobranca:'todo mês'},
  {id:'semestral', nome:'Semestral', meses:6,  cobranca:'a cada 6 meses', destaque:1},
  {id:'anual',     nome:'Anual',     meses:12, cobranca:'uma vez por ano'}
];
/* Preço de cada plano em cada trilha. A CT Residência inclui tudo da CT
   Estágio mais Cirurgia, GO, Pediatria e Preventiva — por isso custa mais.
   Confira a conta antes de mudar: `economia` é o desconto do mês contra o
   plano mensal da mesma trilha (ex.: 59,90 é 40% de 99,90 pago 12x). */
const PRECOS = {
  estagio: {
    mensal:    {mes:'79,90', total:'79,90',  economia:0},
    semestral: {mes:'49,90', total:'299,40', economia:37},
    anual:     {mes:'39,90', total:'478,80', economia:50}
  },
  residencia: {
    mensal:    {mes:'99,90', total:'99,90',  economia:0},
    semestral: {mes:'69,90', total:'419,40', economia:30},
    anual:     {mes:'59,90', total:'718,80', economia:40}
  }
};
/* Junta duração + preço da trilha pedida — é o que a vitrine desenha. */
function planosDe(tr){ return PLANOS.map(m => Object.assign({}, m, PRECOS[tr][m.id])); }
/* Trilha cujo preço a vitrine mostra agora; o aluno troca no switch acima
   dos planos. Sempre começa pela CT Estágio. */
let precoTrilha = 'estagio';
const FREE_CARDS = 5;   // metade do valor anterior (10), por decisão do CT
/* total real de flashcards do app (todas as trilhas, aberta ou não) — usado
   só em textos de marketing, para não ficar um número fixo desatualizado. */
const TOTAL_CARTAS_APP = DECKS.reduce((a,t)=>a+t.subs.reduce((b,s)=>b+s.cards.length,0),0);
/* total que CADA código realmente libera — usado nas telas de quem já é
   assinante, para nunca prometer mais do que a trilha dele abre. */
const TOTAL_TRILHA = {
  estagio: DECKS.filter(t=>!t.restrito).reduce((a,t)=>a+t.subs.reduce((b,s)=>b+s.cards.length,0),0),
  residencia: TOTAL_CARTAS_APP
};
const fmtMil = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
const K_PREM = 'fcct_premium';
const PREM_SALT = 'fcct-premium-2026|';

/* ---- estado da assinatura (guardado por conta, neste aparelho) ---- */
function assinatura(){ return (store.get(K_PREM)||{})[user? user.email : ''] || null; }
function salvarAssinatura(a){
  const all = store.get(K_PREM) || {};
  if(a) all[user.email] = a; else delete all[user.email];
  store.set(K_PREM, all);
}
function diasRestantesAssinatura(){
  if(typeof nuvemLigada === 'function' && nuvemLigada())
    return nuvem.assinatura ? nuvem.assinatura.dias_restantes : null;
  const a = assinatura(); if(!a || !a.ate) return null;
  return Math.ceil((new Date(a.ate+'T23:59:59') - new Date())/864e5);
}
/* Com banco configurado, quem diz se o aluno é Premium é o servidor — o
   código CT-AAAAMMDD-XXXXXX vira apenas o plano B do modo local. */
function assinaturaValida(){
  if(typeof nuvemLigada === 'function' && nuvemLigada())
    return !!(nuvem.assinatura && nuvem.assinatura.dias_restantes > 0);
  const d = diasRestantesAssinatura(); return d!==null && d>0;
}
/* o administrador enxerga e estuda tudo */
function ehPremium(){ return isAdmin() || assinaturaValida(); }
/* qual trilha a assinatura ATIVA libera — 'estagio' abre só o CT Estágio,
   'residencia' abre tudo. Assinaturas ativadas antes desta separação (sem
   o campo `trilha` salvo) continuam abrindo tudo, como sempre abriram —
   ninguém perde acesso por causa desta mudança. */
function assinaturaTrilha(){
  if(!assinaturaValida()) return null;
  const a = assinatura();
  return (a && a.trilha) || 'residencia';
}

/* ---- código de acesso: CT-<E ou R>-<vencimento>-<assinatura> ----
   A letra diz a trilha (E=Estágio, R=Residência) e entra na assinatura,
   então não dá para trocar a letra à mão e "promover" um código Estágio
   para Residência — o hash não bate mais.
   Códigos gerados ANTES desta separação (sem a letra, formato antigo
   CT-<vencimento>-<assinatura>) continuam válidos para sempre e continuam
   abrindo tudo — era essa a promessa feita a quem já assinou. */
function b36(n){ return n.toString(36).toUpperCase(); }
async function assinaCodigo(email, ate, trilha){
  const h = await hash(PREM_SALT + trilha + '|' + email.trim().toLowerCase() + '|' + ate);
  return h.slice(0,6).toUpperCase();
}
/* fórmula antiga, só para validar códigos emitidos antes da separação por trilha */
async function assinaCodigoLegado(email, ate){
  const h = await hash(PREM_SALT + email.trim().toLowerCase() + '|' + ate);
  return h.slice(0,6).toUpperCase();
}
async function gerarCodigo(email, meses, trilha){
  trilha = trilha==='estagio' ? 'estagio' : 'residencia';   // sem trilha explícita, gera o que sempre abriu tudo
  const d = new Date(); d.setMonth(d.getMonth() + meses);
  const ate = todayKey(d);
  const sig = await assinaCodigo(email, ate, trilha);
  const letra = trilha==='estagio' ? 'E' : 'R';
  return {codigo: 'CT-'+letra+'-' + ate.replace(/-/g,'') + '-' + sig, ate, trilha};
}
async function validarCodigo(codigo){
  const c = String(codigo||'').trim().toUpperCase().replace(/\s+/g,'');
  const novo = c.match(/^CT-([ER])-(\d{8})-([0-9A-F]{6})$/);
  if(novo){
    const trilha = novo[1]==='E' ? 'estagio' : 'residencia';
    const ate = novo[2].slice(0,4)+'-'+novo[2].slice(4,6)+'-'+novo[2].slice(6,8);
    if(await assinaCodigo(user.email, ate, trilha) !== novo[3])
      return {ok:false, erro:'Este código não é do seu e-mail. Cada código vale para uma conta só — confira se você entrou com o e-mail da compra.'};
    if(new Date(ate+'T23:59:59') < new Date())
      return {ok:false, erro:'Este código venceu em '+new Date(ate+'T12:00:00').toLocaleDateString('pt-BR')+'. Renove a assinatura para receber um novo.'};
    return {ok:true, ate, trilha};
  }
  const antigo = c.match(/^CT-(\d{8})-([0-9A-F]{6})$/);      // formato de antes da separação por trilha
  if(antigo){
    const ate = antigo[1].slice(0,4)+'-'+antigo[1].slice(4,6)+'-'+antigo[1].slice(6,8);
    if(await assinaCodigoLegado(user.email, ate) !== antigo[2])
      return {ok:false, erro:'Este código não é do seu e-mail. Cada código vale para uma conta só — confira se você entrou com o e-mail da compra.'};
    if(new Date(ate+'T23:59:59') < new Date())
      return {ok:false, erro:'Este código venceu em '+new Date(ate+'T12:00:00').toLocaleDateString('pt-BR')+'. Renove a assinatura para receber um novo.'};
    return {ok:true, ate, trilha:'residencia'};
  }
  return {ok:false, erro:'Código fora do formato. Ele começa com CT- e tem partes separadas por hífen.'};
}
async function ativarPremium(){
  const v = await ask({title:'⭐ Ativar o CT Premium', texto:'Cole aqui o código que o CT enviou depois da sua assinatura. Ele vale para o e-mail com que você entrou: '+user.email, campo:'texto', ph:'CT-E-20270308-A1B2C3', max:26, okLb:'Ativar'});
  if(v===null) return;
  if(!v){ toast('Digite o código.'); return; }
  const r = await validarCodigo(v);
  if(!r.ok){ await ask({title:'Não deu para ativar', texto:r.erro, okLb:'Entendi', cancelLb:null}); return; }
  salvarAssinatura({ate:r.ate, trilha:r.trilha, code:String(v).trim().toUpperCase(), desde:todayKey()});
  toast('CT Premium ('+TRILHAS[r.trilha].nome+') ativado ⭐');
  renderNav(); render();
}

/* ---- o que está liberado no plano gratuito ---- */
function subLivreDoTema(temaId){ const t=DECKS.find(x=>x.id===temaId); return t? (t.fs||null) : null; }
function cartaLiberada(c){
  /* conteúdo exclusivo da trilha CT Residência: nem o Premium da trilha
     Estágio abre isso — só um código Residência, a senha do CT ou o admin. */
  if(c.deck && c.deck.restrito && !revUnlocked()) return false;
  if(ehPremium()) return true;
  if(c.own) return true;                                   // baralhos do próprio aluno são grátis
  const t = c.deck, s = c.sub;
  if(!t || !s || t.fs !== s.id) return false;
  const i = s.cards.findIndex(x=>x.id===(c.cid||c.id));
  return i >= 0 && i < FREE_CARDS;
}
function subLiberado(subId){
  const r = findSub(subId); if(!r) return false;
  if(r.t.restrito && !revUnlocked()) return false;
  if(ehPremium()) return true;
  return r.t.fs === subId;
}
function cartasLivresDoSub(s){ return s.cards.slice(0, FREE_CARDS); }
function totalLivres(){
  return visibleDecks().reduce((a,t)=>{
    if(!t.fs) return a;
    const s = t.subs.find(x=>x.id===t.fs);
    return a + (s? Math.min(FREE_CARDS, s.cards.length) : 0);
  },0);
}
/* filtra um pool pelo que a conta pode estudar — sempre respeita a trilha
   restrita primeiro (visivel), e só depois o teto do plano gratuito. Uma
   assinatura Premium só da trilha Estágio nunca abre conteúdo restrito. */
function permitidas(pool){
  const abertas = pool.filter(visivel);
  return ehPremium() ? abertas : abertas.filter(cartaLiberada);
}

/* ================= BUSCA (tela inicial, CT Estágio, CT Residência) =====
   Busca por subtema (pelo nome) ou por palavra-chave dentro das cartas
   (pergunta OU resposta). A regra de ouro: o resultado nunca revela o
   conteúdo de um flashcard que a conta não teria como abrir navegando —
   por isso cada carta encontrada passa por cartaLiberada() antes de ter
   sua pergunta/resposta exibidas, e cada subtema passa por subLiberado()
   antes de virar um link de "Estudar" (senão vira um botão de Premium,
   igual às linhas trancadas de vDecks). A lista de temas pesquisados
   também respeita a trilha restrita (visibleDecks/decksDaTrilha), do
   mesmo jeito que a tela de Estágio/Residência já respeita. */
let buscaQ = {all:'', estagio:'', residencia:''};
let buscaTimers = {};
function normBusca(s){
  return String(s||'')
    .replace(/<[^>]*>/g,' ')
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .toLowerCase();
}
function snippetTxt(html, n){
  const t = String(html||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  return t.length>n ? t.slice(0,n).trim()+'…' : t;
}
function buscarConteudo(q, escopo){
  const nq = normBusca(q).trim();
  if(nq.length < 2) return {subs:[], cards:[]};
  let temas;
  if(escopo==='estagio') temas = decksDaTrilha('estagio');
  else if(escopo==='residencia') temas = revUnlocked() ? decksDaTrilha('residencia') : [];
  else temas = visibleDecks();
  const subs = [], cards = [];
  for(const t of temas){
    for(const s of t.subs){
      if(subs.length<12 && normBusca(s.nome).includes(nq))
        subs.push({t, s, liberado: subLiberado(s.id)});
      for(const c of s.cards){
        if(cards.length>=20) continue;
        if(normBusca(c.f).includes(nq) || normBusca(c.v).includes(nq)){
          const cc = {...c, cid:c.id, deck:t, sub:s};
          cards.push({c:cc, liberado: cartaLiberada(cc)});
        }
      }
    }
  }
  return {subs, cards};
}
function buscaResultadosHtml(r, q){
  if(!r.subs.length && !r.cards.length)
    return '<p class="busca-vazio">Nada encontrado para "'+esc(q)+'".</p>';
  let h = '';
  if(r.subs.length){
    h += '<div class="busca-grupo"><span class="busca-grupo-t">Subtemas</span>'
      + r.subs.map(x => '<div class="busca-item'+(x.liberado?'':' trancado')+'">'
          + '<div class="bi-info"><b>'+esc(x.s.nome)+'</b><span>'+x.t.ic+' '+esc(x.t.nome)+' · '+x.s.cards.length+' cartas</span></div>'
          + (x.liberado
              ? '<button class="btn btn-sm" onclick="startStudy(\'sub:'+x.s.id+'\')">Estudar</button>'
              : '<button class="btn-o btn-sm" onclick="nav(\'premium\')">⭐ Premium</button>')
          + '</div>').join('')
      + '</div>';
  }
  if(r.cards.length){
    h += '<div class="busca-grupo"><span class="busca-grupo-t">Flashcards</span>'
      + r.cards.map(x => {
          const c = x.c;
          return '<div class="busca-item'+(x.liberado?'':' trancado')+'">'
            + '<div class="bi-info"><b>'+(x.liberado ? esc(snippetTxt(c.f,90)) : '🔒 Flashcard bloqueado')+'</b>'
            + '<span>'+c.deck.ic+' '+esc(c.deck.nome)+' · '+esc(c.sub.nome)+'</span></div>'
            + (x.liberado
                ? '<button class="btn-o btn-sm" onclick="openBuscaCard(\''+c.cid+'\')">Ver</button>'
                : '<button class="btn-o btn-sm" onclick="nav(\'premium\')">⭐ Premium</button>')
            + '</div>';
        }).join('')
      + '</div>';
  }
  return h;
}
/* Digitar não pode chamar render() (recriaria o <input> e perderia o foco/
   cursor) — só atualizamos o container de resultados via innerHTML direto,
   com um pequeno debounce pra não recalcular a cada tecla. */
function onBuscaInput(escopo, v){
  buscaQ[escopo] = v;
  clearTimeout(buscaTimers[escopo]);
  buscaTimers[escopo] = setTimeout(()=>renderBuscaResultados(escopo), 150);
}
function renderBuscaResultados(escopo){
  const el = document.getElementById('busca-res-'+escopo);
  if(!el) return;
  const q = buscaQ[escopo]||'';
  el.innerHTML = normBusca(q).trim().length<2 ? '' : buscaResultadosHtml(buscarConteudo(q, escopo), q);
}
function buscaBoxHtml(escopo, placeholder){
  const q = buscaQ[escopo] || '';
  const res = normBusca(q).trim().length>=2 ? buscaResultadosHtml(buscarConteudo(q, escopo), q) : '';
  return '<div class="busca-box">'
    + '<input type="text" class="busca-input" id="busca-input-'+escopo+'" value="'+esc(q)+'" placeholder="'+esc(placeholder)+'" oninput="onBuscaInput(\''+escopo+'\',this.value)">'
    + '<div class="busca-res" id="busca-res-'+escopo+'">'+res+'</div>'
    + '</div>';
}
function openBuscaCard(cid){
  const c = cardById(cid);
  if(!c || !cartaLiberada(c)){ nav('premium'); return; }
  showModal('<div class="tr-modal" style="text-align:left">'
    + '<div class="dk">'+c.deck.ic+' '+esc(c.deck.nome)+' · '+esc(c.sub.nome)+'</div>'
    + '<div class="st-q" style="margin-top:10px">'+cFront(c)+'</div>'
    + '<div class="st-a" style="margin-top:14px"><div class="lb">Resposta</div><div class="tx">'+cBack(c)+'</div></div>'
    + '<div class="mdl-row" style="margin-top:16px;justify-content:center">'
    + '<button class="btn-o btn-sm" onclick="closeModal()">Fechar</button>'
    + '<button class="btn btn-sm" onclick="closeModal();startStudy(\'sub:'+c.sub.id+'\')">Estudar este subtema</button>'
    + '</div></div>');
}

/* ================= PLANO DE ESTUDO (v27) ================= */
const PLANO_PADRAO = { meta:40, dias:[0,1,2,3,4,5,6], prova:null, prioridade:[] };
const DIAS_NOMES = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const DIAS_LONGOS = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'];

function plano(){ return Object.assign({}, PLANO_PADRAO, prog.plano||{}); }
function salvarPlano(p){ prog.plano = Object.assign(plano(), p); saveProg(); }
function ehDiaDeEstudo(d=new Date()){ return plano().dias.includes(d.getDay()); }
function feitoHoje(){ return (prog.log[todayKey()]||{}).rev||0; }
function metaHoje(){ return ehDiaDeEstudo() ? plano().meta : 0; }
/* quanto ainda cabe hoje; em dia de folga o app não bloqueia, só não sugere */
function restanteHoje(){ return Math.max(0, metaHoje() - feitoHoje()); }

/* fração da meta que sobra para cartas NOVAS, medida no histórico real do aluno */
function fatorNovas(){
  const ds = Object.keys(prog.log).sort().slice(-14);
  let rev=0, nov=0;
  for(const d of ds){ rev += prog.log[d].rev||0; nov += prog.log[d].nov||0; }
  if(rev < 60) return 0.6;                       // história curta: estimativa inicial
  return Math.max(0.15, Math.min(1, nov/rev));
}
function novasPorDiaEstimadas(){ return Math.max(1, Math.round(plano().meta * fatorNovas())); }

/* ---- prioridade: primeiro a escolha manual do aluno (plano().prioridade),
   na ordem que ele arrumou; o resto continua pelo peso do subtema (5→1) e
   pela ordem didática do app, como sempre foi. */
function subsPriorizados(){
  const out=[];
  visibleDecks().forEach((t,ti)=>t.subs.forEach((s,si)=>{
    const elegiveis = ehPremium() ? s.cards : (t.fs===s.id ? cartasLivresDoSub(s) : []);
    const nov = elegiveis.filter(c=>!prog.cards[c.id]).length;
    if(!ehPremium() && !elegiveis.length) return;
    out.push({t, s, peso: s.p||3, nov, ordem: ti*1000+si});
  }));
  const prior = plano().prioridade || [];
  const idxPrior = id => { const i = prior.indexOf(id); return i<0 ? Infinity : i; };
  out.sort((a,b)=>{
    const pa = idxPrior(a.s.id), pb = idxPrior(b.s.id);
    if(pa!==pb) return pa-pb;
    return b.peso-a.peso || a.ordem-b.ordem;
  });
  return out;
}
function pendentesPriorizados(){ return subsPriorizados().filter(x=>x.nov>0); }
function novasRestantes(){ return pendentesPriorizados().reduce((a,x)=>a+x.nov,0); }

/* cartas novas na ordem do plano: peso primeiro, ordem didática dentro do subtema */
function novasNaOrdemDoPlano(limite){
  const out=[];
  for(const x of subsPriorizados()){
    const cards = ehPremium() ? x.s.cards : (x.t.fs===x.s.id ? cartasLivresDoSub(x.s) : []);
    for(const c of cards) if(!prog.cards[c.id]){
      out.push({...c, cid:c.id, deck:x.t, sub:x.s});
      if(out.length>=limite) return out;
    }
  }
  return out;
}

/* ---- projeções ---- */
function diasDeEstudoAte(dataISO){
  const alvo = new Date(dataISO+'T12:00:00'); if(isNaN(alvo)) return null;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  let n=0; const d=new Date(hoje);
  while(d <= alvo){ if(plano().dias.includes(d.getDay())) n++; d.setDate(d.getDate()+1); }
  return n;
}
function diasCorridosAte(dataISO){
  const alvo = new Date(dataISO+'T12:00:00'); if(isNaN(alvo)) return null;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  return Math.ceil((alvo-hoje)/864e5);
}
function previsao(){
  const p = plano(), rest = novasRestantes(), porDia = novasPorDiaEstimadas();
  if(!p.dias.length) return {impossivel:true, rest};
  const diasEstudo = Math.ceil(rest/porDia);
  const corridos = Math.ceil(diasEstudo * 7 / p.dias.length);
  const fim = new Date(); fim.setDate(fim.getDate()+corridos);
  return {rest, porDia, diasEstudo, corridos, fim};
}
function diagnosticoProva(){
  const p = plano(); if(!p.prova) return null;
  const diasEstudo = diasDeEstudoAte(p.prova), corridos = diasCorridosAte(p.prova);
  if(diasEstudo===null) return null;
  const rest = novasRestantes(), f = fatorNovas();
  const capacidade = Math.round(diasEstudo * p.meta * f);
  const precisaPorDia = diasEstudo>0 ? Math.ceil(rest/(diasEstudo*f)) : Infinity;
  return {corridos, diasEstudo, rest, capacidade, precisaPorDia, cabe: capacidade>=rest};
}

/* ---- cronograma dia a dia ---- */
function proximosDias(n){
  const p = plano(), out=[]; const d=new Date(); d.setHours(0,0,0,0);
  for(let i=0; out.length<n && i<180; i++, d.setDate(d.getDate()+1))
    if(p.dias.includes(d.getDay())) out.push(new Date(d));
  return out;
}
function cronograma(nDias){
  const dias = proximosDias(nDias), cap = novasPorDiaEstimadas();
  const fila = pendentesPriorizados().map(x=>({nome:x.t.ic+' '+x.s.nome, peso:x.peso, restam:x.nov}));
  let fi=0;
  return dias.map(d=>{
    let vaga = cap; const blocos=[];
    while(vaga>0 && fi<fila.length){
      const f=fila[fi], leva=Math.min(vaga, f.restam);
      blocos.push({nome:f.nome, peso:f.peso, n:leva});
      f.restam-=leva; vaga-=leva;
      if(f.restam===0) fi++;
    }
    return {d, blocos};
  });
}

/* ================= NAV APP ================= */
const NAV = [
  {id:'dashboard', ic:'🏠', lb:'Início',        mb:'Início'},
  {sec:'Temas'},
  {id:'decks',     ic:'🎓', lb:'CT Estágio',    mb:'Estágio',    sub:1},
  {id:'decksr',    ic:'🏥', lb:'CT Residência', mb:'Resid.', sub:1},
  {id:'meus',      ic:'✏️', lb:'Meus flashcards', mb:'Meus'},
  {id:'plano',     ic:'📅', lb:'Meu plano',     mb:'Plano'},
  {id:'premium',   ic:'⭐', lb:'CT Premium',     mb:'Premium'},
  {id:'stats',     ic:'📊', lb:'Estatísticas',  mb:'Stats'},
  {id:'perfil',    ic:'👤', lb:'Perfil',        mb:'Perfil'}
];
function renderNav(){
  const items = NAV.concat(isAdmin()? [{id:'admin', ic:'🛠️', lb:'Admin', mb:'Admin'}] : []);
  /* streak ao lado de "Início" — recalculado toda vez que a lateral é
     desenhada de novo (login, troca de tela, fim de sessão...), então basta
     ler prog.log de novo aqui para acompanhar sozinho a virada do dia,
     sem nenhum relógio/temporizador próprio. */
  const s = streak();
  const streakTxt = s>0 ? ' <span class="nav-streak" title="'+s+' dia'+(s===1?'':'s')+' seguidos de estudo">🔥'+s+'</span>' : '';
  const mk = cls => items.map(n=>{
    if(n.sec) return cls==='mob' ? '' : '<span class="nav-sec">'+esc(n.sec)+'</span>';
    const lock = (n.id==='decksr' && !revUnlocked()) ? '<span class="nlk">🔒</span>' : '';
    const fogo = n.id==='dashboard' ? streakTxt : '';
    return '<button class="'+(curView===n.id?'on ':'')+(n.sub?'sub':'')+'" onclick="nav(\''+n.id+'\')"><span class="nic">'+n.ic+'</span> '
      + (cls==='mob' ? '<span>'+n.mb+fogo+'</span>' : n.lb+lock+fogo) + '</button>';
  }).join('');
  $('nav-desk').innerHTML = mk('desk');
  $('nav-mob').innerHTML = mk('mob');
}
async function nav(v){
  if(session && v!=='study'){
    if(!(await ask({title:'Encerrar a sessão?', texto:'As cartas que você já respondeu ficam salvas.', okLb:'Encerrar'}))) return;
    session=null;
  }
  curView=v; renderNav(); render();
  window.scrollTo(0,0);
}

/* ================= VIEWS ================= */
function render(){
  const V = $('view');
  if(curView==='dashboard') V.innerHTML = vDashboard();
  else if(curView==='decks') V.innerHTML = vDecks('estagio');
  else if(curView==='decksr') V.innerHTML = vDecks('residencia');
  else if(curView==='meus') V.innerHTML = vMeus();
  else if(curView==='plano') V.innerHTML = vPlano();
  else if(curView==='premium') V.innerHTML = vPremium();
  else if(curView==='trofeus') V.innerHTML = vTrofeus();
  else if(curView==='stats') V.innerHTML = vStats();
  else if(curView==='sessao') V.innerHTML = vSessaoStats();
  else if(curView==='perfil') V.innerHTML = vPerfil();
  else if(curView==='admin') V.innerHTML = vAdmin();
  else if(curView==='study') V.innerHTML = vStudy();
}

function greeting(){
  const h=new Date().getHours();
  return h<5?'Boa madrugada':h<12?'Bom dia':h<18?'Boa tarde':'Boa noite';
}
function streak(){
  let s=0; const d=new Date();
  if(!(prog.log[todayKey(d)]||{}).rev) d.setDate(d.getDate()-1);
  while((prog.log[todayKey(d)]||{}).rev){ s++; d.setDate(d.getDate()-1); }
  return s;
}
function globalCounts(){
  const now=Date.now(); let nov=0,due=0,done=0,seen=0;
  for(const c of allCards()){
    const cs=prog.cards[c.cid];
    if(!cs){nov++;continue}
    seen++;
    if(cs.due<=now) due++;
    else if((cs.iv||0)>=21) done++;
  }
  return {nov,due,done,seen};
}

function vDashboard(){
  const g=globalCounts();
  const p=plano(), diaOk=ehDiaDeEstudo();
  const revHoje = (prog.log[todayKey()]||{}).rev||0;
  const teto = diaOk ? restanteHoje() : Math.max(0, p.meta - revHoje);
  const devidas = Math.min(g.due, teto);
  const novHoje = Math.min(g.nov, Math.max(0, teto - devidas));
  const total = devidas + novHoje;
  let h = '<h1 class="pg-t">'+greeting()+', '+esc(user.nome.split(/\s+/)[0])+' 👋</h1>'
    + '<p class="pg-s">'+(total? 'Você tem <b style="color:var(--blue)">'+total+' carta'+(total>1?'s':'')+'</b> esperando por você hoje.' : 'Tudo em dia por enquanto. Volte mais tarde para as próximas revisões.')+'</p>';
  h += buscaBoxHtml('all', '🔍 Buscar subtema ou palavra-chave em todos os flashcards…');
  h += '<div class="study-cta"><div><h3>Sessão de hoje</h3><p>'
    + (diaOk
        ? devidas+' para revisar · '+novHoje+' novas · meta de '+p.meta+'/dia ('+revHoje+' feitas)'
        : 'Hoje é seu dia de descanso 🌙 — se quiser adiantar, é só começar')
    + ' · <button class="lnk" onclick="nav(\'plano\')">ajustar plano</button></p></div>'
    + (total? '<button class="btn" style="padding:13px 30px" onclick="startStudy(\'all\')">▶ Estudar agora</button>'
            : (diaOk && g.due+g.nov
               ? '<span class="badge" style="border-color:rgba(76,175,135,.4);color:var(--green);background:rgba(76,175,135,.1)">✓ Meta cumprida</span>'
               : '<span class="badge" style="border-color:rgba(76,175,135,.4);color:var(--green);background:rgba(76,175,135,.1)">✓ Em dia</span>'))
    + '</div>';
  h += '<div class="tile-row" style="margin-top:22px">'
    + '<div class="tile gold"><b>'+streak()+' 🔥</b><span>dias seguidos</span></div>'
    + '<div class="tile blue"><b>'+revHoje+'</b><span>revisões hoje</span></div>'
    + '<div class="tile green"><b>'+g.done+'</b><span>cartas dominadas</span></div>'
    + '<div class="tile"><b>'+g.seen+'/'+totalCards()+'</b><span>cartas estudadas</span></div>'
    + '</div>';
  const pub = visibleDecks().filter(t=>!t.restrito), res = visibleDecks().filter(t=>t.restrito);
  h += '<h2 class="sec-t">🎓 CT Estágio</h2><div class="deck-grid">'+pub.map(themeCardHtml).join('')+'</div>';
  if(res.length) h += '<h2 class="sec-t">🏥 CT Residência</h2><div class="deck-grid">'+res.map(themeCardHtml).join('')+'</div>';
  return h;
}

function themeCardHtml(t){
  const c=countsFor(cardsOfTheme(t.id));
  const pct = Math.round((c.total-c.nov)/c.total*100);
  /* "Estudar tema" não é mais rateado pela meta diária (buildSession) — o
     botão precisa refletir isso: há algo para estudar aqui sempre que houver
     revisão vencida ou carta nova, mesmo que a meta do dia já tenha sido
     batida em outro tema. */
  const canStudy = c.due + c.nov > 0;
  /* Temas sem cartas de base (ex.: "Atualizações", v35 — número de cartas por
     subtema varia e pode não ter as 6 cartas de base clássicas) não mostram o
     botão de revisão rápida, em vez de mostrar "0 cartas" sem nenhuma função. */
  const nBase = contaBase('base:tema:'+t.id);
  return '<div class="deckc"><div class="hd"><div class="dic">'+t.ic+'</div><div><h3>'+esc(t.nome)+'</h3><span class="cnt">'+t.subs.length+' subtemas · '+c.total+' flashcards</span></div></div>'
    + '<div class="nums"><span class="n-new"><b>'+c.nov+'</b> novas</span><span class="n-due"><b>'+c.due+'</b> a revisar</span><span class="n-done"><b>'+c.done+'</b> dominadas</span></div>'
    + '<div class="pbar"><i style="width:'+pct+'%"></i></div>'
    + '<div style="display:flex;gap:8px">'
    + '<button class="btn btn-sm" style="flex:1" '+(canStudy?'':'disabled style="opacity:.45;cursor:default;flex:1" ')+'onclick="startStudy(\'tema:'+t.id+'\')">Estudar tema</button>'
    + '<button class="btn-o btn-sm" onclick="nav(\'decks\');setTimeout(()=>{const el=document.getElementById(\'tb-'+t.id+'\');if(el)el.scrollIntoView({behavior:\'smooth\',block:\'start\'})},60)">Subtemas</button>'
    + '</div>'
    + (nBase ? '<button class="btn-base" onclick="startStudy(\'base:tema:'+t.id+'\')" title="As cartas de base de cada subtema deste tema">⚡ Revisão rápida <span>'+nBase+' cartas</span></button>' : '')
    + '</div>';
}

function vDecks(tr){
  const T = TRILHAS[tr];
  const trancada = tr==='residencia' && !revUnlocked();
  const lista = trancada ? [] : decksDaTrilha(tr);
  const nS = lista.reduce((a,t)=>a+t.subs.length,0);
  const nC = lista.reduce((a,t)=>a+t.subs.reduce((b,s)=>b+s.cards.length,0),0);
  let h = '<h1 class="pg-t">'+T.ic+' '+T.nome+'</h1><p class="pg-s">'+esc(T.desc)+'</p>';
  if(trancada){
    const ex = DECKS.filter(t=>t.restrito);
    return h + lockCardHtml()
      + '<h2 class="sec-t">O que você libera com a senha</h2><div class="deck-grid">'
      + ex.map(t=>'<div class="deckc"><div class="hd"><div class="dic">'+t.ic+'</div><div><h3>'+esc(t.nome)+'</h3>'
          + '<span class="cnt">'+t.subs.length+' subtemas · '+t.subs.reduce((a,s)=>a+s.cards.length,0)+' flashcards</span></div></div>'
          + '<p style="color:var(--txt2);font-size:13px">'+esc(t.desc)+'</p></div>').join('')
      + '</div>'
      + '<p class="pg-s" style="margin-top:18px">Mais os '+DECKS.filter(t=>!t.restrito).reduce((a,t)=>a+t.subs.reduce((b,s)=>b+s.cards.length,0),0)
      + ' flashcards do CT Estágio, que continuam abertos para você.</p>';
  }
  h += buscaBoxHtml(tr, '🔍 Buscar subtema ou palavra-chave no '+T.nome+'…');
  if(tr==='residencia') h += lockCardHtml();
  h += '<p class="pg-s" style="margin:'+(tr==='residencia'?'20px':'0')+' 0 22px">'
    + lista.length+' temas · '+nS+' subtemas · '+nC+' flashcards.</p>';
  if(!ehPremium()) h += '<div class="plan-box"><b>Você está no plano gratuito.</b> Dá para ver o app inteiro e estudar '
    + totalLivres()+' flashcards — um subtema liberado por área, marcado com <span class="sr-tag free">grátis</span> abaixo — além dos baralhos que você mesmo criar.'
    + '<div class="lst-acoes" style="margin-top:12px"><button class="btn btn-sm" onclick="nav(\'premium\')">⭐ Ver o CT Premium</button></div></div>';
  const excl = lista.filter(t=>t.restrito);
  for(const t of lista){
    if(tr==='residencia' && excl.length && t===lista.find(x=>!x.restrito))
      h += '<h2 class="sec-t">Inclui também tudo do CT Estágio</h2>';
    const c=countsFor(cardsOfTheme(t.id));
    const pct = Math.round((c.total-c.nov)/c.total*100);
    const canTheme = c.due + c.nov > 0;  // idem themeCardHtml() — ver comentário lá
    h += '<div class="theme-block" id="tb-'+t.id+'">'
      + '<div class="theme-head"><div class="dic">'+t.ic+'</div>'
      + (t.restrito ? '<span class="badge-gold">Restrito</span>' : '')
      + '<div class="th-info"><h3>'+esc(t.nome)+'</h3><p>'+esc(t.desc)+'</p></div>'
      + (!ehPremium() && !t.fs
          ? '<button class="btn-o btn-sm" onclick="nav(\'premium\')">⭐ Premium</button>'
          : '<button class="btn btn-sm" '+(canTheme?'':'disabled style="opacity:.45;cursor:default" ')+'onclick="startStudy(\'tema:'+t.id+'\')">Estudar tema</button>')+'</div>'
      + '<div class="pbar" style="margin:10px 0 14px"><i style="width:'+pct+'%"></i></div>'
      + t.subs.map(s=>{
          const sc=countsFor(cardsOfSub(s.id));
          const spct=Math.round((sc.total-sc.nov)/sc.total*100);
          const can = sc.due + sc.nov > 0;  // idem themeCardHtml() — ver comentário lá
          const amostra = !ehPremium() && t.fs===s.id;
          const trancado = !ehPremium() && !amostra;
          const selo = amostra ? '<span class="sr-tag free">'+Math.min(FREE_CARDS,s.cards.length)+' grátis</span>'
                     : trancado ? '<span class="sr-tag lock">⭐</span>' : '';
          /* Subtemas sem cartas de base (ex.: "Atualizações", v35) não mostram
             o botão "⚡ Base" — não existe um lote de 6 cartas fixas ali. */
          const nBaseSub = contaBase('base:sub:'+s.id);
          return '<div class="sub-row'+(trancado?' trancado':'')+'"><div class="sr-name"><b>'+esc(s.nome)+'</b>'+selo+'<span>'+sc.total+' cartas</span></div>'
            + '<div class="sr-nums"><span class="n-new"><b>'+sc.nov+'</b> novas</span><span class="n-due"><b>'+sc.due+'</b> a revisar</span><span class="n-done"><b>'+sc.done+'</b> dominadas</span></div>'
            + '<div class="pbar sr-bar"><i style="width:'+spct+'%"></i></div>'
            + (trancado
                ? '<button class="btn-o btn-sm" onclick="nav(\'premium\')">⭐ Premium</button>'
                : '<button class="btn btn-sm" '+(can?'':'disabled style="opacity:.45;cursor:default" ')+'onclick="startStudy(\'sub:'+s.id+'\')">Estudar</button>'
                + (nBaseSub ? '<button class="btn-base sr-base" onclick="startStudy(\'base:sub:'+s.id+'\')" title="As 6 cartas de base deste subtema">⚡ Base</button>' : ''))+'</div>';
        }).join('')
      + '</div>';
  }
  if(tr==='estagio' && hasRestrito() && !revUnlocked())
    h += '<div class="lockcard"><h3>🏥 Quer o conteúdo completo?</h3>'
      + '<p>A trilha <b>CT Residência</b> abre todos os flashcards do app — Cirurgia, Ginecologia e Obstetrícia, Pediatria e Medicina Preventiva, além de tudo daqui.</p>'
      + '<button class="btn" style="margin-top:12px" onclick="nav(\'decksr\')">Ver CT Residência</button></div>';
  return h;
}

function lockCardHtml(){
  if(!hasRestrito()) return '';
  const n = DECKS.filter(t=>t.restrito);
  const cards = DECKS.reduce((a,t)=>a+t.subs.reduce((b,s)=>b+s.cards.length,0),0);
  const subs = DECKS.reduce((a,t)=>a+t.subs.length,0);
  if(revUnlocked()) return '<div class="lockcard"><h3>🔓 CT Residência liberado</h3>'
    + '<p>Acesso completo: '+DECKS.length+' temas · '+subs+' subtemas · '+cards+' flashcards. Exclusivos desta trilha: '+n.map(t=>esc(t.nome)).join(' · ')+'.</p>'
    + '<button class="btn-o btn-sm" style="margin-top:12px" onclick="revLock()">Bloquear novamente</button></div>';
  return '<div class="lockcard"><h3>🔒 CT Residência — acesso restrito</h3>'
    + '<p>Trilha completa com os '+cards+' flashcards do app, incluindo Cirurgia, Ginecologia e Obstetrícia, Pediatria e Medicina Preventiva — com tabelas e fluxogramas. Liberada pela senha fornecida pelo CT.</p>'
    + '<button class="btn" style="margin-top:12px" onclick="revPrompt()">Tenho o código de acesso</button></div>';
}
async function revPrompt(){
  const c = await ask({title:'🏥 CT Residência', texto:'Digite a senha de acesso fornecida pelo CT para liberar a trilha completa.', senha:true, ph:'Senha de acesso', okLb:'Liberar acesso'});
  if(c===null) return;
  if(!c){ toast('Digite a senha.'); return; }
  if(RES_HASHES.includes(await hash('fcct-rev|'+c))){
    store.set(K_REV,'1'); toast('CT Residência liberado 🔓'); curView='decksr'; renderNav(); render();
  } else toast('Código inválido.');
}
function revLock(){ store.del(K_REV); toast('CT Residência bloqueado.'); renderNav(); render(); }

/* ================= STREAK & TROFÉUS (v29) =================
   Reaproveita o que já existe: streak() deriva de prog.log (dias consecutivos
   com pelo menos uma revisão), então a sequência já é persistente, não conta o
   mesmo dia duas vezes e reinicia sozinha ao pular um dia. Aqui entram os
   marcos, a coleção e o resgate. */

const MARCOS = [
  {d:3,   m:'Entusiasta',            f:'Entusiasta'},
  {d:5,   m:'Iniciante Dedicado',    f:'Iniciante Dedicada'},
  {d:10,  m:'Estudante Aplicado',    f:'Estudante Aplicada'},
  {d:15,  m:'CDF da Turma',          f:'CDF da Turma'},
  {d:20,  m:'Estudante Incansável',  f:'Estudante Incansável'},
  {d:25,  m:'Mente em Expansão',     f:'Mente em Expansão'},
  {d:30,  m:'Mestre dos Flashcards', f:'Mestra dos Flashcards'},
  {d:40,  m:'Especialista',          f:'Especialista'},
  {d:50,  m:'Mestre do Conhecimento',f:'Mestra do Conhecimento'},
  {d:60,  m:'Elite Acadêmica',       f:'Elite Acadêmica'},
  {d:70,  m:'Lenda dos Estudos',     f:'Lenda dos Estudos'},
  {d:80,  m:'Mestre Supremo',        f:'Mestra Suprema'},
  {d:90,  m:'Grão-Mestre',           f:'Grã-Mestra'},
  {d:100, m:'Lenda Suprema',         f:'Lenda Suprema'}
];

/* ---- gênero: inferido do primeiro nome, ajustável pelo aluno ---- */
const NOMES_F_EXC = ['isabel','raquel','ester','esther','miriam','ruth','carmen','ines','inês','jaqueline','jacqueline','beatriz','ingrid','yasmin','jasmin','elis','lais','laís','iris','íris','mariel','abigail','soraya','doris','marlene','marisol','nicole','michele','michelle','rachel','rebeca','sarah','sara','sol','liz','isis','ísis','cris','val','flor'];
const NOMES_M_EXC = ['luca','noa','joshua','elias','jonas','tobias','matias','mathias','nicola','andrea','sasha','juca','cosme','jeremias','isaias','isaías','zacarias','ozias','dimas','tomas','tomás','lucas','messias'];
function inferirGenero(nome){
  const n = String(nome||'').trim().split(/\s+/)[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  if(!n) return 'm';
  if(NOMES_M_EXC.includes(n)) return 'm';
  if(NOMES_F_EXC.includes(n)) return 'f';
  if(/a$/.test(n)) return 'f';
  if(/(ice|ete|ine|elle|ete|is)$/.test(n) && NOMES_F_EXC.includes(n)) return 'f';
  return 'm';
}
function genero(){ return prog.genero || inferirGenero(user && user.nome); }
function setGenero(g){
  if(typeof nuvemSalvarPerfil === 'function' && nuvemLigada()) nuvemSalvarPerfil({genero:g}); prog.genero = g; saveProg(); toast(g==='f'?'Troféus no feminino.':'Troféus no masculino.'); render(); }
function nomeMarco(mc){ return genero()==='f' ? mc.f : mc.m; }

/* ---- streak: atual, recorde e histórico, tudo derivado de prog.log ---- */
function diasEstudados(){ return Object.keys(prog.log||{}).filter(k=>(prog.log[k]||{}).rev).sort(); }
function estudouEm(k){ return !!((prog.log||{})[k]||{}).rev; }
function melhorStreak(){
  const ds = diasEstudados(); if(!ds.length) return 0;
  let melhor=1, atual=1;
  for(let i=1;i<ds.length;i++){
    const ant=new Date(ds[i-1]+'T12:00:00'), hoje=new Date(ds[i]+'T12:00:00');
    atual = Math.round((hoje-ant)/864e5)===1 ? atual+1 : 1;
    if(atual>melhor) melhor=atual;
  }
  return melhor;
}
function streakInfo(){
  const at = streak(), me = Math.max(melhorStreak(), at);
  const prox = MARCOS.find(x=>x.d>at) || null;
  const ultimo = MARCOS.filter(x=>x.d<=at).pop() || null;
  return {atual:at, melhor:me, dias:diasEstudados().length, prox, ultimo,
          faltam: prox ? prox.d-at : 0,
          hojeOk: estudouEm(todayKey())};
}
/* últimos 7 dias, para a fita do perfil */
function fitaStreak(){
  const out=[]; const d=new Date();
  for(let i=6;i>=0;i--){ const x=new Date(); x.setDate(d.getDate()-i);
    out.push({k:todayKey(x), n:['D','S','T','Q','Q','S','S'][x.getDay()], on:estudouEm(todayKey(x))}); }
  return out;
}

/* ---- troféus conquistados e resgatados ---- */
function trofeusMap(){ if(!prog.trofeus || typeof prog.trofeus!=='object') prog.trofeus={}; return prog.trofeus; }
function conquistado(dias){ return streakInfo().melhor >= dias; }
function resgatado(dias){ return !!trofeusMap()[String(dias)]; }
function pendentes(){ return MARCOS.filter(mc=>conquistado(mc.d) && !resgatado(mc.d)); }
function resgatar(dias){
  trofeusMap()[String(dias)] = Date.now();
  saveProg();
}

/* ---- Desenho dos troféus ------------------------------------------------
   Cada marco monta o troféu por CAMADAS que realmente mudam: número de
   degraus do pedestal, formato e tamanho da taça, tipo de alça, coroa, asas,
   coroa de louros, gemas, raios e brilho. Não é a mesma peça repintada. */
const PALETAS = {
  bronze:  {a:'#c98a4b', b:'#8a5522', c:'#e8b57c', luz:'#f6dcbb'},
  cobre:   {a:'#d4915a', b:'#93582a', c:'#f0c193', luz:'#fbe6ce'},
  prata:   {a:'#cfd8e3', b:'#8b9bad', c:'#eef3f8', luz:'#ffffff'},
  ouro:    {a:'#e0b34c', b:'#a97c22', c:'#f5dc93', luz:'#fff6d8'},
  platina: {a:'#e9f0f8', b:'#8fa6c0', c:'#ffffff', luz:'#ffffff'},
  realeza: {a:'#8b6fd4', b:'#4a3288', c:'#c8b4f5', luz:'#efe6ff'},
  celeste: {a:'#f5d982', b:'#b8891a', c:'#fff8dc', luz:'#ffffff'}
};

/* especificação de cada marco: o que ele ganha em relação ao anterior */
const DESENHO = {
  3:  {pal:'bronze',    esc:0.50, degraus:1, taca:0, alca:0, colar:0, coroa:0, asas:0, louro:0, gemas:0, raios:0, glow:0, brilhos:0, placa:0},
  5:  {pal:'bronze',    esc:0.58, degraus:1, taca:0, alca:1, colar:0, coroa:0, asas:0, louro:0, gemas:0, raios:0, glow:0, brilhos:0, placa:1},
  10: {pal:'cobre',     esc:0.66, degraus:2, taca:1, alca:1, colar:1, coroa:0, asas:0, louro:0, gemas:1, raios:0, glow:0, brilhos:0, placa:1},
  15: {pal:'cobre',     esc:0.72, degraus:2, taca:1, alca:2, colar:1, coroa:0, asas:0, louro:1, gemas:1, raios:0, glow:0, brilhos:0, placa:1},
  20: {pal:'prata',     esc:0.78, degraus:2, taca:1, alca:2, colar:2, coroa:0, asas:0, louro:1, gemas:2, raios:0, glow:0, brilhos:0, placa:1},
  25: {pal:'prata',     esc:0.83, degraus:3, taca:2, alca:2, colar:2, coroa:1, asas:0, louro:1, gemas:2, raios:0, glow:0, brilhos:1, placa:1},
  30: {pal:'prata',     esc:0.88, degraus:3, taca:2, alca:3, colar:2, coroa:1, asas:0, louro:2, gemas:3, raios:0, glow:0, brilhos:1, placa:1},
  40: {pal:'ouro',      esc:0.92, degraus:3, taca:2, alca:3, colar:3, coroa:1, asas:1, louro:2, gemas:3, raios:1, glow:0, brilhos:1, placa:1},
  50: {pal:'ouro',      esc:0.96, degraus:3, taca:2, alca:3, colar:3, coroa:2, asas:1, louro:2, gemas:4, raios:1, glow:1, brilhos:2, placa:1},
  60: {pal:'platina',   esc:1.00, degraus:4, taca:3, alca:3, colar:3, coroa:2, asas:2, louro:2, gemas:5, raios:1, glow:1, brilhos:2, placa:1},
  70: {pal:'platina',   esc:1.04, degraus:4, taca:3, alca:4, colar:4, coroa:2, asas:2, louro:2, gemas:6, raios:2, glow:1, brilhos:3, placa:1},
  80: {pal:'realeza', esc:1.08, degraus:4, taca:3, alca:4, colar:4, coroa:3, asas:2, louro:2, gemas:7, raios:2, glow:1, brilhos:3, placa:1},
  90: {pal:'realeza', esc:1.12, degraus:4, taca:3, alca:4, colar:4, coroa:3, asas:2, louro:2, gemas:8, raios:2, glow:2, brilhos:4, placa:1},
  100:{pal:'celeste',   esc:1.18, degraus:4, taca:3, alca:4, colar:4, coroa:4, asas:2, louro:2, gemas:10,raios:3, glow:2, brilhos:5, placa:2}
};
const GEMAS_COR = ['#4fb0e8','#e0556b','#5ddba4','#a97ce0','#e8a13f','#e8556b','#4fb0e8','#5ddba4','#a97ce0','#f2d377'];

function trofeuSvg(dias, op){
  op = op || {};
  const D = DESENHO[dias], P = PALETAS[D.pal], u = 't'+dias+(op.sufixo||'');
  const k = D.esc;                                     // escala geral do troféu
  const cx = 70;                                       // eixo central
  const baseY = 156;                                   // chão
  const g = [];                                        // camadas, do fundo para a frente

  /* --- raios atrás da peça --- */
  if(D.raios){
    const n = D.raios===1 ? 8 : D.raios===2 ? 12 : 16;
    const r1 = 30*k, r2 = (D.raios===3?70:D.raios===2?60:48)*k, cy = 62;
    let raios='';
    for(let i=0;i<n;i++){
      const a = (Math.PI*2/n)*i - Math.PI/2;
      const w = 0.055;
      raios += '<path d="M'+(cx+Math.cos(a-w)*r1).toFixed(1)+' '+(cy+Math.sin(a-w)*r1).toFixed(1)
            + 'L'+(cx+Math.cos(a)*r2).toFixed(1)+' '+(cy+Math.sin(a)*r2).toFixed(1)
            + 'L'+(cx+Math.cos(a+w)*r1).toFixed(1)+' '+(cy+Math.sin(a+w)*r1).toFixed(1)+'Z"/>';
    }
    g.push('<g class="tr-raios" fill="url(#'+u+'ray)" opacity="'+(D.raios===3?.55:.38)+'">'+raios+'</g>');
  }

  /* --- asas: três penas ascendentes por lado, atrás da peça --- */
  if(D.asas){
    const _th2 = (D.taca===0?26:D.taca===1?31:D.taca===2?36:41)*k;
    const _base2 = baseY - (D.degraus===1?10:D.degraus===2?19:D.degraus===3?27:35) - (12 + D.taca*3);
    const ancY = _base2 - _th2*0.62;
    const s2 = D.asas===2 ? 1 : 0.7;
    const pena = (dir,i) => {
      const comp = (30 - i*6)*s2*k, alt = (26 - i*5)*s2*k, x0 = cx + dir*(10*k + i*2);
      return '<path d="M'+x0.toFixed(1)+' '+ancY.toFixed(1)
        + ' q'+(dir*comp*0.55).toFixed(1)+' -'+(alt*0.72).toFixed(1)+' '+(dir*comp).toFixed(1)+' -'+alt.toFixed(1)
        + ' q'+(dir*comp*0.06).toFixed(1)+' '+(alt*0.46).toFixed(1)+' '+(-dir*comp*0.34).toFixed(1)+' '+(alt*0.74).toFixed(1)
        + ' q'+(-dir*comp*0.40).toFixed(1)+' '+(alt*0.24).toFixed(1)+' '+(-dir*comp*0.32).toFixed(1)+' '+(alt*0.26).toFixed(1)+'Z"/>';
    };
    let asas='';
    for(let i=0;i<3;i++) asas += pena(1,i)+pena(-1,i);
    g.push('<g fill="url(#'+u+'met)" opacity="'+(D.asas===2?'.9':'.75')+'">'+asas+'</g>');
  }

  /* --- coroa de louros: arco que abraça a taça, aberto para cima --- */
  if(D.louro){
    const _tw = (D.taca===0?17:D.taca===1?21:D.taca===2?25:29)*k;
    const _th = (D.taca===0?26:D.taca===1?31:D.taca===2?36:41)*k;
    const _base = baseY - (D.degraus===1?10:D.degraus===2?19:D.degraus===3?27:35) - (12 + D.taca*3);
    const meio = _base - _th*0.5;
    const rx = _tw*1.16, ry = _th*0.62;
    const n = D.louro===2 ? 8 : 5;
    const ramo = dir => {
      let out='';
      for(let i=0;i<n;i++){
        const t = i/(n-1), ang = 0.30 + t*1.24;
        const px = cx + dir*Math.sin(ang)*rx, py = meio + Math.cos(ang)*ry;
        const rot = dir*(ang*180/Math.PI) - (dir>0?0:0);
        out += '<ellipse cx="'+px.toFixed(1)+'" cy="'+py.toFixed(1)+'" rx="'+(7.4*k).toFixed(1)+'" ry="'+(3.1*k).toFixed(1)
            + '" transform="rotate('+rot.toFixed(0)+' '+px.toFixed(1)+' '+py.toFixed(1)+')"/>';
      }
      return out;
    };
    const laco = '<path d="M'+(cx-_tw*0.30)+' '+(_base-_th*0.03)+' q'+(_tw*0.30)+' '+(_th*0.10)+' '+(_tw*0.60)+' 0" fill="none" stroke="url(#'+u+'met)" stroke-width="'+(2.6*k).toFixed(1)+'" stroke-linecap="round"/>';
    g.push('<g fill="url(#'+u+'met)" opacity="'+(D.louro===2?'.96':'.84')+'">'+ramo(1)+ramo(-1)+'</g>'+laco);
  }

  /* --- pedestal --- */
  let ped='';
  const degrausDef = [[34,10],[44,9],[54,8],[64,8]];
  let y = baseY;
  for(let i=0;i<D.degraus;i++){
    const [w,h] = degrausDef[i];
    const ww = w*k;
    y -= h;
    ped += '<rect x="'+(cx-ww/2).toFixed(1)+'" y="'+y+'" width="'+ww.toFixed(1)+'" height="'+h+'" rx="2" fill="url(#'+u+'ped)"/>';
    ped += '<rect x="'+(cx-ww/2).toFixed(1)+'" y="'+y+'" width="'+ww.toFixed(1)+'" height="2.2" rx="1" fill="'+P.c+'" opacity=".55"/>';
  }
  const topoPed = y;
  g.push('<g>'+ped+'</g>');

  /* --- placa gravada --- */
  if(D.placa){
    const pw = (D.placa===2?30:24)*k, ph = D.placa===2?9:7;
    g.push('<rect x="'+(cx-pw/2).toFixed(1)+'" y="'+(baseY-D.degraus*8-2)+'" width="'+pw.toFixed(1)+'" height="'+ph+'" rx="1.5" fill="url(#'+u+'pl)" stroke="'+P.b+'" stroke-width=".7"/>');
  }

  /* --- haste --- */
  const hasteAlt = 12 + D.taca*3;
  const taçaBase = topoPed - hasteAlt;
  g.push('<path d="M'+(cx-4*k)+' '+topoPed+' L'+(cx-2.4*k)+' '+taçaBase+' L'+(cx+2.4*k)+' '+taçaBase+' L'+(cx+4*k)+' '+topoPed+'Z" fill="url(#'+u+'met)"/>');
  g.push('<ellipse cx="'+cx+'" cy="'+topoPed+'" rx="'+(9*k).toFixed(1)+'" ry="'+(2.6*k).toFixed(1)+'" fill="url(#'+u+'met)"/>');

  /* --- taça --- */
  const tw = (D.taca===0?17:D.taca===1?21:D.taca===2?25:29)*k;   // meia-largura da boca
  const th = (D.taca===0?26:D.taca===1?31:D.taca===2?36:41)*k;   // altura
  const bocaY = taçaBase - th;
  let taca;
  if(D.taca===0)
    taca = 'M'+(cx-tw)+' '+bocaY+' L'+(cx+tw)+' '+bocaY+' L'+(cx+5*k)+' '+taçaBase+' L'+(cx-5*k)+' '+taçaBase+'Z';
  else if(D.taca===1)
    taca = 'M'+(cx-tw)+' '+bocaY+' L'+(cx+tw)+' '+bocaY+' Q'+(cx+tw*.86)+' '+(taçaBase-th*.18)+' '+(cx+6*k)+' '+taçaBase
         + ' L'+(cx-6*k)+' '+taçaBase+' Q'+(cx-tw*.86)+' '+(taçaBase-th*.18)+' '+(cx-tw)+' '+bocaY+'Z';
  else
    taca = 'M'+(cx-tw)+' '+bocaY+' L'+(cx+tw)+' '+bocaY
         + ' C'+(cx+tw)+' '+(bocaY+th*.52)+' '+(cx+tw*.5)+' '+(taçaBase-th*.06)+' '+(cx+7*k)+' '+taçaBase
         + ' L'+(cx-7*k)+' '+taçaBase
         + ' C'+(cx-tw*.5)+' '+(taçaBase-th*.06)+' '+(cx-tw)+' '+(bocaY+th*.52)+' '+(cx-tw)+' '+bocaY+'Z';
  g.push('<path d="'+taca+'" fill="url(#'+u+'cup)"/>');
  /* reflexo na taça */
  g.push('<path d="M'+(cx-tw*.62)+' '+(bocaY+th*.12)+' q'+(tw*.2)+' '+(th*.42)+' '+(tw*.06)+' '+(th*.66)
       + ' l'+(tw*.2)+' 0 q'+(tw*.1)+' -'+(th*.34)+' -'+(tw*.04)+' -'+(th*.66)+'Z" fill="'+P.luz+'" opacity=".3"/>');

  /* --- alças --- */
  if(D.alca){
    const ay = bocaY + th*.16, ah = th*(D.alca>=3?.5:.4), aw = (D.alca===1?11:D.alca===2?15:19)*k;
    const alca = dir => {
      if(D.alca<=2)
        return '<path d="M'+(cx+dir*tw*.98).toFixed(1)+' '+ay.toFixed(1)+' q'+(dir*aw).toFixed(1)+' 0 '+(dir*aw*.86).toFixed(1)+' '+(ah*.62).toFixed(1)
             + ' q'+(-dir*aw*.2).toFixed(1)+' '+(ah*.44).toFixed(1)+' '+(-dir*aw*.78).toFixed(1)+' '+(ah*.3).toFixed(1)+'" fill="none" stroke="url(#'+u+'met)" stroke-width="'+(4.4*k).toFixed(1)+'" stroke-linecap="round"/>';
      return '<path d="M'+(cx+dir*tw*.98).toFixed(1)+' '+ay.toFixed(1)+' q'+(dir*aw*1.1).toFixed(1)+' '+(-ah*.16).toFixed(1)+' '+(dir*aw).toFixed(1)+' '+(ah*.5).toFixed(1)
           + ' q'+(-dir*aw*.16).toFixed(1)+' '+(ah*.6).toFixed(1)+' '+(-dir*aw*.9).toFixed(1)+' '+(ah*.34).toFixed(1)
           + ' m'+(dir*aw*.62).toFixed(1)+' '+(-ah*.22).toFixed(1)+' q'+(dir*aw*.3).toFixed(1)+' '+(-ah*.2).toFixed(1)+' '+(dir*aw*.06).toFixed(1)+' '+(-ah*.4).toFixed(1)+'" fill="none" stroke="url(#'+u+'met)" stroke-width="'+(4*k).toFixed(1)+'" stroke-linecap="round"/>';
    };
    g.push(alca(1)+alca(-1));
  }

  /* --- colar / faixa gravada --- */
  if(D.colar){
    const cy2 = bocaY + th*(D.colar>=3?.46:.4), cw = tw*(D.taca>=2?.9:.94);
    g.push('<rect x="'+(cx-cw)+'" y="'+cy2+'" width="'+(cw*2)+'" height="'+(D.colar>=3?7:5)*k+'" fill="url(#'+u+'ped)" opacity=".9"/>');
    if(D.colar>=2){
      let pts=''; const n = D.colar>=4?5:3;
      for(let i=0;i<n;i++) pts += '<circle cx="'+(cx-cw*.6+i*(cw*1.2/(n-1))).toFixed(1)+'" cy="'+(cy2+(D.colar>=3?3.5:2.5)*k).toFixed(1)+'" r="'+(1.5*k).toFixed(1)+'" fill="'+P.luz+'" opacity=".85"/>';
      g.push(pts);
    }
  }

  /* --- gemas --- */
  if(D.gemas){
    const spots = [
      [cx, bocaY+th*.30, 4.4], [cx-tw*.52, bocaY+th*.24, 3.2], [cx+tw*.52, bocaY+th*.24, 3.2],
      [cx-tw*.30, bocaY+th*.52, 2.8], [cx+tw*.30, bocaY+th*.52, 2.8],
      [cx, topoPed+4, 3.0], [cx-16*k, baseY-D.degraus*8+2, 2.4], [cx+16*k, baseY-D.degraus*8+2, 2.4],
      [cx-tw*.74, bocaY+th*.08, 2.4], [cx+tw*.74, bocaY+th*.08, 2.4]
    ];
    let gem='';
    for(let i=0;i<Math.min(D.gemas, spots.length);i++){
      const [gx,gy,gr] = spots[i], r = gr*k, cor = GEMAS_COR[i%GEMAS_COR.length];
      gem += '<g><path d="M'+gx.toFixed(1)+' '+(gy-r).toFixed(1)+' L'+(gx+r).toFixed(1)+' '+gy.toFixed(1)
          + ' L'+gx.toFixed(1)+' '+(gy+r).toFixed(1)+' L'+(gx-r).toFixed(1)+' '+gy.toFixed(1)+'Z" fill="'+cor+'"/>'
          + '<path d="M'+gx.toFixed(1)+' '+(gy-r).toFixed(1)+' L'+(gx+r).toFixed(1)+' '+gy.toFixed(1)+' L'+gx.toFixed(1)+' '+gy.toFixed(1)+'Z" fill="#fff" opacity=".45"/></g>';
    }
    g.push(gem);
  }

  /* --- coroa --- */
  if(D.coroa){
    const pts = D.coroa===1?3:D.coroa===2?5:D.coroa===3?5:7;
    const cw = tw*(D.coroa>=3?1.0:.86), cyb = bocaY, alt = (D.coroa===1?9:D.coroa===2?13:D.coroa===3?16:20)*k;
    let d='M'+(cx-cw)+' '+cyb;
    for(let i=0;i<pts;i++){
      const x0 = cx-cw + (cw*2/pts)*i, x1 = x0 + (cw*2/pts)/2, x2 = x0 + (cw*2/pts);
      const h = alt * (i===Math.floor(pts/2) ? 1 : .68);
      d += ' L'+x1.toFixed(1)+' '+(cyb-h).toFixed(1)+' L'+x2.toFixed(1)+' '+cyb;
    }
    d += 'Z';
    g.push('<path d="'+d+'" fill="url(#'+u+'cup)"/>');
    if(D.coroa>=2){
      let bolas='';
      for(let i=0;i<pts;i++){
        const x1 = cx-cw + (cw*2/pts)*i + (cw*2/pts)/2;
        const h = alt * (i===Math.floor(pts/2) ? 1 : .68);
        bolas += '<circle cx="'+x1.toFixed(1)+'" cy="'+(cyb-h-2.2*k).toFixed(1)+'" r="'+(2.1*k).toFixed(1)+'" fill="'+GEMAS_COR[i%GEMAS_COR.length]+'"/>';
      }
      g.push(bolas);
    }
  }

  /* --- brilhos --- */
  if(D.brilhos){
    const sp = [[26,44,5],[112,54,4],[36,104,3.5],[104,100,4.5],[70,26,6],[18,74,3],[120,86,3.5]];
    let br='';
    for(let i=0;i<Math.min(D.brilhos+2, sp.length);i++){
      const [sx,sy,ss]=sp[i];
      br += '<path class="tr-brilho" style="--i:'+i+'" d="M'+sx+' '+(sy-ss)+' Q'+sx+' '+sy+' '+(sx+ss)+' '+sy
         + ' Q'+sx+' '+sy+' '+sx+' '+(sy+ss)+' Q'+sx+' '+sy+' '+(sx-ss)+' '+sy+' Q'+sx+' '+sy+' '+sx+' '+(sy-ss)+'Z" fill="'+P.luz+'"/>';
    }
    g.push('<g class="tr-brilhos">'+br+'</g>');
  }

  const defs = '<defs>'
    + '<linearGradient id="'+u+'cup" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+P.c+'"/><stop offset=".45" stop-color="'+P.a+'"/><stop offset="1" stop-color="'+P.b+'"/></linearGradient>'
    + '<linearGradient id="'+u+'met" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="'+P.b+'"/><stop offset=".5" stop-color="'+P.c+'"/><stop offset="1" stop-color="'+P.b+'"/></linearGradient>'
    + '<linearGradient id="'+u+'ped" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+P.a+'"/><stop offset="1" stop-color="'+P.b+'"/></linearGradient>'
    + '<linearGradient id="'+u+'pl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="'+P.b+'"/><stop offset=".5" stop-color="'+P.c+'"/><stop offset="1" stop-color="'+P.b+'"/></linearGradient>'
    + (D.raios? '<radialGradient id="'+u+'ray"><stop offset="0" stop-color="'+P.luz+'" stop-opacity=".9"/><stop offset="1" stop-color="'+P.a+'" stop-opacity="0"/></radialGradient>':'')
    + '</defs>';

  const cls = 'tr-svg' + (D.glow? ' tr-glow'+D.glow : '') + (op.classe? ' '+op.classe : '');
  return '<svg class="'+cls+'" viewBox="0 0 140 170" role="img" aria-label="Troféu de '+dias+' dias">'+defs+g.join('')+'</svg>';
}

/* silhueta: mesma moldura, zero detalhe — não entrega o desenho */
function trofeuSilhueta(dias){
  return '<svg class="tr-svg tr-lock" viewBox="0 0 140 170" role="img" aria-label="Troféu bloqueado">'
    + '<g fill="currentColor" opacity=".38">'
    + '<rect x="46" y="140" width="48" height="9" rx="2"/><rect x="52" y="131" width="36" height="9" rx="2"/>'
    + '<path d="M66 112 L64 131 L76 131 L74 112Z"/>'
    + '<path d="M48 62 L92 62 C92 92 84 112 70 112 C56 112 48 92 48 62Z"/>'
    + '<path d="M48 70 q-14 2 -14 14 q0 12 14 14" fill="none" stroke="currentColor" stroke-width="5"/>'
    + '<path d="M92 70 q14 2 14 14 q0 12 -14 14" fill="none" stroke="currentColor" stroke-width="5"/>'
    + '</g>'
    + '<text x="70" y="96" text-anchor="middle" font-size="30" font-weight="800" fill="currentColor" opacity=".6">?</text>'
    + '</svg>';
}

/* ---- RECORDES: tudo derivado do que o app já registra em prog.log/prog.cards ---- */
function recordes(){
  const log = prog.log||{}, ds = Object.keys(log).sort();
  let totRev=0, totOk=0, totNov=0, maiorDia=0, maiorDiaK='', maiorNov=0;
  let melhorAcerto=0, melhorAcertoK='';
  for(const k of ds){
    const l = log[k]||{}, r = l.rev||0;
    totRev += r; totOk += l.ok||0; totNov += l.nov||0;
    if(r > maiorDia){ maiorDia = r; maiorDiaK = k; }
    if((l.nov||0) > maiorNov) maiorNov = l.nov||0;
    if(r >= 20){ const a = Math.min(100, Math.round((l.ok||0)/r*100)); if(a > melhorAcerto){ melhorAcerto=a; melhorAcertoK=k; } }
  }
  /* melhor janela de 7 dias corridos */
  let melhorSemana=0;
  if(ds.length){
    const ini = new Date(ds[0]+'T12:00:00'), fim = new Date(ds[ds.length-1]+'T12:00:00');
    for(let d=new Date(ini); d<=fim; d.setDate(d.getDate()+1)){
      let soma=0; const c=new Date(d);
      for(let i=0;i<7;i++){ soma += (log[todayKey(c)]||{}).rev||0; c.setDate(c.getDate()+1); }
      if(soma>melhorSemana) melhorSemana=soma;
    }
  }
  const g = globalCounts();
  return {
    streak: melhorStreak(), dias: diasEstudados().length, totRev, totNov,
    acerto: totRev ? Math.min(100, Math.round(totOk/totRev*100)) : 0,
    maiorDia, maiorDiaK, maiorNov, melhorAcerto, melhorAcertoK, melhorSemana,
    dominadas: g.done, trofeus: Object.keys(trofeusMap()).length
  };
}
const dataCurta = k => k ? new Date(k+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) : '—';

function recordesHtml(){
  const r = recordes();
  const linha = (ic,rot,val,sub) => '<div class="rec"><span class="rec-ic">'+ic+'</span>'
    + '<div class="rec-tx"><b>'+val+'</b><span>'+rot+'</span></div>'
    + (sub? '<span class="rec-sub">'+sub+'</span>' : '') + '</div>';
  return '<h2 class="sec-t">🏆 Recordes</h2>'
    + '<div class="card" style="max-width:720px"><div class="rec-grid">'
    + linha('🔥','Maior sequência', r.streak+(r.streak===1?' dia':' dias'), r.streak===streak()&&r.streak?'atual':'')
    + linha('⚡','Mais cartas num dia', r.maiorDia, dataCurta(r.maiorDiaK))
    + linha('🎯','Melhor acerto do dia', (r.melhorAcerto?r.melhorAcerto+'%':'—'), r.melhorAcerto?dataCurta(r.melhorAcertoK):'mín. 20 cartas')
    + linha('📅','Dias estudados', r.dias, '')
    + linha('📈','Semana mais forte', r.melhorSemana, 'cartas em 7 dias')
    + linha('🌱','Mais cartas novas num dia', r.maiorNov, '')
    + linha('🧠','Cartas dominadas', r.dominadas, 'intervalo ≥ 21 dias')
    + linha('🥇','Troféus resgatados', r.trofeus+' de '+MARCOS.length, '')
    + '</div></div>';
}

/* ---- seção do streak no Perfil ---- */
function streakPerfilHtml(){
  const s = streakInfo(), pend = pendentes().length;
  const fita = fitaStreak().map(d=>'<span class="fita-d'+(d.on?' on':'')+'" title="'+d.k+'">'+d.n+'</span>').join('');
  const pct = s.prox ? Math.min(100, Math.round(s.atual/s.prox.d*100)) : 100;
  return '<h2 class="sec-t">🔥 Streak de Dias</h2>'
    + '<button class="streak-box'+(s.atual?' aceso':'')+'" onclick="nav(\'trofeus\')">'
    + (pend? '<span class="streak-pend">'+pend+' para resgatar</span>' : '')
    + '<div class="streak-num"><b>'+s.atual+'</b><span>dia'+(s.atual===1?'':'s')+' seguidos</span></div>'
    + '<div class="streak-mid">'
    +   '<div class="fita">'+fita+'</div>'
    +   (s.prox
          ? '<div class="streak-prox"><div class="pbar"><i style="width:'+pct+'%"></i></div>'
            + '<span>faltam <b>'+s.faltam+'</b> dia'+(s.faltam===1?'':'s')+' para <b>'+esc(nomeMarco(s.prox))+'</b></span></div>'
          : '<div class="streak-prox"><span>Você conquistou todos os troféus. Respeito. 🫡</span></div>')
    + '</div>'
    + '<span class="streak-ir">Ver troféus ›</span>'
    + '</button>'
    + (s.atual===0 && s.dias
        ? '<p class="streak-nota">Sua sequência zerou, mas o recorde de <b>'+s.melhor+' dias</b> continua guardado nos seus troféus. Estude hoje para começar de novo.</p>'
        : '');
}

/* ---- tela da coleção ---- */
/* Botão "‹ Voltar" reutilizável para telas que só se chega por um link de
   dentro de outra aba (não ficam na barra lateral, então sem ele não haveria
   como retornar sem usar o botão nativo do navegador). */
function backBtn(target, label){
  return '<button class="btn-voltar" onclick="nav(\''+target+'\')">‹ '+esc(label||'Voltar')+'</button>';
}
function vTrofeus(){
  const s = streakInfo(), pend = pendentes();
  const fita = fitaStreak().map(d=>'<span class="fita-d'+(d.on?' on':'')+'">'+d.n+'</span>').join('');
  let h = backBtn('perfil', 'Voltar ao Perfil')
    + '<h1 class="pg-t">🔥 Streak & Troféus</h1>'
    + '<p class="pg-s">Cada dia em que você estuda alguma carta conta um ponto na sequência. Pule um dia e ela recomeça — o recorde, esse fica.</p>';

  h += '<div class="streak-hero'+(s.atual?' aceso':'')+'">'
    + '<div class="sh-num"><b>'+s.atual+'</b><span>dia'+(s.atual===1?'':'s')+' seguidos</span></div>'
    + '<div class="sh-lado">'
    +   '<div class="fita fita-g">'+fita+'</div>'
    +   '<div class="sh-nums"><span>recorde <b>'+s.melhor+'</b></span><span>dias estudados <b>'+s.dias+'</b></span>'
    +   '<span>troféus <b>'+Object.keys(trofeusMap()).length+'/'+MARCOS.length+'</b></span></div>'
    + '</div></div>';

  if(!s.hojeOk) h += '<div class="plan-box"><b>Você ainda não estudou hoje.</b> '
    + (s.atual? 'Uma sessão mantém a sua sequência de '+s.atual+' dia'+(s.atual===1?'':'s')+' viva.' : 'Comece hoje e o contador sai do zero.')
    + '<div class="lst-acoes" style="margin-top:12px"><button class="btn btn-sm" onclick="startStudy(\'all\')">▶ Estudar agora</button></div></div>';

  if(pend.length) h += '<div class="plan-box alerta"><b>Você tem '+pend.length+' troféu'+(pend.length>1?'s':'')+' esperando para ser resgatado.</b>'
    + '<div class="lst-acoes" style="margin-top:12px"><button class="btn btn-sm" onclick="abrirConquistas()">🏆 Resgatar agora</button></div></div>';

  h += '<h2 class="sec-t">Coleção</h2>'
    + '<p class="pg-s">Os troféus que você ainda não conquistou ficam em sombra — descubra o desenho ao chegar lá.</p>'
    + '<div class="tr-grid">';
  for(const mc of MARCOS){
    const conq = conquistado(mc.d), res = resgatado(mc.d);
    if(conq) h += '<button class="tr-card'+(res?' conq':' novo')+'" onclick="verTrofeu('+mc.d+')">'
      + '<div class="tr-arte">'+trofeuSvg(mc.d,{sufixo:'c'})+'</div>'
      + '<b>'+esc(nomeMarco(mc))+'</b><span>'+mc.d+' dias</span>'
      + (res? '<i class="tr-ok">✓ resgatado</i>' : '<i class="tr-pend">resgatar</i>')
      + '</button>';
    else h += '<div class="tr-card bloq"><div class="tr-arte">'+trofeuSilhueta(mc.d)+'</div>'
      + '<b>???</b><span>'+mc.d+' dias</span><i class="tr-falta">faltam '+(mc.d-s.melhor)+'</i></div>';
  }
  h += '</div>';
  h += '<div class="lst-acoes" style="margin-top:20px"><button class="btn-o btn-sm" onclick="trocarGenero()">'
    + 'Nomes no '+(genero()==='f'?'feminino':'masculino')+' — trocar</button></div>';
  return h;
}
async function trocarGenero(){ setGenero(genero()==='f' ? 'm' : 'f'); }

function verTrofeu(dias){
  const mc = MARCOS.find(x=>x.d===dias); if(!mc) return;
  const res = resgatado(dias);
  showModal('<div class="tr-modal">'+trofeuSvg(dias,{sufixo:'m', classe:'tr-grande'})
    + '<h3>'+esc(nomeMarco(mc))+'</h3>'
    + '<p>'+mc.d+' dias seguidos de estudo'+(res? ' · resgatado em '+new Date(trofeusMap()[String(dias)]).toLocaleDateString('pt-BR') : '')+'</p>'
    + '<div class="mdl-row" style="justify-content:center">'
    + (res? '<button class="btn-o" onclick="closeModal()">Fechar</button>'
          : '<button class="btn" onclick="resgatarAgora('+dias+')">🏆 RESGATAR TROFÉU</button>')
    + '</div></div>');
}

/* ---- fila de conquistas pendentes ---- */
let filaConq = [];
function abrirConquistas(){ filaConq = pendentes().map(m=>m.d); proximaConquista(); }
function proximaConquista(){
  if(!filaConq.length){ closeModal(); render(); return; }
  const dias = filaConq[0], mc = MARCOS.find(x=>x.d===dias);
  const restantes = filaConq.length-1;
  showModal('<div class="tr-modal conquista">'
    + '<div class="conq-luz"></div>'
    + '<span class="conq-tag">Nova conquista</span>'
    + '<div class="conq-arte">'+trofeuSvg(dias,{sufixo:'q', classe:'tr-grande'})+'</div>'
    + '<h3>'+esc(nomeMarco(mc))+'</h3>'
    + '<p>Você desbloqueou uma nova conquista!<br><b>'+mc.d+' dias seguidos</b> de estudo.</p>'
    + '<button class="btn btn-block conq-btn" onclick="resgatarAgora('+dias+')">🏆 RESGATAR TROFÉU</button>'
    + (restantes? '<span class="conq-fila">+'+restantes+' aguardando</span>' : '')
    + '</div>');
}
function resgatarAgora(dias){
  resgatar(dias);
  const alvo = $('mdl-root').querySelector('.tr-modal');
  if(alvo){
    alvo.classList.add('resgatado');
    alvo.insertAdjacentHTML('beforeend','<div class="conq-ok">✓</div>');
  }
  filaConq = filaConq.filter(d=>d!==dias);
  setTimeout(()=>{ if(filaConq.length) proximaConquista(); else { closeModal(); render(); toast('Troféu resgatado 🏆'); } }, 900);
}
/* Vigia a virada do dia: se o app fica aberto passando da meia-noite, a
   sequência, a fita, os recordes e a meta diária precisam se atualizar sozinhos
   — sem depender de o aluno clicar em alguma coisa. */
let diaCorrente = null;
let vigiaTimer = null;
function vigiaVirada(){
  diaCorrente = todayKey();
  if(vigiaTimer) clearInterval(vigiaTimer);
  vigiaTimer = setInterval(()=>{
    if(!user) return;
    const k = todayKey();
    if(k !== diaCorrente){
      diaCorrente = k;
      renderNav(); render();
      checarConquistas();
    }
  }, 30000);
}

/* Mostra o que ficou pendente enquanto o aluno esteve fora. Se ele estiver no
   meio de uma sessão, guarda para o fim — ninguém merece um modal por cima da
   carta que está respondendo. */
let conqAdiada = false;
function checarConquistas(){
  if(!pendentes().length) return;
  if(session){ conqAdiada = true; return; }
  setTimeout(abrirConquistas, 600);
}
function checarConquistasAdiadas(){
  if(conqAdiada){ conqAdiada = false; checarConquistas(); }
}

/* ================= CT PREMIUM: vitrine e bloqueio ================= */
function precoHtml(p){
  const eco = p.economia ? '<span class="pl-eco">economize '+p.economia+'%</span>' : '';
  return '<div class="pl-card'+(p.destaque?' destaque':'')+'">'
    + (p.destaque? '<span class="pl-selo">Mais escolhido</span>' : '')
    + '<h3>'+p.nome+'</h3>'
    + '<div class="pl-preco"><span class="cif">R$</span><b>'+p.mes.split(',')[0]+'</b><span class="cent">,'+p.mes.split(',')[1]+'</span><span class="mes">/mês</span></div>'
    + eco
    + '<p class="pl-cob">R$ '+p.total+' '+p.cobranca+'</p>'
    + '<button class="'+(p.destaque?'btn':'btn-o')+' btn-block" onclick="assinar(\''+p.id+'\')">Assinar '+p.nome.toLowerCase()+'</button>'
    + '</div>';
}
/* switch acima dos planos: escolhe de qual trilha é o preço mostrado */
function trilhaPrecoSwitchHtml(){
  return '<div class="pl-switch" role="tablist" aria-label="Ver preço de qual trilha">'
    + Object.values(TRILHAS).map(t =>
        '<button type="button" role="tab" aria-selected="'+(precoTrilha===t.id)+'"'
        + ' class="pl-sw-opt'+(precoTrilha===t.id?' on':'')+'"'
        + ' onclick="precoTrilha=\''+t.id+'\';render()">'+t.ic+' '+t.nome+'</button>'
      ).join('')
    + '</div>';
}
function planosHtml(){
  return trilhaPrecoSwitchHtml()
    + '<div class="pl-grid">'+planosDe(precoTrilha).map(precoHtml).join('')+'</div>'
    + '<p class="pl-nota">Renovação automática, cancele quando quiser. Depois de assinar, o CT envia o seu código de acesso — ative em <b>Perfil → CT Premium</b>.</p>'
    + '<div class="lst-acoes" style="justify-content:center;margin-top:14px"><button class="btn-o btn-sm" onclick="ativarPremium()">Já tenho um código</button></div>';
}
async function assinar(id){
  const p = planosDe(precoTrilha).find(x=>x.id===id);
  const url = CHECKOUT[precoTrilha][id];
  if(url){ window.open(url, '_blank', 'noopener'); return; }
  await ask({title:'Assinatura do plano '+p.nome.toLowerCase()+' — '+TRILHAS[precoTrilha].nome, texto:'O pagamento on-line entra no ar em instantes. Enquanto isso, fale com a equipe do CT pelo @ctdosacademicos para assinar o plano '+p.nome.toLowerCase()+' do '+TRILHAS[precoTrilha].nome+' (R$ '+p.mes+'/mês) e receber o seu código de acesso.', okLb:'Entendi', cancelLb:null});
}

/* tópicos curtos — o aluno chega ao preço logo, sem ler blocos de texto */
const PORQUE_PREMIUM = [
  ['🔓','Até '+fmtMil(TOTAL_CARTAS_APP)+' flashcards, do estágio à residência'],
  ['🧠','Revisão espaçada sem limite de cartas por dia'],
  ['📅','Cronograma de estudo até a data da sua prova'],
  ['🔬','Método de revisão cientificamente comprovado, para fixar por mais tempo']
];
function paywallHtml(titulo, sub){
  return '<div class="pw"><span class="badge-gold">CT Premium</span>'
    + '<h2>'+titulo+'</h2><p class="pw-sub">'+sub+'</p>'
    + '<h3 class="pw-why-t">Por que ser CT Premium?</h3>'
    + '<ul class="pw-why">'+PORQUE_PREMIUM.map(b=>'<li><span class="ic">'+b[0]+'</span>'+b[1]+'</li>').join('')+'</ul>'
    + planosHtml() + '</div>';
}
function vPremium(){
  const a = assinatura(), d = diasRestantesAssinatura();
  if(isAdmin()) return '<h1 class="pg-t">CT Premium ⭐</h1><p class="pg-s">Você está no modo administrador: todo o conteúdo está liberado, independentemente de assinatura.</p>' + paywallHtml('É esta a vitrine que o aluno vê', 'Confira preços e textos antes de divulgar.');
  if(assinaturaValida()){
    const tr = assinaturaTrilha();
    return '<h1 class="pg-t">CT Premium ⭐</h1>'
    + '<p class="pg-s">Sua assinatura ('+TRILHAS[tr].nome+') está ativa. Bons estudos!</p>'
    + '<div class="plan-box ok" style="max-width:720px"><b>Acesso liberado a '+fmtMil(TOTAL_TRILHA[tr])+' flashcards'+(tr==='estagio'?' do CT Estágio':', do estágio à residência')+'.</b>'
    + '<span class="plan-nota">Válida até <b>'+new Date(a.ate+'T12:00:00').toLocaleDateString('pt-BR')+'</b> — faltam '+d+' dia'+(d===1?'':'s')+'.'
    + (d<=15? ' Renove com o CT para não perder o acesso e peça o código novo.' : '')+'</span></div>'
    + (tr==='estagio' ? '<p class="pg-s" style="margin-top:14px">Quer também Cirurgia, GO, Pediatria e Preventiva? Peça ao CT o código da CT Residência.</p>' : '')
    + '<div class="lst-acoes"><button class="btn-o btn-sm" onclick="ativarPremium()">Inserir um código novo</button></div>';
  }
  return '<h1 class="pg-t">Libere o app inteiro ⭐</h1>'
    + '<p class="pg-s">Você está no plano gratuito: '+totalLivres()+' flashcards liberados e os seus próprios baralhos, sempre sem custo.</p>'
    + paywallHtml('Assine o CT Premium', 'Um preço por mês, o conteúdo inteiro do CT dos Acadêmicos na sua mão.');
}
/* anúncio dentro do estudo, quando a última carta grátis acabou */
function paywallEstudo(){
  const acc = session.rev ? Math.round(session.ok/session.rev*100) : 0;
  return '<div class="pw-wrap">'
    + (session.rev
        ? '<div class="pw-fim"><div class="big">🎉</div><h2>Você chegou ao fim das cartas gratuitas</h2>'
          + '<p>'+session.rev+' revisões · '+acc+'% de acerto. As próximas <b>'+session.trancadas+'</b> cartas deste caminho fazem parte do CT Premium.</p></div>'
        : '<div class="pw-fim"><div class="big">🔒</div><h2>Este conteúdo é do CT Premium</h2>'
          + '<p>São <b>'+session.trancadas+'</b> flashcards esperando por você aqui. No plano gratuito, o CT libera '+totalLivres()+' cartas e os baralhos que você mesmo cria.</p></div>')
    + paywallHtml('Continue de onde você parou', 'Assine e destrave até '+fmtMil(TOTAL_CARTAS_APP)+' flashcards agora.')
    + '<div class="lst-acoes" style="justify-content:center;margin-top:18px"><button class="btn-o" onclick="endStudy()">Voltar ao início</button></div>'
    + '</div>';
}

/* ================= TEMA CLARO/ESCURO (v34.1) =================
   Preferência do APARELHO, não da conta (como fcct_admin/fcct_revisao) — não
   faz sentido variar por e-mail, e assim continua valendo até na tela de
   login, antes de qualquer conta entrar. O valor é lido cedo, direto do
   localStorage, por um script inline no topo do HTML (antes do <style>) só
   pra nunca piscar do tema errado para o certo no primeiro instante; esta
   função replica a mesma leitura para o resto do app poder reagir a
   mudanças feitas em tempo de execução (setTema()). */
const K_TEMA = 'fcct_tema';
function tema(){ return store.get(K_TEMA)==='light' ? 'light' : 'dark'; }
function aplicarTema(){
  if(tema()==='light') document.documentElement.setAttribute('data-theme','light');
  else document.documentElement.removeAttribute('data-theme');
}
function setTema(t){ store.set(K_TEMA, t==='light' ? 'light' : 'dark'); aplicarTema(); syncTemaSwitch(); }
aplicarTema();
/* Switch de tema na barra lateral (acima do "Sair"). Fica na casca estática
   do HTML — não é recriado pelo render() — então em vez de re-renderizar,
   só atualizamos suas classes/texto direto no DOM, tanto na carga inicial
   quanto sempre que o tema mudar (inclusive pelos chips da aba Perfil). */
function syncTemaSwitch(){
  const el = document.getElementById('s-theme-sw');
  if(!el) return;
  const light = tema()==='light';
  el.classList.toggle('on', light);
  const ic = el.querySelector('.nic'); if(ic) ic.textContent = light ? '☀️' : '🌙';
  const lb = el.querySelector('.lb'); if(lb) lb.textContent = light ? 'Tema claro' : 'Tema escuro';
}
function toggleTemaSidebar(){ setTema(tema()==='light' ? 'dark' : 'light'); }
syncTemaSwitch();

/* ================= ATALHOS DE TECLADO (desktop) =================
   Espaço mostra a resposta; depois de virada, teclas viram os quatro botões
   de nota. É uma preferência do teclado físico do aparelho — por isso fica
   guardada só neste dispositivo (como fcct_admin, fcct_revisao), e não junto
   do progresso que sincroniza entre aparelhos: o teclado de um notebook não
   tem nada a ver com o do próximo aparelho em que o aluno entrar. */
const kAtalhos = email => 'fcct_atalhos_'+email;
const ATALHOS_PADRAO = {flip:' ', g0:'1', g1:'2', g2:'3', g3:'4'};
const ATALHO_LBL = {flip:'Mostrar resposta', g0:'Errei', g1:'Difícil', g2:'Bom', g3:'Fácil'};
let atalhos = Object.assign({}, ATALHOS_PADRAO);
let atalhoCapturando = null;   // ação esperando uma tecla nova, na tela de Configurações do Perfil
function loadAtalhos(){
  const salvos = store.get(kAtalhos(user.email)) || {};
  atalhos = Object.assign({}, ATALHOS_PADRAO, salvos);
}
function saveAtalhos(){ store.set(kAtalhos(user.email), atalhos); }
function teclaLabel(k){ return k===' ' ? 'Espaço' : k.length===1 ? k.toUpperCase() : k; }
function atalhoIniciarCaptura(acao){ atalhoCapturando = acao; render(); }
function atalhoCancelarCaptura(){ atalhoCapturando = null; render(); }
async function atalhosResetar(){
  if(!(await ask({title:'Restaurar os atalhos padrão?', texto:'Espaço para mostrar a resposta e 1‑2‑3‑4 para avaliar (errei, difícil, bom, fácil).', okLb:'Restaurar'}))) return;
  atalhos = Object.assign({}, ATALHOS_PADRAO); saveAtalhos(); atalhoCapturando=null; render();
}
function ehCampoDeTexto(el){
  if(!el) return false;
  const tag = (el.tagName||'').toLowerCase();
  return tag==='input' || tag==='textarea' || tag==='select' || el.isContentEditable;
}
/* Um único ouvinte cuida das duas coisas: capturar uma tecla nova (quando o
   aluno está personalizando em Perfil → Atalhos) e, durante o estudo, agir
   como os botões de virar/avaliar. Sempre ignora campos de texto, o menu
   de seleção e qualquer janela (confirmar, senha) aberta por cima — nunca
   deve atrapalhar quem está digitando em outro lugar do app. */
document.addEventListener('keydown', e=>{
  if(e.repeat) return;                                  // não repete ao segurar a tecla
  if(ehCampoDeTexto(e.target)) return;
  const modalEl = $('mdl-root');
  const modalAberto = modalEl && modalEl.innerHTML.trim().length>0;

  if(atalhoCapturando){
    if(modalAberto) return;
    e.preventDefault();
    if(e.key==='Escape'){ atalhoCancelarCaptura(); return; }
    const k = e.key.length===1 ? e.key.toLowerCase() : null;
    if(!k){ toast('Use uma tecla de letra, número ou espaço.'); return; }
    const conflito = Object.keys(atalhos).find(a=>a!==atalhoCapturando && atalhos[a]===k);
    if(conflito){ toast('A tecla "'+teclaLabel(k)+'" já é o atalho de "'+ATALHO_LBL[conflito]+'".'); return; }
    atalhos[atalhoCapturando]=k; saveAtalhos(); atalhoCapturando=null; render();
    return;
  }

  if(modalAberto || curView!=='study' || !session) return;
  const c = currentCard();
  if(!c) return;                                        // fim da fila, "sessão concluída" ou anúncio do Premium
  const k = e.key.length===1 ? e.key.toLowerCase() : e.key;
  if(!session.flipped){
    if(k===atalhos.flip){ e.preventDefault(); flip(); }
    return;
  }
  if(k===atalhos.g0){ e.preventDefault(); answer(0); }
  else if(k===atalhos.g1){ e.preventDefault(); answer(1); }
  else if(k===atalhos.g2){ e.preventDefault(); answer(2); }
  else if(k===atalhos.g3){ e.preventDefault(); answer(3); }
});
function aparenciaPerfilHtml(){
  const t = tema();
  return '<h2 class="sec-t">🎨 Aparência</h2>'
    + '<div class="card" style="max-width:560px">'
    + '<div class="fld" style="margin-bottom:0"><label>Tema do app</label><div class="chip-row">'
    + '<button class="chip'+(t==='dark'?' on':'')+'" onclick="setTema(\'dark\');render()">🌙 Escuro</button>'
    + '<button class="chip'+(t==='light'?' on':'')+'" onclick="setTema(\'light\');render()">☀️ Claro</button>'
    + '</div></div>'
    + '<p class="cfg-ex" style="margin:10px 0 0">Fica salvo só neste aparelho, do mesmo jeito que os atalhos de teclado abaixo.</p>'
    + '</div>';
}
function atalhosPerfilHtml(){
  const ordem = ['flip','g0','g1','g2','g3'];
  return '<h2 class="sec-t">⌨️ Atalhos de teclado</h2>'
    + '<div class="card" style="max-width:560px">'
    + '<p style="color:var(--txt2);font-size:13px;margin-bottom:14px">No computador, dá para estudar sem tirar a mão do teclado — funcionam só durante o estudo. Clique numa tecla para trocá-la.</p>'
    + ordem.map(a=>'<div class="atalho-row"><span>'+ATALHO_LBL[a]+'</span>'
        + '<button class="atalho-k'+(atalhoCapturando===a?' capturando':'')+'" onclick="atalhoIniciarCaptura(\''+a+'\')">'
        + (atalhoCapturando===a ? 'Pressione uma tecla…' : teclaLabel(atalhos[a])) + '</button></div>').join('')
    + '<div class="lst-acoes" style="margin-top:14px">'
    + (atalhoCapturando ? '<button class="btn-o btn-sm" onclick="atalhoCancelarCaptura()">Cancelar</button>' : '')
    + '<button class="btn-o btn-sm" onclick="atalhosResetar()">Restaurar padrão</button></div>'
    + '</div>';
}

/* ================= ESTUDO ================= */
async function startStudy(target){
  if(typeof garantirConteudo === 'function' && !(await garantirConteudo(target))) return;
  const s = buildSession(target);
  if(!s){ toast('Nada para estudar agora aqui ✓'); return; }
  if(!s.queue.length && !s.trancadas){ toast('Nada para estudar agora aqui ✓'); return; }
  s.ini = Date.now();       // para "tempo de sessão" na tela de estatísticas
  s.notas = [0,0,0,0];      // quantas vezes cada nota (errei/difícil/bom/fácil) foi escolhida
  s.undo = null;            // instantâneo para desfazer só a ÚLTIMA resposta — ver voltarCard()
  session = s;
  curView='study'; renderNav(); render();
  window.scrollTo(0,0);
}
function currentCard(){
  if(!session) return null;
  if(session.idx < session.queue.length) return session.queue[session.idx];
  if(session.again.length){ session.queue = session.again; session.again=[]; session.idx=0; return session.queue[0]; }
  return null;
}
function vStudy(){
  const c = currentCard();
  if(!c && session.trancadas) return paywallEstudo();
  if(!c){
    if(!session.fim) session.fim = Date.now();   // trava o tempo total assim que a fila acaba
    const acc = session.rev ? Math.round(session.ok/session.rev*100) : 0;
    return '<div class="st-done"><div class="big">🎉</div><h2>Sessão concluída!</h2>'
      + '<p>'+session.rev+' revisões · '+acc+'% de acerto · streak de '+streak()+' dia'+(streak()===1?'':'s')+' 🔥</p>'
      + '<div class="row"><button class="btn" onclick="endStudy()">Voltar ao início</button>'
      + '<button class="btn-o" onclick="verEstatisticasSessao()">Ver estatísticas</button></div></div>';
  }
  const restante = (session.queue.length - session.idx) + session.again.length;
  const cs = prog.cards[c.cid];
  let h = '<div class="st-wrap"><div class="st-top"><span class="info">Restam <b>'+restante+'</b> carta'+(restante>1?'s':'')+' · '+session.rev+' feitas</span>'
    + '<div style="display:flex;gap:8px">'
    + (session.undo ? '<button class="st-undo" onclick="voltarCard()" title="Desfaz a última resposta e mostra a carta anterior">↩ Cartão anterior</button>' : '')
    + '<button class="st-x" onclick="endStudy()">Encerrar</button></div></div>';
  h += '<div class="st-card">' + cardActionsHtml(c.cid)
    + '<div class="dk">'+c.deck.ic+' '+esc(c.deck.nome)+' · '+esc(c.sub.nome)+(cs?'':' · <span style="color:var(--gold)">nova</span>')+'</div>'
    + '<div class="st-q">'+cFront(c)+'</div>';
  if(session.flipped){
    h += '<div class="st-a"><div class="lb">Resposta</div><div class="tx">'+cBack(c)+'</div>'
      + (c.ex ? '<div class="ex">💡 '+cDica(c)+'</div>' : '') + '</div>';
  }
  h += '</div>';
  if(!session.flipped){
    h += '<button class="btn btn-block" style="padding:15px;font-size:15px" onclick="flip()">Mostrar resposta <span class="k-hint">('+teclaLabel(atalhos.flip)+')</span></button>';
  } else {
    h += '<div class="grade-row">'
      + '<button class="g-err" onclick="answer(0)">Errei<small><span class="k-hint">'+teclaLabel(atalhos.g0)+' · </span>'+previewIv(cs,0)+'</small></button>'
      + '<button class="g-hard" onclick="answer(1)">Difícil<small><span class="k-hint">'+teclaLabel(atalhos.g1)+' · </span>'+previewIv(cs,1)+'</small></button>'
      + '<button class="g-good" onclick="answer(2)">Bom<small><span class="k-hint">'+teclaLabel(atalhos.g2)+' · </span>'+previewIv(cs,2)+'</small></button>'
      + '<button class="g-easy" onclick="answer(3)">Fácil<small><span class="k-hint">'+teclaLabel(atalhos.g3)+' · </span>'+previewIv(cs,3)+'</small></button>'
      + '</div>';
  }
  h += '</div>';
  return h;
}
function flip(){ session.flipped=true; render(); }
function answer(g){
  const c = currentCard();
  const isNew = !prog.cards[c.cid];
  const primeiraDoDia = !((prog.log[todayKey()]||{}).rev);
  const dia = todayKey();
  /* guarda tudo que esta resposta vai mudar, para voltarCard() poder desfazer
     exatamente esta jogada — e só esta: o próximo answer() sobrescreve este
     instantâneo, então só dá para voltar UM cartão, nunca dois. */
  session.undo = {
    idx: session.idx,
    queue: session.queue.slice(),
    again: session.again.slice(),
    cid: c.cid,
    novo: isNew,
    csAntes: isNew ? null : Object.assign({}, prog.cards[c.cid]),
    diaLog: dia,
    logAntes: prog.log[dia] ? Object.assign({}, prog.log[dia]) : null,
    rev: session.rev,
    ok: session.ok,
    notas: session.notas.slice()
  };
  const cs = prog.cards[c.cid] || {};
  gradeCard(cs, g);
  prog.cards[c.cid] = cs;
  const log = prog.log[dia] || {rev:0, ok:0, nov:0};
  log.rev++; if(g>0) log.ok++; if(isNew) log.nov=(log.nov||0)+1;
  prog.log[dia] = log;
  session.rev++; if(g>0) session.ok++;
  session.notas[g]++;
  if(g===0) session.again.push(c);
  session.idx++; session.flipped=false;
  saveProg();
  render();
  if(primeiraDoDia) checarConquistas();   // a sequência só muda na 1ª carta do dia
}
/* Desfaz só a última resposta: some com o grau dado, devolve a carta para a
   fila e restaura o progresso salvo dela a como estava antes. Depois disso
   não dá para voltar de novo — é sempre um cartão de cada vez, nunca dois
   (o "antepenúltimo" fica bloqueado, como pedido). */
function voltarCard(){
  if(!session || !session.undo) return;
  const u = session.undo;
  session.queue = u.queue;
  session.again = u.again;
  session.idx = u.idx;
  session.rev = u.rev;
  session.ok = u.ok;
  session.notas = u.notas;
  if(u.novo) delete prog.cards[u.cid]; else prog.cards[u.cid] = u.csAntes;
  if(u.logAntes) prog.log[u.diaLog] = u.logAntes; else delete prog.log[u.diaLog];
  session.flipped = false;
  session.undo = null;
  saveProg();
  render();
}
function endStudy(){ session=null; nav('dashboard'); checarConquistasAdiadas(); }
function endStudyTo(v){ session=null; nav(v); checarConquistasAdiadas(); }
/* "Ver estatísticas" ao fim da sessão: tira uma foto do que essa sessão foi
   (não do histórico todo) antes de encerrar, para a tela de estatísticas da
   sessão poder mostrar mesmo depois que `session` for zerado. */
let ultimaSessao = null;
function verEstatisticasSessao(){
  ultimaSessao = {
    target: session.target,
    ini: session.ini,
    fim: session.fim || Date.now(),
    rev: session.rev,
    ok: session.ok,
    notas: session.notas.slice()
  };
  session = null;
  curView = 'sessao'; renderNav(); render();
  checarConquistasAdiadas();
}

/* ================= ESTATÍSTICAS DA SESSÃO ================= */
/* Tela dedicada ao "Ver estatísticas" do fim de um baralho — tempo gasto e o
   perfil de dificuldade das respostas DAQUELA sessão, não o histórico geral
   (que continua em vStats(), um clique adiante). */
function vSessaoStats(){
  if(!ultimaSessao) return vStats();
  const s = ultimaSessao;
  const total = s.rev || 0;
  const acc = total ? Math.round(s.ok/total*100) : 0;
  const dur = Math.max(0, s.fim - s.ini);
  const seg = Math.round(dur/1000);
  const min = Math.floor(seg/60), sg = seg%60;
  const tempoTxt = min ? (min+' min '+String(sg).padStart(2,'0')+' s') : (seg+' s');
  const NOTAS = [{lb:'😵 Errei'}, {lb:'😕 Difícil'}, {lb:'🙂 Bom'}, {lb:'😄 Fácil'}];
  let h = '<h1 class="pg-t">Estatísticas da sessão</h1><p class="pg-s">'+(labelFor(s.target)||'Como foi a última vez que você estudou')+'.</p>';
  h += '<div class="tile-row">'
    + '<div class="tile blue"><b>'+total+'</b><span>cartas revisadas</span></div>'
    + '<div class="tile '+(acc>=80?'green':acc>=60?'':'orange')+'"><b>'+acc+'%</b><span>taxa de acerto</span></div>'
    + '<div class="tile gold"><b>'+tempoTxt+'</b><span>tempo de sessão</span></div>'
    + '</div>';
  h += '<h2 class="sec-t">Dificuldades escolhidas</h2><div class="card"><div class="dstat">'
    + NOTAS.map((n,i)=>{
        const pct = total ? Math.round(s.notas[i]/total*100) : 0;
        return '<div class="row"><span class="nm">'+n.lb+'</span><div class="pbar"><i style="width:'+pct+'%"></i></div><span class="pc">'+pct+'% · '+s.notas[i]+'</span></div>';
      }).join('')
    + '</div></div>';
  h += '<div class="lst-acoes" style="margin-top:22px">'
    + '<button class="btn" onclick="nav(\'dashboard\')">Voltar ao início</button>'
    + '<button class="btn-o" onclick="nav(\'stats\')">Ver estatísticas gerais</button>'
    + '</div>';
  return h;
}

/* ================= ESTATÍSTICAS ================= */
function vStats(){
  const g=globalCounts();
  let rev=0, ok=0; for(const d in prog.log){ rev+=prog.log[d].rev||0; ok+=prog.log[d].ok||0; }
  const acc = rev ? Math.round(ok/rev*100) : 0;
  let h = '<h1 class="pg-t">Estatísticas</h1><p class="pg-s">Sua evolução no Flashcards CT.</p>';
  h += '<div class="tile-row">'
    + '<div class="tile gold"><b>'+streak()+' 🔥</b><span>streak (dias)</span></div>'
    + '<div class="tile blue"><b>'+rev+'</b><span>revisões totais</span></div>'
    + '<div class="tile '+(acc>=80?'green':acc>=60?'':'orange')+'"><b>'+acc+'%</b><span>taxa de acerto</span></div>'
    + '<div class="tile green"><b>'+g.done+'</b><span>cartas dominadas</span></div>'
    + '</div>';
  const days=[]; const names=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  for(let i=6;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); days.push({k:todayKey(d), n:names[d.getDay()]}); }
  const max = Math.max(1, ...days.map(d=>(prog.log[d.k]||{}).rev||0));
  h += '<h2 class="sec-t">Últimos 7 dias</h2><div class="card"><div class="chart">'
    + days.map(d=>{ const v=(prog.log[d.k]||{}).rev||0;
        return '<div class="col"><span class="val">'+(v||'')+'</span><div class="bar'+(v?'':' zero')+'" style="height:'+Math.max(3,Math.round(v/max*100))+'%"></div><span class="lbl">'+d.n+'</span></div>'; }).join('')
    + '</div></div>';
  h += '<h2 class="sec-t">Domínio por tema</h2><div class="card"><div class="dstat">'
    + visibleDecks().map(t=>{ const c=countsFor(cardsOfTheme(t.id)); const pct=Math.round((c.total-c.nov)/c.total*100);
        return '<div class="row"><span class="nm">'+t.ic+' '+esc(t.nome.split('&')[0].split('—')[0].trim())+'</span><div class="pbar"><i style="width:'+pct+'%"></i></div><span class="pc">'+pct+'%</span></div>'; }).join('')
    + '</div></div>';
  return h;
}

/* ================= PERFIL ================= */
/* ================= TELA: MEU PLANO ================= */
const METAS = [10,20,30,40,50,75,100,150];

function planoConfigHtml(){
  const p = plano();
  return '<div class="card" style="max-width:720px">'
    + '<div class="cfg-lb">Quantos flashcards por dia?</div>'
    + '<p class="cfg-ex">Conta o dia inteiro: as revisões que vencerem entram primeiro e as cartas novas ocupam o que sobrar.</p>'
    + '<div class="chip-row">' + METAS.map(m=>'<button class="chip'+(p.meta===m?' on':'')+'" onclick="setMeta('+m+')">'+m+'</button>').join('')
    + '<button class="chip'+(METAS.includes(p.meta)?'':' on')+'" onclick="setMetaLivre()">outro…</button></div>'
    + '<div class="cfg-lb">Em quais dias você estuda?</div>'
    + '<p class="cfg-ex">Nos dias de folga o app não cobra nada de você — e o cronograma já conta com isso.</p>'
    + '<div class="chip-row">' + DIAS_NOMES.map((d,i)=>'<button class="chip'+(p.dias.includes(i)?' on':'')+'" onclick="toggleDia('+i+')">'+d+'</button>').join('') + '</div>'
    + '<div class="cfg-lb">Data da prova <span>(opcional)</span></div>'
    + '<p class="cfg-ex">Com a data preenchida, o app avisa se o seu ritmo dá conta do conteúdo a tempo.</p>'
    + '<div class="chip-row" style="align-items:center">'
    + '<input class="ed-in" style="max-width:190px" type="date" id="in-prova" value="'+(p.prova||'')+'" onchange="setProva(this.value)">'
    + (p.prova? '<button class="chip" onclick="setProva(\'\')">limpar</button>' : '') + '</div>'
    + '</div>';
}

function setMeta(m){ salvarPlano({meta:m}); render(); }
async function setMetaLivre(){
  const v = await ask({title:'Meta diária', texto:'Quantos flashcards você quer fazer por dia, contando revisões e cartas novas?', campo:'texto', ph:'ex.: 60', valor:String(plano().meta), max:4, okLb:'Salvar'});
  if(v===null) return;
  const n = parseInt(String(v).replace(/\D/g,''),10);
  if(!n || n<5 || n>500){ toast('Escolha um número entre 5 e 500.'); return; }
  salvarPlano({meta:n}); render();
}
function toggleDia(i){
  const dias = plano().dias.slice();
  const k = dias.indexOf(i);
  if(k>=0){ if(dias.length===1){ toast('Escolha pelo menos um dia da semana.'); return; } dias.splice(k,1); }
  else dias.push(i);
  dias.sort(); salvarPlano({dias}); render();
}
function setProva(v){
  if(!v){ salvarPlano({prova:null}); toast('Data da prova removida.'); render(); return; }
  if(diasCorridosAte(v) <= 0){ toast('Escolha uma data futura.'); render(); return; }
  salvarPlano({prova:v}); render();
}

/* ---- prioridade manual de subtemas (v37) ----
   Deixa o aluno furar a fila: um subtema priorizado vai para a frente de
   TUDO (até de peso 5) na ordem de cartas novas de "Estudar agora" — útil
   para quem está vendo um assunto específico na faculdade/estágio agora e
   quer revisar justo aquilo, independente do que mais cai em prova. */
function addPrioridade(subId){
  if(!subId || !findSub(subId)) return;
  const lista = (plano().prioridade||[]).slice();
  if(lista.includes(subId)) return;
  lista.push(subId);
  salvarPlano({prioridade:lista}); render();
}
function removerPrioridade(subId){
  const lista = (plano().prioridade||[]).filter(id=>id!==subId);
  salvarPlano({prioridade:lista}); render();
}
function moverPrioridade(subId, dir){
  const lista = (plano().prioridade||[]).slice();
  const i = lista.indexOf(subId); if(i<0) return;
  const j = i+dir; if(j<0 || j>=lista.length) return;
  const tmp = lista[i]; lista[i]=lista[j]; lista[j]=tmp;
  salvarPlano({prioridade:lista}); render();
}

function planoResumoHtml(){
  const p = plano(), pv = previsao(), dg = diagnosticoProva();
  const porSemana = p.meta * p.dias.length;
  let h = '<div class="tile-row">'
    + '<div class="tile blue"><b>'+p.meta+'</b><span>cartas por dia</span></div>'
    + '<div class="tile"><b>'+p.dias.length+'×</b><span>por semana</span></div>'
    + '<div class="tile gold"><b>'+porSemana+'</b><span>cartas por semana</span></div>'
    + '<div class="tile green"><b>'+pv.rest+'</b><span>cartas novas restantes</span></div>'
    + '</div>';

  if(!pv.rest){
    h += '<div class="plan-box ok"><b>Você já viu todas as cartas liberadas para você.</b> A partir daqui o plano é só manter as revisões em dia — elas continuam aparecendo sozinhas em "Estudar agora".</div>';
    return h;
  }
  h += '<div class="plan-box"><b>Nesse ritmo, você termina o conteúdo inédito em '+pv.corridos+' dia'+(pv.corridos>1?'s':'')
    + '</b> — por volta de <b>'+pv.fim.toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})+'</b>.'
    + '<span class="plan-nota">Estimativa com ~'+pv.porDia+' cartas novas por dia de estudo; o resto da meta fica para as revisões que forem vencendo.</span></div>';

  if(dg){
    const falta = dg.rest - dg.capacidade;
    h += dg.cabe
      ? '<div class="plan-box ok"><b>Faltam '+dg.corridos+' dias para a sua prova ('+dg.diasEstudo+' dias de estudo).</b> No ritmo atual você cobre o conteúdo com folga de cerca de '+Math.round(dg.capacidade-dg.rest)+' cartas.</div>'
      : '<div class="plan-box alerta"><b>Faltam '+dg.corridos+' dias para a sua prova ('+dg.diasEstudo+' dias de estudo).</b> No ritmo atual sobrariam cerca de <b>'+falta+' cartas</b> sem serem vistas. Para cobrir tudo você precisaria de <b>'+dg.precisaPorDia+' cartas por dia</b> — ou de mais dias de estudo na semana.'
        + '<div class="lst-acoes" style="margin-top:12px"><button class="btn btn-sm" onclick="setMeta('+Math.min(500,dg.precisaPorDia)+')">Ajustar minha meta para '+Math.min(500,dg.precisaPorDia)+'/dia</button></div></div>';
  }
  return h;
}

function planoPrioridadeHtml(){
  const idsPrior = plano().prioridade || [];
  const itens = idsPrior.map(findSub).filter(Boolean);
  const usados = new Set(idsPrior);
  const opcoes = visibleDecks().map(t=>{
    const subs = t.subs.filter(s=>!usados.has(s.id));
    if(!subs.length) return '';
    return '<optgroup label="'+esc(t.ic+' '+t.nome)+'">'+subs.map(s=>'<option value="'+s.id+'">'+esc(s.nome)+'</option>').join('')+'</optgroup>';
  }).join('');
  return '<h2 class="sec-t">🎯 Prioridade manual</h2>'
    + '<p class="pg-s">Estudando um assunto específico na faculdade ou no estágio agora? Coloque o subtema no topo — ele passa na frente de tudo (até do que mais cai em prova) nas cartas novas de "Estudar agora".</p>'
    + (itens.length
        ? itens.map((x,i)=>'<div class="pend-row"><span class="prior-n">'+(i+1)+'</span>'
            + '<div class="pr-main"><b>'+esc(x.s.nome)+'</b><span>'+x.t.ic+' '+esc(x.t.nome)+'</span></div>'
            + '<div style="display:flex;gap:6px">'
            + '<button class="prior-mv" '+(i===0?'disabled':'')+' onclick="moverPrioridade(\''+x.s.id+'\',-1)" title="Subir" aria-label="Subir prioridade">↑</button>'
            + '<button class="prior-mv" '+(i===itens.length-1?'disabled':'')+' onclick="moverPrioridade(\''+x.s.id+'\',1)" title="Descer" aria-label="Descer prioridade">↓</button>'
            + '<button class="fav-x" onclick="removerPrioridade(\''+x.s.id+'\')" title="Remover da prioridade" aria-label="Remover da prioridade">✕</button>'
            + '</div></div>').join('')
        : '<p class="lst-vazio">Nenhum subtema priorizado — a fila segue só o peso de relevância e a ordem didática de sempre.</p>')
    + (opcoes
        ? '<div class="chip-row" style="align-items:center;margin-top:'+(itens.length?'12px':'4px')+'">'
          + '<select class="adm-sel" id="prior-sel" style="max-width:320px;width:auto">'+opcoes+'</select>'
          + '<button class="btn-o btn-sm" onclick="addPrioridade(document.getElementById(\'prior-sel\').value)">+ Priorizar</button>'
          + '</div>'
        : '');
}

function planoOrdemHtml(){
  const pend = pendentesPriorizados();
  if(!pend.length) return '';
  const priorIds = new Set(plano().prioridade||[]);
  const priorizados = pend.filter(x=>priorIds.has(x.s.id));
  const resto = pend.filter(x=>!priorIds.has(x.s.id));
  const porPeso = {};
  for(const x of resto){ (porPeso[x.peso]=porPeso[x.peso]||[]).push(x); }
  const rotulo = {5:'Cai em toda prova', 4:'Cai com frequência', 3:'Cai com regularidade', 2:'Cai eventualmente', 1:'Raro em prova'};
  let h = '<h2 class="sec-t">Ordem de estudo</h2>'
    + '<p class="pg-s">Montamos a fila do que mais cai nas provas de residência para o que menos cai'
    + (priorizados.length ? ', respeitando primeiro os subtemas que você priorizou manualmente logo acima' : '')
    + '. O botão <b>Estudar agora</b> segue exatamente esta ordem.</p>';
  if(priorizados.length){
    h += '<div class="peso-bloco"><div class="peso-cab"><span class="peso-tag" style="background:var(--blue-glow);color:var(--blue);border:1px solid rgba(61,133,216,.3)">🎯</span>'
      + '<b>Sua prioridade</b><span class="qt">'+priorizados.length+' subtema'+(priorizados.length>1?'s':'')+' · '+priorizados.reduce((a,x)=>a+x.nov,0)+' cartas novas</span></div>'
      + '<div class="peso-subs">' + priorizados.map(x=>'<button class="peso-sub" onclick="startStudy(\'sub:'+x.s.id+'\')" title="Estudar '+esc(x.s.nome)+'">'
        + '<span class="ic">'+x.t.ic+'</span><span class="nm">'+esc(x.s.nome)+'</span><span class="n">'+x.nov+'</span></button>').join('')
      + '</div></div>';
  }
  for(const p of [5,4,3,2,1]){
    const g = porPeso[p]; if(!g) continue;
    const nov = g.reduce((a,x)=>a+x.nov,0);
    h += '<div class="peso-bloco"><div class="peso-cab"><span class="peso-tag p'+p+'">'+'★'.repeat(p)+'</span>'
      + '<b>'+rotulo[p]+'</b><span class="qt">'+g.length+' subtema'+(g.length>1?'s':'')+' · '+nov+' cartas novas</span></div>'
      + '<div class="peso-subs">' + g.map(x=>'<button class="peso-sub" onclick="startStudy(\'sub:'+x.s.id+'\')" title="Estudar '+esc(x.s.nome)+'">'
        + '<span class="ic">'+x.t.ic+'</span><span class="nm">'+esc(x.s.nome)+'</span><span class="n">'+x.nov+'</span></button>').join('')
      + '</div></div>';
  }
  return h;
}

function planoCalendarioHtml(){
  const dias = cronograma(10);
  if(!dias.length || !dias[0].blocos.length) return '';
  const hoje = todayKey();
  let h = '<h2 class="sec-t">Próximos dias</h2>'
    + '<p class="pg-s">O que entra de conteúdo novo em cada dia de estudo, se você mantiver o ritmo. As revisões vencidas entram por cima, sempre primeiro.</p>'
    + '<div class="cal">';
  for(const d of dias){
    const k = todayKey(d.d);
    h += '<div class="cal-dia'+(k===hoje?' hoje':'')+'"><div class="cal-cab"><b>'
      + (k===hoje ? 'Hoje' : DIAS_LONGOS[d.d.getDay()].replace(/^./,c=>c.toUpperCase()))
      + '</b><span>'+d.d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+'</span></div>'
      + (d.blocos.length
          ? '<div class="cal-blocos">'+d.blocos.map(b=>'<span class="cal-b"><i class="p'+b.peso+'"></i>'+esc(b.nome)+' <b>'+b.n+'</b></span>').join('')+'</div>'
          : '<div class="cal-vazio">só revisões</div>')
      + '</div>';
  }
  return h + '</div>';
}

function vPlano(){
  const p = plano(), rest = restanteHoje(), diaOk = ehDiaDeEstudo();
  let h = '<h1 class="pg-t">Meu plano de estudo 📅</h1>'
    + '<p class="pg-s">Diga quanto você consegue estudar e em quais dias — o app monta a fila do que mais cai na prova para o que menos cai.</p>';
  h += diaOk
    ? '<div class="study-cta"><div><h3>'+(rest? 'Faltam '+rest+' cartas para fechar o dia' : 'Meta de hoje cumprida ✓')+'</h3>'
      + '<p>'+feitoHoje()+' de '+p.meta+' cartas · '+DIAS_LONGOS[new Date().getDay()]+' é dia de estudo</p></div>'
      + (rest? '<button class="btn" style="padding:13px 30px" onclick="startStudy(\'all\')">▶ Estudar agora</button>' : '<span class="badge" style="border-color:rgba(76,175,135,.4);color:var(--green);background:rgba(76,175,135,.1)">✓ Dia fechado</span>')
      + '</div>'
    : '<div class="study-cta"><div><h3>Hoje é seu dia de descanso 🌙</h3><p>'+DIAS_LONGOS[new Date().getDay()].replace(/^./,c=>c.toUpperCase())+' não está nos seus dias de estudo. Descansar faz parte — mas se quiser adiantar, é só começar.</p></div>'
      + '<button class="btn-o" onclick="startStudy(\'all\')">Estudar mesmo assim</button></div>';
  h += planoResumoHtml() + '<h2 class="sec-t">Sua rotina</h2>' + planoConfigHtml() + planoCalendarioHtml()
    + planoPrioridadeHtml() + planoOrdemHtml();
  return h;
}

/* CT Premium em Perfil (v37): as linhas de status agora entram DENTRO do
   primeiro box da página (junto de Nome/E-mail/Membro desde), logo abaixo
   de "Membro desde" — só os botões/avisos continuam soltos, depois do box,
   porque não são pares "rótulo: valor" e não caberiam numa .prof-row. */
function premiumStatusRowsHtml(){
  if(isAdmin()) return '<div class="prof-row"><span>CT Premium</span><b style="color:var(--green)">Administrador — acesso total</b></div>';
  const a = assinatura(), d = diasRestantesAssinatura();
  if(assinaturaValida()){
    const tr = assinaturaTrilha();
    return '<div class="prof-row"><span>Situação</span><b style="color:var(--green)">Assinatura ativa</b></div>'
      + '<div class="prof-row"><span>Trilha</span><b>'+TRILHAS[tr].nome+'</b></div>'
      + '<div class="prof-row"><span>Válida até</span><b>'+new Date(a.ate+'T12:00:00').toLocaleDateString('pt-BR')+' <span style="color:var(--txt3);font-weight:400">(faltam '+d+' dia'+(d===1?'':'s')+')</span></b></div>'
      + '<div class="prof-row"><span>Conteúdo liberado</span><b>'+fmtMil(TOTAL_TRILHA[tr])+' flashcards</b></div>';
  }
  return '<div class="prof-row"><span>Seu plano</span><b>Gratuito</b></div>'
    + '<div class="prof-row"><span>Flashcards liberados</span><b>'+totalLivres()+' de '+fmtMil(TOTAL_CARTAS_APP)+'</b></div>';
}
function premiumAcoesHtml(){
  if(isAdmin()) return '<div class="plan-box ok" style="max-width:560px;margin-top:16px"><b>Modo administrador: acesso total.</b>'
    + '<span class="plan-nota">Gere os códigos dos assinantes no painel do administrador.</span></div>';
  const d = diasRestantesAssinatura();
  if(assinaturaValida()){
    return (d<=15 ? '<div class="plan-box alerta" style="max-width:560px;margin-top:16px">Sua assinatura vence em '+d+' dia'+(d===1?'':'s')+'. Renove com o CT para receber o código novo e não perder o acesso.</div>' : '')
      + '<div class="lst-acoes" style="margin-top:14px"><button class="btn-o btn-sm" onclick="ativarPremium()">Inserir código novo</button></div>';
  }
  return '<div class="lst-acoes" style="margin-top:16px"><button class="btn" onclick="nav(\'premium\')">⭐ Assinar o CT Premium</button>'
    + '<button class="btn-o" onclick="ativarPremium()">Já tenho um código</button></div>';
}

function planoPerfilHtml(){
  const p = plano(), pv = previsao(), dg = diagnosticoProva();
  const dias = p.dias.length===7 ? 'todos os dias' : p.dias.map(i=>DIAS_NOMES[i]).join(', ');
  return '<h2 class="sec-t">📅 Meu plano de estudo</h2>'
    + '<div class="card" style="max-width:720px">'
    + '<div class="prof-row"><span>Meta diária</span><b>'+p.meta+' cartas <span style="color:var(--txt3);font-weight:400">(revisões + novas)</span></b></div>'
    + '<div class="prof-row"><span>Dias de estudo</span><b>'+dias+'</b></div>'
    + '<div class="prof-row"><span>Data da prova</span><b>'+(p.prova? new Date(p.prova+'T12:00:00').toLocaleDateString('pt-BR') + (dg? ' <span style="color:var(--txt3);font-weight:400">(em '+dg.corridos+' dias)</span>':'') : '—')+'</b></div>'
    + '<div class="prof-row"><span>Previsão de término</span><b>'+(pv.rest? pv.fim.toLocaleDateString('pt-BR') : 'conteúdo concluído')+'</b></div>'
    + '</div>'
    + '<div class="lst-acoes" style="margin-top:14px"><button class="btn" onclick="nav(\'plano\')">Ajustar meu plano</button></div>'
    + (dg && !dg.cabe ? '<div class="plan-box alerta" style="max-width:720px">No ritmo atual, cerca de <b>'+(dg.rest-dg.capacidade)+' cartas</b> não seriam vistas até a prova. <button class="btn btn-sm" style="margin-left:8px" onclick="nav(\'plano\')">Ver o que fazer</button></div>' : '');
}

/* Uma linha honesta sobre onde os dados do aluno estão. */
function seloNuvemHtml(){
  if(!nuvemLigada())
    return '<div class="nuv nuv-local"><b>💾 Salvo neste aparelho</b><span>Seu progresso fica guardado neste navegador. '
      + 'Se trocar de celular ou limpar os dados do site, ele não vem junto.</span></div>';
  if(nuvem.estado === 'erro')
    return '<div class="nuv nuv-erro"><b>⚠️ Sincronia com problema</b><span>Você pode estudar normalmente — '
      + 'assim que a conexão voltar, tudo sobe sozinho.</span></div>';
  return '<div class="nuv nuv-ok"><b>☁️ Sincronizado na sua conta</b><span>Entre com '
    + esc(user.email) + ' em qualquer aparelho e seu progresso estará lá.</span></div>';
}
function atualizarSelosNuvem(){
  if(typeof curView !== 'undefined' && curView === 'perfil' && typeof render === 'function') render();
}

function vPerfil(){
  const dt = user.created ? new Date(user.created).toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'}) : '—';
  let rev=0; for(const d in prog.log) rev+=prog.log[d].rev||0;
  return '<h1 class="pg-t">Perfil</h1><p class="pg-s">Sua conta no Flashcards CT.</p>'
    + seloNuvemHtml()
    + '<div class="card" style="max-width:560px">'
    + '<div class="prof-row"><span>Nome</span><b>'+esc(user.nome)+'</b></div>'
    + '<div class="prof-row"><span>E-mail</span><b>'+esc(user.email)+'</b></div>'
    + '<div class="prof-row"><span>Membro desde</span><b>'+dt+'</b></div>'
    + premiumStatusRowsHtml()
    + '<div class="prof-row"><span>Revisões totais</span><b>'+rev+'</b></div>'
    + '</div>'
    + premiumAcoesHtml()
    + aparenciaPerfilHtml()
    + streakPerfilHtml()
    + recordesHtml()
    + planoPerfilHtml()
    + atalhosPerfilHtml()
    + '<div style="display:flex;gap:12px;margin-top:22px;flex-wrap:wrap">'
    + '<button class="btn-o" onclick="logout()">Sair da conta</button>'
    + '<button class="danger" onclick="resetProg()">Zerar meu progresso</button>'
    + '</div>'
    + '<p style="color:var(--txt3);font-size:12.5px;margin-top:20px;max-width:560px">Seu progresso, seus favoritos e suas listas ficam salvos neste navegador/dispositivo. Para não perdê-los, estude sempre pelo mesmo aparelho.</p>'
    + favSectionHtml() + listasSectionHtml()
    + (hasRestrito() ? '<h2 class="sec-t">Trilha CT Residência</h2>' + lockCardHtml() : '')
    + '<h2 class="sec-t">Administração</h2>'
    + (isAdmin()
       ? '<div style="display:flex;gap:12px;flex-wrap:wrap"><button class="btn" onclick="nav(\'admin\')">🛠️ Abrir painel do administrador</button><button class="btn-o" onclick="adminExit()">Desativar modo admin</button></div>'
       : '<button class="btn-o" onclick="promptAdmin()">🛠️ Sou o administrador</button>');
}
function favSectionHtml(){
  const cards = favCards();
  const disp = cards.filter(visivel);
  const ocultas = cards.length - disp.length;
  return '<h2 class="sec-t">❤️ Favoritas</h2>'
    + '<div class="card" style="max-width:720px">'
    + '<div class="fav-head"><div><b>'+cards.length+'</b> flashcard'+(cards.length===1?'':'s')+' favorito'+(cards.length===1?'':'s')
    + (ocultas?' <span class="ocultas">('+ocultas+' na trilha trancada)</span>':'')+'</div>'
    + (disp.length ? '<button class="btn btn-sm" onclick="startStudy(\'fav\')">▶ Estudar favoritas</button>' : '') + '</div>'
    + (cards.length
        ? cardRowsHtml(disp, c=>'<button class="fav-x on" title="Remover dos favoritos" onclick="toggleFav(\''+c.cid+'\')">'+HEART+'</button>')
        : '<p class="lst-vazio">Toque no <b>coração</b> no canto do flashcard durante o estudo para salvá-lo aqui.</p>')
    + '</div>';
}
function listasSectionHtml(){
  const ls = prog.listas||[];
  let h = '<h2 class="sec-t">🗂️ Minhas listas</h2><div class="card" style="max-width:720px">'
    + '<div class="fav-head"><div>'+ls.length+' de '+MAX_LISTAS+' listas criadas</div>'
    + '<button class="btn btn-sm" '+(ls.length>=MAX_LISTAS?'disabled style="opacity:.45;cursor:default" ':'')
    + 'onclick="criarLista(\'\')">＋ Criar lista</button></div>';
  if(!ls.length) return h + '<p class="lst-vazio">Crie listas para separar seus flashcards do seu jeito — por assunto, por prova, pelo que você mais erra. Use o <b>+</b> no canto do flashcard para adicionar.</p></div>';
  for(const l of ls){
    const cards = listaCards(l.id), disp = cards.filter(visivel);
    h += '<div class="lst-bloco"><div class="fav-head"><div><b>'+esc(l.nome)+'</b> <span class="qt">'+cards.length+' carta'+(cards.length===1?'':'s')+'</span></div>'
      + '<div class="lst-acoes">'
      + (disp.length?'<button class="btn btn-sm" onclick="startStudy(\'lista:'+l.id+'\')">▶ Estudar</button>':'')
      + '<button class="btn-o btn-sm" onclick="renomearLista(\''+l.id+'\')">Renomear</button>'
      + '<button class="danger btn-sm" onclick="excluirLista(\''+l.id+'\')">Excluir</button></div></div>'
      + cardRowsHtml(disp, c=>'<button class="fav-x" title="Tirar da lista" onclick="toggleLista(\''+l.id+'\',\''+c.cid+'\')">✕</button>')
      + '</div>';
  }
  return h + '</div>';
}
async function resetProg(){
  if(!(await ask({title:'Zerar todo o progresso?', texto:'Todo o seu histórico de revisões será apagado, e com ele a sua sequência de dias. Isso não pode ser desfeito. Seus favoritos, listas, baralhos e os troféus já resgatados são mantidos.', okLb:'Zerar progresso'}))) return;
  prog = {cards:{}, log:{}, fav:prog.fav||{}, listas:prog.listas||[], meus:prog.meus||[], plano:prog.plano||null, trofeus:prog.trofeus||{}, genero:prog.genero||null}; saveProg();
  toast('Progresso zerado.');
  nav('dashboard');
}

/* ================= ADMINISTRADOR ================= */
/* No repositório o conteúdo é versionado no Git. O que o admin cria aqui sai
   como arquivo para subir ao GitHub — assim toda mudança de conteúdo tem
   histórico e dá para voltar atrás. */
function exportarCartas(){
  if(!pend.length) return toast('Não há cartas na lista para exportar.');
  const porSub = {};
  for(const c of pend){ (porSub[c.sub] = porSub[c.sub] || []).push({f:c.f, v:c.v, ...(c.ex?{ex:c.ex}:{})}); }
  const txt = JSON.stringify(porSub, null, 1);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], {type:'application/json'}));
  a.download = 'cartas-novas-' + todayKey() + '.json';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
  toast('Arquivo baixado — envie para subir ao GitHub 📄');
}

function isAdmin(){
  if(typeof nuvemLigada === 'function' && nuvemLigada())
    return !!(nuvem.perfil && nuvem.perfil.admin);
  return store.get(K_ADMIN)==='1';
}
async function promptAdmin(){
  const s = await ask({title:'🛠️ Modo administrador', texto:'Área do CT para adicionar e publicar flashcards.', senha:true, ph:'Senha do administrador', okLb:'Entrar'});
  if(s===null) return;
  if(!s){ toast('Digite a senha.'); return; }
  if(await hash('fcct-admin|'+s)===ADMIN_HASH){ store.set(K_ADMIN,'1'); toast('Modo administrador ativado 🛠️'); curView='admin'; renderNav(); render(); }
  else toast('Senha incorreta.');
}
function adminExit(){ store.del(K_ADMIN); toast('Modo administrador desativado.'); curView='perfil'; renderNav(); render(); }

let pend=[]; let aiBusy=false; let pubBusy=false;
let admText=''; let admSub=''; let admF=''; let admV=''; let admEx='';

function subOptions(sel){
  return DECKS.map(t=>'<optgroup label="'+esc(t.ic+' '+t.nome)+'">'
    + t.subs.map(s=>'<option value="'+s.id+'"'+(sel===s.id?' selected':'')+'>'+esc(s.nome)+'</option>').join('')
    + '</optgroup>').join('');
}

let admEmail='', admPlano='semestral', admTrilha='estagio', admCodigo=null;
/* ---- histórico dos códigos gerados neste aparelho (para o CT conferir depois) ----
   Não existe banco por padrão, então o único lugar onde isso pode "ficar
   salvo para o administrador ver" é aqui: localStorage do navegador do CT.
   Cresce sem limite seria um problema depois de anos de uso, então guarda
   só os 500 mais recentes. */
const K_ADM_CODIGOS = 'fcct_admin_codigos';
function codigosGerados(){ return store.get(K_ADM_CODIGOS) || []; }
function registrarCodigoGerado(entry){
  const lista = codigosGerados();
  lista.unshift(entry);
  if(lista.length>500) lista.length=500;
  store.set(K_ADM_CODIGOS, lista);
}
function admCodigosHtml(){
  const lista = codigosGerados();
  if(!lista.length) return '';
  return '<h3 class="cfg-lb" style="margin-top:26px">Códigos já gerados neste aparelho</h3>'
    + '<p class="cfg-ex">Histórico local, só para você conferir quem já recebeu código — não é a lista de quem está ativo agora.</p>'
    + '<div class="adm-tbl"><table><thead><tr><th>E-mail</th><th>Trilha</th><th>Plano</th><th>Código</th><th>Vence</th><th>Gerado em</th></tr></thead><tbody>'
    + lista.map(x=>'<tr><td>'+esc(x.email)+'</td><td>'+esc(TRILHAS[x.trilha]?TRILHAS[x.trilha].curto:x.trilha)+'</td>'
        + '<td>'+esc(x.plano)+'</td><td><code>'+esc(x.codigo)+'</code></td>'
        + '<td>'+new Date(x.ate+'T12:00:00').toLocaleDateString('pt-BR')+'</td>'
        + '<td>'+new Date(x.criado).toLocaleDateString('pt-BR')+'</td></tr>').join('')
    + '</tbody></table></div>';
}
function admAssinaturasHtml(){
  return nuvemLigada() ? admAssinaturasNuvemHtml() : admAssinaturasLocalHtml();
}

/* ---- com banco: libera de verdade, e mostra quem está ativo ---- */
function admAssinaturasNuvemHtml(){
  const p = PLANOS.find(x=>x.id===admPlano);
  let h = '<h2 class="sec-t">⭐ Assinaturas do CT Premium</h2>'
    + '<div class="card">'
    + '<p style="color:var(--txt2);font-size:13px;margin-bottom:14px">Depois que o aluno pagar, libere aqui pelo e-mail. '
    + 'Vale na hora, em qualquer aparelho, e não precisa de código. Pode liberar antes mesmo de ele criar a conta — '
    + 'quando se cadastrar com esse e-mail, o acesso já estará lá.</p>'
    + '<div class="fld"><label for="adm-email">E-mail do aluno</label>'
    + '<input id="adm-email" type="email" value="'+esc(admEmail)+'" oninput="admEmail=this.value" placeholder="aluno@exemplo.com"></div>'
    + '<div class="fld"><label>Plano assinado</label><div class="chip-row">'
    + PLANOS.map(x=>'<button class="chip'+(admPlano===x.id?' on':'')+'" onclick="admPlano=\''+x.id+'\';render()">'+x.nome+' · '+x.meses+' '+(x.meses===1?'mês':'meses')+'</button>').join('')
    + '</div></div>'
    + '<button class="btn" onclick="admLiberar()">Liberar Premium por '+p.meses+' '+(p.meses===1?'mês':'meses')+'</button>';

  if(admCodigo && admCodigo.id)
    h += '<div class="plan-box ok" style="margin:16px 0 0"><b>✓ '+esc(admCodigo.email)+' está com o Premium ativo</b>'
      + '<span class="plan-nota">Plano '+esc(admCodigo.plano)+', por '+admCodigo.meses+' '+(admCodigo.meses===1?'mês':'meses')+'. '
      + 'Avise o aluno para entrar (ou recarregar) e o acesso completo aparece.</span></div>';

  h += '</div>';
  h += admListaAlunosHtml();
  return h;
}

function admListaAlunosHtml(){
  let h = '<h2 class="sec-t">👥 Alunos</h2><div class="card">';
  if(admAlunos === null){
    h += admCarregando
      ? '<p style="color:var(--txt2);font-size:13px">Carregando…</p>'
      : '<p style="color:var(--txt2);font-size:13px;margin-bottom:12px">Quem criou conta, quem está com Premium e quanto cada um estudou.</p>'
        + '<button class="btn-o btn-sm" onclick="admCarregarAlunos()">Ver alunos</button>';
    return h + '</div>';
  }
  if(!admAlunos.length) return h + '<p style="color:var(--txt2);font-size:13px">Nenhum aluno cadastrado ainda.</p></div>';

  const q = admBusca.trim().toLowerCase();
  const lista = q ? admAlunos.filter(a => (a.email+' '+(a.nome||'')).toLowerCase().includes(q)) : admAlunos;
  const comPlano = admAlunos.filter(a=>a.plano).length;

  h += '<p style="color:var(--txt2);font-size:13px;margin-bottom:12px"><b style="color:var(--txt)">'+admAlunos.length+'</b> '
    + (admAlunos.length===1?'aluno':'alunos')+' · <b style="color:var(--gold)">'+comPlano+'</b> com Premium ativo</p>'
    + '<div class="fld"><input type="search" value="'+esc(admBusca)+'" oninput="admBusca=this.value;render()" placeholder="Buscar por nome ou e-mail"></div>';

  h += lista.slice(0,120).map(a=>{
    const dias = a.fim ? Math.ceil((new Date(a.fim+'T23:59:59') - new Date())/864e5) : null;
    const selo = a.plano
      ? '<span class="sr-tag free">'+esc(a.plano)+' · '+dias+'d</span>'
      : '';
    const adm = a.admin ? '<span class="sr-tag lock">admin</span>' : '';
    return '<div class="lst-row"><div class="sr-name"><b>'+esc(a.nome||a.email.split('@')[0])+'</b>'+selo+adm
      + '<span>'+esc(a.email)+'</span></div>'
      + '<div class="sr-nums"><span class="n-done"><b>'+(a.cartas_estudadas||0)+'</b> cartas</span>'
      + '<span class="n-due"><b>'+(a.revisoes||0)+'</b> revisões</span></div>'
      + '<button class="btn-o btn-sm" onclick="admEmail=\''+esc(a.email)+'\';render()">Liberar</button></div>';
  }).join('');
  if(lista.length > 120) h += '<p style="color:var(--txt3);font-size:12px;margin-top:10px">Mostrando 120 de '+lista.length+' — use a busca.</p>';
  h += '<div class="lst-acoes" style="margin-top:12px"><button class="btn-o btn-sm" onclick="admAlunos=null;render()">Atualizar</button></div>';
  return h + '</div>';
}

/* ---- sem banco: o código continua sendo o único jeito ---- */
function admAssinaturasLocalHtml(){
  return '<h2 class="sec-t">⭐ Assinaturas do CT Premium</h2>'
    + '<div class="card">'
    + '<p style="color:var(--txt2);font-size:13px;margin-bottom:14px">Depois que o aluno pagar, gere aqui o código dele. O código só funciona no e-mail da conta e vence junto com o plano — para renovar, gere um novo.</p>'
    + '<div class="fld"><label for="adm-email">E-mail da conta do aluno</label>'
    + '<input id="adm-email" type="email" value="'+esc(admEmail)+'" oninput="admEmail=this.value" placeholder="aluno@exemplo.com"></div>'
    + '<div class="fld"><label>Qual trilha ele assinou?</label><div class="chip-row">'
    + Object.values(TRILHAS).map(t=>'<button class="chip'+(admTrilha===t.id?' on':'')+'" onclick="admTrilha=\''+t.id+'\';render()">'+t.ic+' '+t.nome+'</button>').join('')
    + '</div><p class="cfg-ex" style="margin-top:6px">'+(admTrilha==='estagio'
        ? 'O código libera só o conteúdo do CT Estágio.'
        : 'O código libera todos os flashcards do app, incluindo o CT Estágio.')+'</p></div>'
    + '<div class="fld"><label>Plano assinado</label><div class="chip-row">'
    + PLANOS.map(p=>'<button class="chip'+(admPlano===p.id?' on':'')+'" onclick="admPlano=\''+p.id+'\';render()">'+p.nome+' · '+p.meses+' '+(p.meses===1?'mês':'meses')+'</button>').join('')
    + '</div></div>'
    + '<button class="btn" onclick="admGerar()">Gerar código de acesso</button>'
    + '<div class="lst-acoes" style="margin-top:14px"><button class="btn-o btn-sm" onclick="exportarCartas()">Baixar cartas novas (JSON)</button></div>'
    + (admCodigo
        ? '<div class="plan-box ok" style="margin:16px 0 0"><b>Código de '+esc(admCodigo.email)+' — '+TRILHAS[admCodigo.trilha].nome+'</b>'
          + '<div class="cod">'+admCodigo.codigo+'</div>'
          + '<span class="plan-nota">Plano '+admCodigo.plano+' · vence em <b>'+new Date(admCodigo.ate+'T12:00:00').toLocaleDateString('pt-BR')+'</b>. '
          + 'Envie este código ao aluno; ele ativa em Perfil → CT Premium. Só funciona nesse e-mail'
          + (admCodigo.trilha==='estagio' ? ' e só libera o CT Estágio.' : ' e libera tudo, incluindo a CT Residência.') + '</span>'
          + '<div class="lst-acoes" style="margin-top:12px"><button class="btn-o btn-sm" onclick="admCopiar()">Copiar código</button></div></div>'
        : '')
    + '</div>'
    + admCodigosHtml();
}
/* Com banco configurado, liberar o Premium é uma linha na tabela `assinaturas`,
   criada pela função admin_liberar(). Vale em qualquer aparelho do aluno, e ele
   não consegue forjar — é o servidor que responde se a assinatura existe. */
let admAlunos = null, admCarregando = false, admBusca = '';

async function admLiberar(){
  const e = String(admEmail||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)){ toast('Digite um e-mail válido.'); return; }
  const p = PLANOS.find(x=>x.id===admPlano);
  try{
    const {data, error} = await nuvem.sb.rpc('admin_liberar', {
      p_email: e, p_plano: p.id, p_meses: p.meses, p_obs: null
    });
    if(error) throw error;
    admCodigo = {email:e, plano:p.nome.toLowerCase(), id:data, meses:p.meses};
    admAlunos = null;
    toast('Premium liberado para ' + e + ' ⭐');
    render();
  }catch(err){
    const m = String(err.message||'');
    toast(/administrador/i.test(m) ? 'Sua conta não tem permissão de administrador.'
          : 'Não consegui liberar: ' + m);
  }
}

/* A lista de alunos vem de admin_alunos(), que só responde para admin. */
async function admCarregarAlunos(){
  if(admCarregando) return;
  admCarregando = true; render();
  try{
    const {data, error} = await nuvem.sb.rpc('admin_alunos');
    if(error) throw error;
    admAlunos = data || [];
  }catch(err){
    admAlunos = [];
    toast('Não consegui carregar os alunos: ' + err.message);
  }finally{ admCarregando = false; render(); }
}

async function admGerar(){
  const e = String(admEmail||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)){ toast('Digite um e-mail válido.'); return; }
  const p = PLANOS.find(x=>x.id===admPlano);
  const r = await gerarCodigo(e, p.meses, admTrilha);
  admCodigo = {email:e, plano:p.nome.toLowerCase(), trilha:r.trilha, codigo:r.codigo, ate:r.ate};
  registrarCodigoGerado({email:e, plano:p.nome, trilha:r.trilha, codigo:r.codigo, ate:r.ate, criado:Date.now()});
  render();
}
function admCopiar(){
  if(!admCodigo) return;
  const t = admCodigo.codigo;
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(()=>toast('Código copiado.'), ()=>toast(t));
  else toast(t);
}

function vAdmin(){
  if(!isAdmin()) return vPerfil();
  let h = '<h1 class="pg-t">Painel do administrador 🛠️</h1>'
    + '<p class="pg-s">Adicione flashcards, deixe a IA organizá-los nos temas e subtemas adequados e publique para todos os estudantes — o link não muda.</p>';
  if(window.claude && window.claude.use) h += '<div class="card" style="margin-bottom:16px"><h3 style="font-size:16px;margin-bottom:8px">🤖 Adicionar com IA</h3>'
    + '<p style="color:var(--txt2);font-size:13px;margin-bottom:12px">Cole qualquer conteúdo — resumo, questões comentadas, trechos de PDF. A IA cria os flashcards e escolhe o subtema de cada um; você revisa antes de publicar.</p>'
    + '<textarea id="adm-text" class="adm-ta" placeholder="Cole aqui o conteúdo…" oninput="admText=this.value">'+esc(admText)+'</textarea>'
    + '<button class="btn" style="margin-top:12px" '+(aiBusy?'disabled':'')+' onclick="adminAI()">'+(aiBusy?'🤖 Organizando… (pode levar ~1 min)':'🤖 Organizar com IA')+'</button></div>';
  h += '<div class="card" style="margin-bottom:16px"><h3 style="font-size:16px;margin-bottom:12px">✍️ Adicionar manualmente</h3>'
    + '<div class="fld"><label>Subtema</label><select id="adm-sub" class="adm-sel" onchange="admSub=this.value">'+subOptions(admSub)+'</select></div>'
    + '<div class="fld"><label for="adm-f">Frente (pergunta)</label><input id="adm-f" value="'+esc(admF)+'" oninput="admF=this.value" placeholder="Ex.: Qual a dose de adrenalina na PCR?"></div>'
    + '<div class="fld"><label for="adm-v">Verso (resposta)</label><input id="adm-v" value="'+esc(admV)+'" oninput="admV=this.value" placeholder="Ex.: 1 mg IV a cada 3-5 minutos."></div>'
    + '<div class="fld"><label for="adm-ex">Dica/armadilha (opcional)</label><input id="adm-ex" value="'+esc(admEx)+'" oninput="admEx=this.value" placeholder="Ex.: Não confundir com a dose da anafilaxia (IM)."></div>'
    + '<button class="btn-o" onclick="adminManual()">Adicionar à lista</button></div>';
  if(pend.length){
    h += '<h2 class="sec-t">Cartões preparados ('+pend.length+') — revise o subtema de cada um</h2>'
      + pend.map((c,i)=>'<div class="pend-row"><div class="pr-main"><b>'+esc(c.f)+'</b><span>'+esc(c.v)+'</span></div>'
        + '<select class="adm-sel pr-sel" onchange="pend['+i+'].sub=this.value">'+subOptions(c.sub)+'</select>'
        + '<button class="st-x" onclick="pend.splice('+i+',1);render()" aria-label="Remover">✕</button></div>').join('')
      + '<button class="btn btn-block" style="margin-top:14px;padding:15px" '+(pubBusy?'disabled':'')+' onclick="adminPublish()">'
      + (pubBusy?'💾 Publicando…':'💾 Publicar '+pend.length+(pend.length>1?' cartões':' cartão')+' para os estudantes')+'</button>';
    if(!(window.claude && window.claude.use))
      h += '<button class="btn btn-block" style="margin-top:10px;padding:15px" onclick="exportarCartas()">'
        + '📄 Baixar arquivo para subir ao GitHub</button>'
        + '<p style="color:var(--txt3);font-size:12.5px;margin-top:8px;line-height:1.5">Neste site o conteúdo mora em arquivos versionados. '
        + 'Baixe o arquivo e envie para mim, ou suba direto em <code>public/data/temas/</code> — ver docs/OPERACAO.md.</p>';
  }
  h += admAssinaturasHtml();
  h += (window.claude && window.claude.use)
    ? '<p style="color:var(--txt3);font-size:12.5px;margin-top:18px">A publicação cria uma nova versão do app no mesmo link; os cartões novos aparecem como novas para os estudantes, sem afetar o progresso deles.</p>'
    : '<p style="color:var(--txt3);font-size:12.5px;margin-top:18px;line-height:1.6">Neste endereço a organização por IA não está disponível — ela depende do app aberto dentro do claude.ai. '
      + 'Adicione as cartas à mão aqui, baixe o arquivo e suba ao GitHub: o conteúdo passa a ter histórico de versões e dá para voltar atrás.</p>';
  return h;
}

function adminManual(){
  if(!admF.trim()||!admV.trim()){ toast('Preencha frente e verso.'); return; }
  const sub = admSub || DECKS[0].subs[0].id;
  pend.push({sub, f:admF.trim(), v:admV.trim(), ex:admEx.trim()||undefined});
  admF=''; admV=''; admEx='';
  toast('Cartão adicionado à lista.');
  render();
}

async function adminAI(){
  if(aiBusy) return;
  const txt=(admText||'').trim();
  if(txt.length<20){ toast('Cole um conteúdo maior para a IA organizar.'); return; }
  const sample = (window.claude&&window.claude.use) ? await claude.use('sample') : null;
  if(!sample){ toast('IA indisponível aqui — abra o app pelo claude.ai (conta do dono).'); return; }
  aiBusy=true; render();
  try{
    const cat=[]; for(const t of DECKS) for(const s of t.subs) cat.push(s.id+' — '+t.nome+' › '+s.nome);
    const prompt='Você organiza flashcards de Medicina (português do Brasil) para estudantes que estudam para provas de estágio/residência.\n'
      +'Transforme o CONTEÚDO abaixo em flashcards e classifique cada um no subtema mais adequado do CATÁLOGO.\n\n'
      +'Responda APENAS com um array JSON, sem nenhum texto fora dele, neste formato:\n'
      +'[{"sub":"id-do-subtema","f":"pergunta direta e específica","v":"resposta objetiva, até 300 caracteres, com doses/critérios/valores","ex":"armadilha ou pegadinha de prova, opcional, até 200 caracteres"}]\n'
      +'Regras: "sub" tem que ser exatamente um id do catálogo; crie quantos cartões o conteúdo render (1 a 30); não invente conteúdo que não esteja no texto; não use numeração.\n\n'
      +'CATÁLOGO DE SUBTEMAS:\n'+cat.join('\n')+'\n\nCONTEÚDO:\n'+txt.slice(0,45000);
    const arr = await sample.json(prompt, {cache:false});
    const valid = (Array.isArray(arr)?arr:[]).filter(c=>c && c.f && c.v && findSub(String(c.sub||'')))
      .map(c=>({sub:String(c.sub), f:String(c.f), v:String(c.v), ex:c.ex?String(c.ex):undefined}));
    if(!valid.length){ toast('A IA não retornou cartões válidos — tente colar um conteúdo mais claro.'); }
    else{ pend.push(...valid); admText=''; toast(valid.length+' cartões preparados — revise e publique.'); }
  }catch(e){
    const m={ not_granted:'Uso da IA não autorizado neste dispositivo.', sampling_disabled:'IA indisponível nesta conta.',
      rate_limited:'Muitas chamadas em sequência — aguarde um pouco.', refused:'A IA recusou este conteúdo.',
      invalid_json:'A resposta da IA veio fora do formato — clique de novo para tentar outra vez.',
      prompt_too_large:'Conteúdo grande demais — cole menos texto por vez.', cancelled:'Chamada cancelada.' };
    toast(m[(e&&e.code)||'']||'Falha ao consultar a IA — tente novamente.');
  } finally { aiBusy=false; render(); }
}

/* No repositório o conteúdo mora em data/temas/*.json, versionado no Git.
   O painel do admin exporta um arquivo para o CT subir ao GitHub — ver exportarCartas(). */

async function adminPublish(){
  if(pubBusy || !pend.length) return;
  const artifact = (window.claude&&window.claude.use) ? await claude.use('artifact') : null;
  if(!artifact){ toast('Publicação indisponível aqui — abra o app pelo claude.ai (conta do dono).'); return; }
  pubBusy=true; render();
  const stamp='a'+Date.now().toString(36);
  try{
    pend.forEach((c,i)=>{
      const r=findSub(c.sub); if(!r) return;
      const card={id:c.sub+'-'+stamp+'-'+i, f:c.f, v:c.v}; if(c.ex) card.ex=c.ex;
      r.s.cards.push(card);
    });
    await artifact.publish(buildSelfHtml());
    pend=[];
    toast('Publicado! O app vai atualizar em instantes…');
  }catch(e){
    for(const t of DECKS) for(const s of t.subs) s.cards=s.cards.filter(c=>c.id.indexOf('-'+stamp+'-')===-1);
    const m={ conflict:'Outra versão acabou de ser publicada — a página vai atualizar; repita a publicação em seguida.',
      not_writer:'Somente o dono/editores do app podem publicar.', not_granted:'Somente o dono/editores do app podem publicar.',
      too_large:'O app ficou grande demais para publicar — fale com o Claude para otimizar.',
      rate_limited:'Muitas publicações seguidas — aguarde um pouco e tente de novo.',
      invalid_content:'Erro interno ao montar a página — avise o Claude.' };
    toast(m[(e&&e.code)||'']||'Falha ao publicar — tente novamente.');
  } finally { pubBusy=false; render(); }
}

/* ================= MIGRAÇÃO DE PROGRESSO (v3 → v4) =================
   Na v3 os ids eram deckId#índice e o baralho 'clm' existia; na v4 os
   cards carregam id explícito (os antigos mantêm o id v3, inclusive os
   de clm). Nada a converter — os ids antigos continuam válidos. */

/* ================= LANDING (dados dinâmicos) ================= */
/* Números redondos ANTES de logar (v37, a pedido do CT) — a landing não deve
   prometer uma contagem exata que muda a cada auditoria de conteúdo; ela
   arredonda sempre PARA BAIXO (nunca promete mais do que o app realmente
   tem), com "+" na frente. A granularidade acompanha a ordem de grandeza:
   milhares arredondam para o milhar cheio (10.384 → 10.000), dezenas/
   centenas para a dezena cheia (267 → 260, 23 → 20) — depois de logado, o
   resto do app (Perfil, Estatísticas...) continua mostrando os números
   exatos normalmente, isso é só para a vitrine de quem ainda não entrou. */
function aproxBaixo(n){
  if(n>=1000) return Math.floor(n/1000)*1000;
  if(n>=20) return Math.floor(n/10)*10;
  return n;
}
const fmtAprox = n => '+'+fmtMil(aproxBaixo(n));
function initLanding(){
  $('yr').textContent = new Date().getFullYear();
  const tc = DECKS.reduce((a,t)=>a+t.subs.reduce((b,s)=>b+s.cards.length,0),0);
  const ts = DECKS.reduce((a,t)=>a+t.subs.length,0);
  $('land-stats').innerHTML =
    '<div><b>'+fmtAprox(tc)+'</b><span>flashcards</span></div>'
    + '<div><b>'+fmtAprox(DECKS.length)+'</b><span>temas</span></div>'
    + '<div><b>'+fmtAprox(ts)+'</b><span>subtemas</span></div>'
    + '<div><b>SRS</b><span>revisão espaçada</span></div>';
  const pubD = DECKS.filter(t=>!t.restrito);
  const resD = DECKS.filter(t=>t.restrito);
  const resSubs = resD.reduce((a,t)=>a+t.subs.length,0);
  const resCards = resD.reduce((a,t)=>a+t.subs.reduce((b,s)=>b+s.cards.length,0),0);
  const lr = $('land-restrito');
  if(lr) lr.innerHTML = resD.length
    ? '<div class="lockcard" style="max-width:760px;margin:0 auto"><h3>🏥 CT Residência — trilha com acesso restrito</h3><p>'
      + 'Todos os ' + fmtAprox(tc) + ' flashcards do app, incluindo ' + resD.map(t=>t.ic+' '+esc(t.nome)).join(' · ')
      + ' — mais ' + fmtAprox(resSubs) + ' subtemas e ' + fmtAprox(resCards)
      + ' cartas com tabelas e fluxogramas. Liberada pela senha fornecida pelo CT.</p></div>'
    : '';
  $('land-decks').innerHTML = pubD.map(t=>
    '<div class="land-deck"><div class="top">'+t.ic+'<b>'+esc(t.nome)+'</b></div><span>'+esc(t.desc)+'</span><span style="color:var(--blue);font-weight:600;font-size:12.5px">'+t.subs.length+' subtemas · '+t.subs.reduce((a,s)=>a+s.cards.length,0)+' flashcards</span></div>'
  ).join('');
}

/* ================= BOOT ================= */
/* A ordem importa: sem o índice não há DECKS, e sem DECKS nenhuma tela desenha. */
async function boot(){
  try{
    await carregarIndice();
  }catch(e){
    document.body.innerHTML = '<div style="max-width:520px;margin:18vh auto;padding:0 24px;font-family:system-ui;color:#fff;text-align:center">'
      + '<h1 style="font-size:22px;margin-bottom:10px">Não consegui carregar os flashcards</h1>'
      + '<p style="opacity:.7;line-height:1.6">Verifique sua conexão e recarregue a página. Se continuar, avise o CT.</p>'
      + '<button onclick="location.reload()" style="margin-top:18px;background:#3d85d8;color:#fff;border:0;border-radius:8px;padding:12px 24px;font-size:14px;font-weight:600;cursor:pointer">Tentar de novo</button></div>';
    console.error(e); return;
  }

  initLanding();
  await iniciarNuvem();

  if(nuvemLigada()){
    const u = await nuvemSessao();
    if(u){ await entrarComNuvem(u); return; }
    showPage('landing');
    return;
  }

  /* modo local — igual ao app de arquivo único */
  const sess = store.get(K_SESS);
  if(sess){
    const users = store.get(K_USERS)||{};
    if(users[sess]){ enterApp(users[sess]); return; }
  }
  showPage('landing');
}

/* Entra no app com uma sessão do Supabase: perfil, assinatura e a mistura
   do progresso do servidor com o que já havia neste aparelho. */
async function entrarComNuvem(u){
  await nuvemPerfil();
  await nuvemAssinatura();
  const nome = (nuvem.perfil && nuvem.perfil.nome) || u.email.split('@')[0];
  const conta = {nome, email: u.email};

  const local = store.get(kProg(u.email));
  let remoto = null;
  try{ remoto = await nuvemBaixarProgresso(); }catch(e){ console.warn(e); }
  if(remoto){
    const juntos = misturarProgresso(local, remoto);
    store.set(kProg(u.email), juntos);
  }

  enterApp(conta);
  if(nuvem.perfil && nuvem.perfil.genero && !prog.genero){ prog.genero = nuvem.perfil.genero; saveProg(); }
  /* o que o servidor ainda não tem (estudo offline) sobe agora */
  nuvemAgendarEnvio();
  nuvem.estado = 'ok';
  /* adianta o tema de maior peso do plano, para a 1ª sessão abrir na hora */
  const s0 = (typeof subsPriorizados === 'function' ? subsPriorizados() : [])[0];
  if(s0 && s0.t) preCarregar([s0.t.id]);
}

boot();
