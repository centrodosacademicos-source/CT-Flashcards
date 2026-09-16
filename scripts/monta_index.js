/* Monta public/index.html a partir de public/_markup.html, acrescentando
   cabeçalho, miniatura de compartilhamento, PWA e a ordem dos scripts.
   Uso: node scripts/monta_index.js */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const markup = fs.readFileSync(path.join(RAIZ, 'public', '_markup.html'), 'utf8').trim();

/* O link canônico entra no build (GitHub Actions) a partir de BASE_URL;
   em desenvolvimento fica relativo e funciona igual. */
const BASE = (process.env.BASE_URL || '').replace(/\/$/, '');
const abs = p => BASE ? BASE + '/' + p : p;

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>CT Flashcards — 10.384 flashcards de Medicina</title>
<meta name="description" content="Flashcards de Medicina com revisão espaçada: 10.384 cartas de Estágio e Residência, condutas, doses e critérios que caem na prova. Do CT dos Acadêmicos.">
<meta name="author" content="CT dos Acadêmicos">
<meta name="theme-color" content="#0a1628">

<!-- miniatura ao compartilhar (WhatsApp, Instagram, Telegram, Google) -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="CT Flashcards">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="CT Flashcards — Medicina de verdade, um flashcard por vez">
<meta property="og:description" content="10.384 flashcards de Medicina com revisão espaçada. Estágio e Residência, do CT dos Acadêmicos.">
<meta property="og:image" content="${abs('assets/img/og.png')}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="CT Flashcards — 10.384 flashcards de Medicina">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="CT Flashcards">
<meta name="twitter:description" content="10.384 flashcards de Medicina com revisão espaçada.">
<meta name="twitter:image" content="${abs('assets/img/og.png')}">

<!-- ícones -->
<link rel="icon" href="assets/img/favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="assets/img/icone.svg">
<link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
<link rel="manifest" href="manifest.webmanifest">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="CT Flashcards">

<!-- fontes: pré-conexão para não atrasar a primeira pintura -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap">

<!-- o índice do conteúdo é o primeiro pedido do app: adianta o download -->
<link rel="preload" href="data/index.json" as="fetch" crossorigin>
<link rel="stylesheet" href="assets/css/app.css">
</head>
<body>

${markup}

<!-- Supabase: só é usado se houver chaves em config.js -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js" defer></script>
<script src="assets/js/config.js" defer></script>
<script src="assets/js/conteudo.js" defer></script>
<script src="assets/js/nuvem.js" defer></script>
<script src="assets/js/app.js" defer></script>
<script>
  /* Instala o app no aparelho e guarda o conteúdo para funcionar sem internet. */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(RAIZ, 'public', 'index.html'), html);
console.log('public/index.html: ' + (html.length / 1024).toFixed(0) + ' KB' + (BASE ? '  (canônico: ' + BASE + ')' : ''));
