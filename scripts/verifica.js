/* Portão antes de publicar. Roda no GitHub Actions a cada alteração e localmente
   com `npm test`. Se algo aqui falhar, o site NÃO vai ao ar.
   Uso: node scripts/verifica.js */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const PUB = path.join(RAIZ, 'public');
let falhas = 0;
const ok = (l, cond, detalhe) => {
  if (!cond) falhas++;
  console.log((cond ? '✓' : '✗') + ' ' + l + (cond || !detalhe ? '' : '  → ' + detalhe));
};

/* ---------- 1. arquivos obrigatórios ---------- */
const OBRIG = [
  'index.html', 'manifest.webmanifest', 'sw.js',
  'assets/css/app.css',
  'assets/js/config.js', 'assets/js/conteudo.js', 'assets/js/nuvem.js', 'assets/js/app.js',
  'assets/img/icone.svg', 'assets/img/icone-192.png', 'assets/img/icone-512.png',
  'assets/img/icone-maskable-512.png', 'assets/img/favicon.ico',
  'assets/img/apple-touch-icon.png', 'assets/img/og.png',
  'assets/img/app-icon-1024.png', 'assets/img/app-icon-512.png',
  'data/index.json'
];
for (const f of OBRIG) ok('existe ' + f, fs.existsSync(path.join(PUB, f)));

/* ---------- 2. JavaScript sem erro de sintaxe ---------- */
for (const j of ['config.js', 'conteudo.js', 'nuvem.js', 'app.js']) {
  let bom = true, err = '';
  try { execFileSync(process.execPath, ['--check', path.join(PUB, 'assets/js', j)], { stdio: 'pipe' }); }
  catch (e) { bom = false; err = String(e.stderr || e.message).split('\n').slice(0, 2).join(' '); }
  ok('sintaxe de ' + j, bom, err);
}
let swOk = true; try { execFileSync(process.execPath, ['--check', path.join(PUB, 'sw.js')], { stdio: 'pipe' }); } catch (e) { swOk = false; }
ok('sintaxe de sw.js', swOk);

/* ---------- 3. JSON válido ---------- */
let manifest = null, idx = null;
try { manifest = JSON.parse(fs.readFileSync(path.join(PUB, 'manifest.webmanifest'), 'utf8')); ok('manifest.webmanifest é JSON válido', true); }
catch (e) { ok('manifest.webmanifest é JSON válido', false, e.message); }
try { idx = JSON.parse(fs.readFileSync(path.join(PUB, 'data/index.json'), 'utf8')); ok('data/index.json é JSON válido', true); }
catch (e) { ok('data/index.json é JSON válido', false, e.message); }

/* ---------- 4. o conteúdo bate ---------- */
if (idx) {
  ok('índice tem temas', idx.temas && idx.temas.length > 0);
  let cartas = 0, subs = 0, idsVistos = new Set(), dup = null, semArquivo = [], incompletas = 0;
  for (const t of idx.temas) {
    const arq = path.join(PUB, 'data/temas', t.id + '.json');
    if (!fs.existsSync(arq)) { semArquivo.push(t.id); continue; }
    let pacote; try { pacote = JSON.parse(fs.readFileSync(arq, 'utf8')); }
    catch (e) { semArquivo.push(t.id + ' (JSON inválido)'); continue; }
    for (const s of t.subs) {
      subs++;
      const bloco = pacote[s.id] || {};
      for (const id of s.cards) {
        cartas++;
        if (idsVistos.has(id)) dup = dup || id;
        idsVistos.add(id);
        const c = bloco[id];
        if (!c || !c.f || !c.v) incompletas++;
      }
    }
  }
  ok('todo tema tem seu arquivo de cartas', !semArquivo.length, semArquivo.join(', '));
  ok('nenhum id de carta repetido', !dup, dup);
  ok('nenhuma carta sem frente ou verso', incompletas === 0, incompletas + ' incompleta(s)');
  ok('contagem do índice confere', cartas === idx.total, cartas + ' ≠ ' + idx.total);
  ok('subtemas conferem', subs === idx.subs, subs + ' ≠ ' + idx.subs);
  console.log('  (' + idx.temas.length + ' temas · ' + subs + ' subtemas · ' + cartas + ' cartas)');
}

/* ---------- 5. o manifest aponta para ícones que existem ---------- */
if (manifest) {
  const faltando = (manifest.icons || []).map(i => i.src).filter(src => !fs.existsSync(path.join(PUB, src)));
  ok('ícones do manifest existem', !faltando.length, faltando.join(', '));
}

/* ---------- 6. o index.html está montado ---------- */
if (fs.existsSync(path.join(PUB, 'index.html'))) {
  const h = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  for (const [nome, trecho] of [
    ['carrega o app.js', 'assets/js/app.js'],
    ['carrega o conteudo.js', 'assets/js/conteudo.js'],
    ['carrega o config.js', 'assets/js/config.js'],
    ['tem a miniatura og:image', 'og:image'],
    ['tem o manifest', 'manifest.webmanifest'],
    ['tem a área do app', 'id="pg-app"'],
    ['tem a área dos modais', 'id="mdl-root"']
  ]) ok('index.html ' + nome, h.includes(trecho));
  /* a ordem importa: o app.js usa o que os outros definem */
  const pos = a => h.indexOf(a);
  ok('scripts na ordem certa', pos('assets/js/config.js') < pos('assets/js/conteudo.js')
    && pos('assets/js/conteudo.js') < pos('assets/js/app.js'));
}

/* ---------- 7. nenhuma chave secreta escapou ----------
   A palavra "service_role" aparece de propósito nos comentários, avisando para
   nunca colá-la. O que não pode é uma chave DE VERDADE no código — por isso a
   verificação olha o arquivo sem comentários. */
const semComentarios = txt => txt
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/.*$/gm, '$1')
  .replace(/<!--[\s\S]*?-->/g, ' ');

/* segredos do Supabase: o formato novo (sb_secret_…) e um JWT cujo corpo diz
   que o papel é service_role (o corpo é base64 de {"role":"service_role"…}) */
const SEGREDO = /sb_secret_[A-Za-z0-9_-]{10,}|eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]*(?:c2VydmljZV9yb2xl|InNlcnZpY2Vfcm9sZSI)/;
let vazou = [];
for (const f of ['assets/js/config.js', 'assets/js/nuvem.js', 'assets/js/app.js', 'index.html']) {
  const limpo = semComentarios(fs.readFileSync(path.join(PUB, f), 'utf8'));
  if (SEGREDO.test(limpo)) vazou.push(f);
}
ok('nenhuma chave secreta publicada', !vazou.length, vazou.join(', '));

/* a anon key, se preenchida, tem de ser mesmo uma anon key */
const cfgLimpo = semComentarios(fs.readFileSync(path.join(PUB, 'assets/js/config.js'), 'utf8'));
const mChave = cfgLimpo.match(/SUPABASE_ANON_KEY\s*:\s*'([^']*)'/);
const chave = mChave ? mChave[1].trim() : '';
ok('a chave configurada é uma anon key (ou está vazia)',
  !chave || /^(eyJ|sb_publishable_)/.test(chave),
  'valor não parece uma anon key do Supabase');

console.log('\n' + (falhas ? '❌ ' + falhas + ' problema(s) — não publicar' : '✅ tudo certo, pode publicar'));
process.exitCode = falhas ? 1 : 0;
