/* Service worker do CT Flashcards.
   Objetivo: o aluno abre o app no metrô, sem sinal, e estuda os temas que já
   baixou. Nada aqui é essencial — se falhar, o app funciona igual, só online.

   Estratégias:
   · casca do app (html/css/js/ícones) → rede primeiro, cache como reserva.
     Assim uma correção publicada chega na próxima visita, sem ficar preso a
     uma versão velha.
   · conteúdo (data/*.json) → cache primeiro, e revalida por trás. É conteúdo
     que muda pouco e pesa muito; abrir instantâneo vale mais.
   · Supabase e qualquer outra API → nunca passa pelo cache. */

const VERSAO = 'ctf-v1';
const CASCA = 'casca-' + VERSAO;
const DADOS = 'dados-' + VERSAO;

const ESSENCIAL = [
  './', './index.html',
  './assets/css/app.css',
  './assets/js/config.js', './assets/js/conteudo.js',
  './assets/js/nuvem.js', './assets/js/app.js',
  './data/index.json',
  './manifest.webmanifest',
  './assets/img/icone.svg', './assets/img/icone-192.png', './assets/img/icone-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CASCA)
      /* addAll falha inteiro se um item falhar — aqui cada um por si */
      .then(c => Promise.allSettled(ESSENCIAL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CASCA && k !== DADOS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  /* nunca guardar chamadas de API nem de outro domínio (exceto as fontes) */
  if (url.origin !== location.origin) return;
  if (url.pathname.includes('/rest/v1/') || url.pathname.includes('/auth/v1/')) return;

  /* conteúdo: cache primeiro, atualiza por trás */
  if (url.pathname.includes('/data/')) {
    e.respondWith(
      caches.open(DADOS).then(async cache => {
        const guardado = await cache.match(req);
        const daRede = fetch(req).then(r => {
          if (r && r.ok) cache.put(req, r.clone());
          return r;
        }).catch(() => null);
        return guardado || daRede || new Response('{}', { headers: { 'Content-Type': 'application/json' } });
      })
    );
    return;
  }

  /* casca: rede primeiro, cache de reserva */
  e.respondWith(
    fetch(req).then(r => {
      if (r && r.ok) { const c = r.clone(); caches.open(CASCA).then(cache => cache.put(req, c)); }
      return r;
    }).catch(async () => {
      const guardado = await caches.match(req);
      if (guardado) return guardado;
      if (req.mode === 'navigate') return caches.match('./index.html');
      return new Response('', { status: 504, statusText: 'sem conexão' });
    })
  );
});

/* permite a página pedir uma atualização imediata */
self.addEventListener('message', e => { if (e.data === 'atualizar') self.skipWaiting(); });
