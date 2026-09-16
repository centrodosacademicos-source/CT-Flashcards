/* ============================================================
   Conteúdo — carregamento sob demanda
   ------------------------------------------------------------
   O app abre com data/index.json (~35 KB comprimido): temas,
   subtemas, pesos e os ids de todas as cartas. Isso basta para
   desenhar todas as listas, contar revisões pendentes, montar o
   cronograma e as estatísticas.

   O texto das cartas — que é o que pesa — vem de
   data/temas/<tema>.json e só é buscado quando o aluno vai
   mesmo estudar aquele tema. Uma vez baixado, fica em memória
   pelo resto da sessão.
   ============================================================ */

/* DECKS tem exatamente a mesma forma do app de arquivo único; a diferença é
   que as cartas começam como esboço ({id, b}) e ganham f/v/ex ao hidratar. */
var DECKS = [];
var CONTEUDO_INFO = { total: 0, subs: 0, geradoEm: null };

const _temasCarregados = new Set();
const _temasBaixando = new Map();

const _base = () => (window.CT_CONFIG && window.CT_CONFIG.DADOS) || 'data/';

async function _buscaJson(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error('não consegui baixar ' + url + ' (HTTP ' + r.status + ')');
  return r.json();
}

/* ---- índice: chamado uma vez, antes de o app aparecer ---- */
async function carregarIndice() {
  const idx = await _buscaJson(_base() + 'index.json');
  DECKS = idx.temas.map(t => ({
    id: t.id, nome: t.nome, ic: t.ic, desc: t.desc, trilha: t.trilha,
    ...(t.restrito ? { restrito: 1 } : {}), ...(t.fs ? { fs: t.fs } : {}),
    subs: t.subs.map(s => ({
      id: s.id, nome: s.nome, p: s.p,
      /* esboços: as nb primeiras são as cartas de base (Revisão rápida) */
      cards: s.cards.map((id, i) => (i < s.nb ? { id, b: 1 } : { id }))
    }))
  }));
  CONTEUDO_INFO = { total: idx.total, subs: idx.subs, geradoEm: idx.geradoEm };
  window.DECKS = DECKS;
  return DECKS;
}

/* ---- um tema ---- */
function temaCarregado(temaId) { return _temasCarregados.has(temaId); }

function carregarTema(temaId) {
  if (_temasCarregados.has(temaId)) return Promise.resolve();
  if (_temasBaixando.has(temaId)) return _temasBaixando.get(temaId);

  const p = _buscaJson(_base() + 'temas/' + temaId + '.json').then(pacote => {
    const t = DECKS.find(x => x.id === temaId);
    if (!t) throw new Error('tema desconhecido: ' + temaId);
    for (const s of t.subs) {
      const bloco = pacote[s.id];
      if (!bloco) continue;
      for (const c of s.cards) {
        const d = bloco[c.id];
        if (!d) continue;
        c.f = d.f; c.v = d.v;
        if (d.ex) c.ex = d.ex;
      }
    }
    _temasCarregados.add(temaId);
    _temasBaixando.delete(temaId);
  }).catch(e => { _temasBaixando.delete(temaId); throw e; });

  _temasBaixando.set(temaId, p);
  return p;
}

/* ---- vários temas, em paralelo ---- */
function carregarTemas(ids) {
  return Promise.all([...new Set(ids)].filter(Boolean).map(carregarTema));
}

/* ---- de que temas um alvo de estudo precisa ---- */
function temasDoAlvo(target) {
  if (!target) return DECKS.map(t => t.id);
  if (target.startsWith('base:')) return temasDoAlvo(target.slice(5));
  if (target === 'all') return DECKS.map(t => t.id);
  if (target.startsWith('tema:')) return [target.slice(5)];
  if (target.startsWith('sub:')) { const r = findSub(target.slice(4)); return r ? [r.t.id] : []; }
  if (target === 'fav') return temasDosCards(Object.keys((window.prog || {}).fav || {}));
  if (target.startsWith('lista:')) {
    const l = ((window.prog || {}).listas || []).find(x => x.id === target.slice(6));
    return l ? temasDosCards(l.cards) : [];
  }
  if (target.startsWith('meu:')) return [];              // baralho do aluno: já está no progresso
  return [];
}

/* mapa cardId → temaId, montado uma vez a partir do índice */
let _mapaCard = null;
function _mapa() {
  if (_mapaCard) return _mapaCard;
  _mapaCard = new Map();
  for (const t of DECKS) for (const s of t.subs) for (const c of s.cards) _mapaCard.set(c.id, t.id);
  return _mapaCard;
}
function temasDosCards(ids) {
  const m = _mapa(), out = new Set();
  for (const id of ids || []) { const t = m.get(id); if (t) out.add(t); }
  return [...out];
}

/* ---- garante o texto antes de usar; devolve true se deu certo ---- */
async function garantirConteudo(target) {
  const ids = temasDoAlvo(target).filter(id => !_temasCarregados.has(id));
  if (!ids.length) return true;
  try {
    if (typeof mostrarCarregando === 'function') mostrarCarregando(ids.length);
    await carregarTemas(ids);
    return true;
  } catch (e) {
    if (typeof toast === 'function') toast('Não consegui baixar o conteúdo. Verifique sua conexão.');
    console.error(e);
    return false;
  } finally {
    if (typeof esconderCarregando === 'function') esconderCarregando();
  }
}

/* ---- pré-carrega em segundo plano, sem travar a tela ---- */
function preCarregar(ids) {
  for (const id of [...new Set(ids)].filter(x => x && !_temasCarregados.has(x))) {
    carregarTema(id).catch(() => {});
  }
}
