/* Separa o app de arquivo único em: público/index.html, assets/css/app.css e
   assets/js/app.js. Roda uma vez; depois disso o repositório é a fonte da verdade.
   Uso: node scripts/extrai_shell.js [caminho/para/flashcards-ct.html] */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const FONTE = process.argv[2] || path.resolve(RAIZ, '..', 'flashcards-ct.html');
const html = fs.readFileSync(FONTE, 'utf8');

/* Corta exatamente antes do script de dados, não do primeiro <script> do
   arquivo — o shell pode ter scripts inline próprios antes dele (ex.: o que
   aplica o tema claro/escuro cedo, para não piscar no primeiro instante),
   e esses precisam sobreviver dentro do markup extraído. */
const MARCA_DADOS = '<script type="application/json" id="decks-data">';
const iScript = html.indexOf(MARCA_DADOS);
if (iScript < 0) throw new Error('sem marcador decks-data');
const shell = html.slice(0, iScript);

const mCss = shell.match(/<style>([\s\S]*?)<\/style>/);
if (!mCss) throw new Error('não achei o <style> do shell');
const css = mCss[1];
const markup = (shell.slice(0, mCss.index) + shell.slice(mCss.index + mCss[0].length))
  .replace(/<title>[\s\S]*?<\/title>\s*/, '')
  .replace(/<link rel="stylesheet"[^>]*fonts\.googleapis[^>]*>\s*/, '')
  .trim();

fs.mkdirSync(path.join(RAIZ, 'public', 'assets', 'css'), { recursive: true });
fs.mkdirSync(path.join(RAIZ, 'public', 'assets', 'js'), { recursive: true });
fs.writeFileSync(path.join(RAIZ, 'public', 'assets', 'css', 'app.css'), css.trim() + '\n');
fs.writeFileSync(path.join(RAIZ, 'public', '_markup.html'), markup + '\n');

console.log('css   : ' + (css.length / 1024).toFixed(0) + ' KB → public/assets/css/app.css');
console.log('markup: ' + (markup.length / 1024).toFixed(0) + ' KB → public/_markup.html (para montar o index.html)');
