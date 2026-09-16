/* Reconstrói public/ inteiro a partir das fontes.
   Use quando mudar o conteúdo (flashcards-ct.html) ou a lógica (logic.js).
   Uso: npm run build */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const RAIZ = path.resolve(__dirname, '..');

/* As duas fontes (flashcards-ct.html e logic.js) ficam DE PROPÓSITO fora deste
   repositório — não vão para o GitHub, então nunca existem numa hospedagem que
   clona só esta pasta (Vercel, Netlify e afins, se alguém apontar "npm run
   build" como comando de build lá). Nesse caso não tem o que reconstruir: a
   pasta public/ já foi gerada localmente e é ela que deve ir ao ar como está.
   Sem essa saída, o build quebra com ENOENT logo no primeiro passo. */
const FONTE_HTML = path.resolve(RAIZ, '..', 'flashcards-ct.html');
const FONTE_LOGIC = path.resolve(RAIZ, '..', 'logic.js');
const JA_TEM_BUILD = ['index.html', 'data/index.json', 'assets/js/app.js']
  .every(f => fs.existsSync(path.join(RAIZ, 'public', f)));

if ((!fs.existsSync(FONTE_HTML) || !fs.existsSync(FONTE_LOGIC)) && JA_TEM_BUILD) {
  console.log('⚠️  flashcards-ct.html e/ou logic.js não existem aqui (fontes que ' +
    'ficam fora do repositório de propósito). Como public/ já está construído, ' +
    'pulando o build e publicando public/ como está — é o comportamento certo ' +
    'numa hospedagem que só tem esta pasta (ex.: Vercel/Netlify apontando "npm ' +
    'run build"). Para reconstruir de verdade, rode isto na máquina onde as ' +
    'duas fontes existem.');
  process.exit(0);
}

const passos = [
  ['split_content.js', 'conteúdo → data/index.json + data/temas/*.json'],
  ['extrai_shell.js',  'shell → assets/css/app.css + _markup.html'],
  ['adapta_logic.js',  'logic.js → assets/js/app.js'],
  ['adapta_auth.js',   'contas e nuvem no app.js'],
  ['adapta_admin.js',  'painel do admin ligado ao banco'],
  ['monta_index.js',   'index.html']
];

/* extrai_shell reescreve _markup.html do zero, então as inserções feitas nele
   (link de recuperar senha) precisam ser reaplicadas depois. */
const REMENDOS = path.join(RAIZ, 'scripts', 'remendos.js');

for (const [arq, oq] of passos) {
  process.stdout.write('▸ ' + oq + '\n');
  execFileSync(process.execPath, [path.join(RAIZ, 'scripts', arq)], { stdio: 'inherit', cwd: RAIZ });
  if (arq === 'extrai_shell.js' && fs.existsSync(REMENDOS))
    execFileSync(process.execPath, [REMENDOS], { stdio: 'inherit', cwd: RAIZ });
}

/* conferência final: nada de sintaxe quebrada indo para o ar */
for (const j of ['config.js', 'conteudo.js', 'nuvem.js', 'app.js']) {
  execFileSync(process.execPath, ['--check', path.join(RAIZ, 'public', 'assets', 'js', j)], { stdio: 'inherit' });
}
JSON.parse(fs.readFileSync(path.join(RAIZ, 'public', 'manifest.webmanifest'), 'utf8'));
JSON.parse(fs.readFileSync(path.join(RAIZ, 'public', 'data', 'index.json'), 'utf8'));

const tam = d => fs.readdirSync(d).reduce((a, f) => {
  const p = path.join(d, f); const st = fs.statSync(p);
  return a + (st.isDirectory() ? tam(p) : st.size);
}, 0);
console.log('\n✅ build pronto — public/ com ' + (tam(path.join(RAIZ, 'public')) / 1048576).toFixed(2) + ' MB');
