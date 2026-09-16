/* Gera o conteúdo estático do repositório a partir do app de arquivo único.
   - public/data/index.json     → temas, subtemas, pesos, ids das cartas (leve)
   - public/data/temas/<id>.json → o texto das cartas daquele tema

   A ideia: o índice é o bastante para desenhar TODAS as telas de lista, contar
   revisões pendentes e montar o cronograma. O texto das cartas — que é o que
   pesa — só é buscado quando o aluno abre aquele tema para estudar.

   Uso: node scripts/split_content.js [caminho/para/flashcards-ct.html] */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const FONTE = process.argv[2] || path.resolve(RAIZ, '..', 'flashcards-ct.html');
const SAIDA = path.join(RAIZ, 'public', 'data');

const html = fs.readFileSync(FONTE, 'utf8');
const m = html.match(/<script type="application\/json" id="decks-data">([\s\S]*?)<\/script>/);
if (!m) throw new Error('não achei o #decks-data em ' + FONTE);
const D = JSON.parse(m[1]);

fs.mkdirSync(path.join(SAIDA, 'temas'), { recursive: true });

const idx = { v: 1, geradoEm: new Date().toISOString().slice(0, 10), temas: [] };
let totalCartas = 0, totalSubs = 0, bytesTemas = 0;
const idsVistos = new Set();

for (const t of D) {
  const tema = {
    id: t.id, nome: t.nome, ic: t.ic, desc: t.desc, trilha: t.trilha,
    ...(t.restrito ? { restrito: 1 } : {}), ...(t.fs ? { fs: t.fs } : {}),
    subs: []
  };
  const pacote = {};

  for (const s of t.subs) {
    const nb = s.cards.filter(c => c.b).length;
    /* as cartas de base têm de estar no começo — o app conta com isso */
    if (!s.cards.slice(0, nb).every(c => c.b)) throw new Error(s.id + ': cartas de base fora do início');

    tema.subs.push({ id: s.id, nome: s.nome, p: s.p, nb, cards: s.cards.map(c => c.id) });

    const bloco = {};
    for (const c of s.cards) {
      if (idsVistos.has(c.id)) throw new Error('id repetido no app: ' + c.id);
      idsVistos.add(c.id);
      bloco[c.id] = c.ex ? { f: c.f, v: c.v, ex: c.ex } : { f: c.f, v: c.v };
    }
    pacote[s.id] = bloco;
    totalCartas += s.cards.length; totalSubs++;
  }

  const arq = path.join(SAIDA, 'temas', t.id + '.json');
  const txt = JSON.stringify(pacote);
  fs.writeFileSync(arq, txt);
  bytesTemas += txt.length;
  tema.bytes = txt.length;
  idx.temas.push(tema);
}

idx.total = totalCartas;
idx.subs = totalSubs;
const idxTxt = JSON.stringify(idx);
fs.writeFileSync(path.join(SAIDA, 'index.json'), idxTxt);

/* conferência: nenhum id perdido entre o app e os arquivos */
let conferidas = 0;
for (const tema of idx.temas) {
  const pacote = JSON.parse(fs.readFileSync(path.join(SAIDA, 'temas', tema.id + '.json'), 'utf8'));
  for (const s of tema.subs) {
    if (!pacote[s.id]) throw new Error('bloco ausente: ' + s.id);
    for (const id of s.cards) {
      const c = pacote[s.id][id];
      if (!c || !c.f || !c.v) throw new Error('carta incompleta ou ausente: ' + id);
      conferidas++;
    }
  }
}
if (conferidas !== totalCartas) throw new Error('conferi ' + conferidas + ' de ' + totalCartas);

const mb = n => (n / 1048576).toFixed(2) + ' MB';
const kb = n => (n / 1024).toFixed(0) + ' KB';
console.log('índice      : ' + kb(idxTxt.length) + '  (' + idx.temas.length + ' temas · ' + totalSubs + ' subtemas · ' + totalCartas + ' cartas)');
console.log('temas       : ' + mb(bytesTemas) + ' em ' + idx.temas.length + ' arquivos');
console.log('maior tema  : ' + kb(Math.max(...idx.temas.map(t => t.bytes))) + '  · média ' + kb(bytesTemas / idx.temas.length));
console.log('\nO aluno baixa ' + kb(idxTxt.length) + ' para abrir o app, e só o tema que for estudar.');
console.log('✅ ' + conferidas + ' cartas conferidas, nenhum id perdido');
