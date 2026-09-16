/* Servidor local para ver o app no seu computador antes de publicar.
   O app NÃO funciona abrindo o index.html direto no navegador (endereços file://
   bloqueiam o download do conteúdo). Por isso este servidorzinho.

   Uso: npm run serve   →  depois abra http://localhost:8080 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PUB = path.resolve(__dirname, '..', 'public');
const PORTA = Number(process.env.PORTA || 8080);

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};

http.createServer((req, res) => {
  const caminho = decodeURIComponent(req.url.split('?')[0]);
  let arq = path.join(PUB, caminho === '/' ? 'index.html' : caminho);

  /* nunca servir nada fora de public/ */
  if (!arq.startsWith(PUB)) { res.writeHead(403); return res.end('fora do diretório'); }
  if (!fs.existsSync(arq) || fs.statSync(arq).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<p style="font-family:system-ui">Não encontrei <b>' + caminho + '</b></p>');
  }

  res.writeHead(200, {
    'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream',
    /* sem cache no desenvolvimento: você recarrega e vê a mudança na hora */
    'Cache-Control': 'no-store'
  });
  fs.createReadStream(arq).pipe(res);
}).listen(PORTA, () => {
  console.log('CT Flashcards rodando em  http://localhost:' + PORTA);
  console.log('(Ctrl+C para parar)');
});
