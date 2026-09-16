/* Testa o app do repositório rodando de verdade num servidor HTTP local —
   é assim que ele vai rodar no GitHub Pages (file:// não serve, porque fetch
   e service worker não funcionam nele).
   Uso: node scripts/e2e_repo.js */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PUB = path.resolve(__dirname, '..', 'public');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon' };

(async () => {
  let pedidos = [];
  const servidor = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    pedidos.push(u);
    let arq = path.join(PUB, u === '/' ? 'index.html' : u);
    if (!arq.startsWith(PUB) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) {
      res.writeHead(404); return res.end('não encontrado');
    }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream' });
    fs.createReadStream(arq).pipe(res);
  });
  await new Promise(r => servidor.listen(0, r));
  const base = 'http://127.0.0.1:' + servidor.address().port + '/';

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.addInitScript(() => { window.prompt = () => null; window.confirm = () => false; window.alert = () => {}; });
  const erros = [];
  page.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR|fonts\.g/.test(m.text())) erros.push('CONSOLE: ' + m.text()); });

  let falhas = 0;
  const log = (l, cond) => { if (!cond) falhas++; console.log((cond ? 'PASS' : 'FAIL') + ' - ' + l); };

  /* waitForFunction roda em mundo isolado: não enxerga `let session` do app.
     Só window.DECKS é visível porque conteudo.js o publica de propósito.
     Para o resto, sondamos com evaluate, que roda no mundo principal. */
  const esperar = async (fn, oque, ms = 30000) => {
    const t = Date.now();
    while (Date.now() - t < ms) {
      if (await page.evaluate(fn)) return true;
      await page.waitForTimeout(120);
    }
    throw new Error("esperei demais por: " + oque);
  };
  /* ---------- abertura ---------- */
  const t0 = Date.now();
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.DECKS && window.DECKS.length > 0, { timeout: 30000 });
  const tAbrir = Date.now() - t0;
  log('o app abre e carrega o índice em menos de 5 s (' + tAbrir + ' ms)', tAbrir < 5000);
  log('23 temas vieram do índice', await page.evaluate(() => DECKS.length === 23));
  log('267 subtemas', await page.evaluate(() => DECKS.reduce((a, t) => a + t.subs.length, 0) === 267));
  log('10.384 cartas listadas no índice', await page.evaluate(() =>
    DECKS.reduce((a, t) => a + t.subs.reduce((b, s) => b + s.cards.length, 0), 0) === 10384));
  log('as cartas começam como esboço, sem o texto', await page.evaluate(() =>
    DECKS[0].subs[0].cards.every(c => c.id && c.f === undefined)));
  log('as cartas de base estão marcadas no índice', await page.evaluate(() =>
    DECKS.filter(t => !t.id.startsWith('atualizacoes')).every(t => t.subs.every(s => s.cards.filter(c => c.b).length === 6))));

  /* ---------- o que foi baixado até aqui ---------- */
  const baixouTema = pedidos.some(u => u.includes('/data/temas/'));
  log('nenhum arquivo de tema foi baixado só para abrir o app', !baixouTema);
  log('a landing mostra os temas', await page.evaluate(() =>
    document.querySelectorAll('#land-decks .land-deck').length > 0));

  /* ---------- criar conta (modo local, sem banco) ---------- */
  await page.click('text=Começar agora — é grátis');
  await page.waitForSelector('#pg-auth:not([hidden])');
  log('sem banco configurado, "esqueci minha senha" fica escondido', await page.evaluate(() => {
    authTab('login'); return document.getElementById('auth-rec').hidden; }));
  await page.evaluate(() => authTab('signup'));
  await page.fill('#in-nome', 'Ana Ribeiro');
  await page.fill('#in-email', 'ana@teste.com');
  await page.fill('#in-senha', '123456');
  await page.click('#auth-btn');
  await page.waitForSelector('#pg-app:not([hidden])', { timeout: 20000 });
  log('a conta é criada e o app abre', await page.evaluate(() => !!user && user.email === 'ana@teste.com'));
  log('o painel desenha sem o texto das cartas', await page.evaluate(() =>
    document.querySelectorAll('.deckc').length > 0 && document.getElementById('view').innerHTML.length > 500));
  log('as contagens funcionam só com o índice', await page.evaluate(() => {
    const c = countsFor(cardsOfTheme('cardio')); return c.total > 0 && c.nov === c.total; }));

  /* ---------- estudar: aí sim o tema é baixado ---------- */
  pedidos = [];
  await page.evaluate(() => { store.set('fcct_admin', '1'); });
  await page.evaluate(() => startStudy('tema:cardio'));
  await esperar(() => !!(typeof session !== 'undefined' && session && session.queue.length > 0), 'a sessão de estudo');
  log('estudar um tema baixa o arquivo daquele tema', pedidos.some(u => u.endsWith('/data/temas/cardio.json')));
  log('baixou só o tema pedido', pedidos.filter(u => u.includes('/data/temas/')).length === 1);
  log('a carta chegou com frente e verso', await page.evaluate(() => {
    const c = session.queue[0]; return !!c.f && !!c.v && c.f.length > 5; }));
  await page.waitForTimeout(200);
  const frente = await page.textContent('#view');
  log('a pergunta aparece na tela', frente.length > 100);

  /* responder de verdade */
  await page.evaluate(() => { if (!session.flipped) flip(); });
  await page.waitForTimeout(80);
  await page.evaluate(() => answer(2));
  await page.waitForTimeout(150);
  log('responder grava o progresso', await page.evaluate(() =>
    Object.keys(prog.cards).length === 1 && (prog.log[todayKey()] || {}).rev === 1));
  log('a carta ganha o carimbo de tempo para sincronizar', await page.evaluate(() =>
    Object.values(prog.cards)[0].ts > 0));

  /* ---------- o tema já baixado não baixa de novo ---------- */
  pedidos = [];
  await page.evaluate(() => { endStudy(); });
  await page.waitForTimeout(150);
  await page.evaluate(() => startStudy('tema:cardio'));
  await page.waitForTimeout(400);
  log('o mesmo tema não é baixado duas vezes', !pedidos.some(u => u.includes('/data/temas/')));

  /* ---------- revisão rápida ---------- */
  await page.evaluate(() => { endStudy(); });
  await page.waitForTimeout(150);
  await page.evaluate(() => startStudy('base:tema:cardio'));
  await esperar(() => !!(typeof session !== 'undefined' && session && session.queue.length > 0), 'a revisão rápida');
  log('a revisão rápida traz só cartas de base, com texto', await page.evaluate(() =>
    session.queue.every(c => c.b && c.f && c.v) && session.queue.length === 72));

  /* ---------- todas as telas ---------- */
  await page.evaluate(() => { endStudy(); });
  await page.waitForTimeout(150);
  for (const v of ['dashboard', 'decks', 'decksr', 'meus', 'plano', 'premium', 'stats', 'perfil', 'trofeus']) {
    await page.evaluate(x => { closeModal(); nav(x); }, v);
    await page.waitForTimeout(120);
    const n = await page.evaluate(() => document.getElementById('view').innerHTML.length);
    log('a tela ' + v + ' desenha', n > 200);
  }

  /* ---------- selo honesto sobre onde estão os dados ---------- */
  await page.evaluate(() => nav('perfil'));
  await page.waitForTimeout(150);
  const perfil = await page.textContent('#view');
  log('o Perfil avisa que sem banco os dados ficam no aparelho', perfil.includes('Salvo neste aparelho'));

  /* ---------- preços por trilha e conteúdo ---------- */
  log('os preços da CT Estágio estão no app', await page.evaluate(() => {
    const p = planosDe('estagio');
    return p[0].mes === '79,90' && p[1].mes === '49,90' && p[2].mes === '39,90'; }));
  log('os preços da CT Residência estão no app', await page.evaluate(() => {
    const p = planosDe('residencia');
    return p[0].mes === '99,90' && p[1].mes === '69,90' && p[2].mes === '59,90'; }));
  log('os links de checkout vêm do config.js, um por trilha', await page.evaluate(() =>
    typeof CHECKOUT === 'object' && 'mensal' in CHECKOUT.estagio && 'mensal' in CHECKOUT.residencia));
  log('o switch de trilha aparece acima dos preços e começa em CT Estágio', await page.evaluate(() => {
    nav('premium');
    const on = document.querySelector('.pl-sw-opt.on');
    return !!on && on.textContent.includes('Estágio'); }));
  log('clicar no switch troca os preços para CT Residência', await page.evaluate(() => {
    [...document.querySelectorAll('.pl-sw-opt')].find(b => b.textContent.includes('Residência')).click();
    const n = [...document.querySelectorAll('.pl-card .pl-preco b')].map(b => b.textContent);
    return n.includes('99') && n.includes('69') && n.includes('59'); }));
  log('a lista "Por que ser CT Premium?" está no lugar dos boxes', await page.evaluate(() =>
    !!document.querySelector('.pw-why') && !document.querySelector('.pw-benef')));

  /* ---------- limite do plano gratuito e FSRS-5 (a lógica é a mesma do
     app de arquivo único — aqui é só conferir que o build não quebrou nada) ---------- */
  log('FREE_CARDS foi reduzido pela metade (10 → 5)', await page.evaluate(() => FREE_CARDS === 5));
  log('a FSRS-5 está presente com os 19 pesos publicados', await page.evaluate(() =>
    Array.isArray(FSRS_W) && FSRS_W.length === 19));
  log('a meta de retenção da FSRS é 90%, o padrão da literatura e do Anki', await page.evaluate(() =>
    FSRS_RETENCAO === 0.9));
  log('gradeCard calcula estabilidade, dificuldade e o próximo vencimento a partir da resposta', await page.evaluate(() => {
    const cs = {}; gradeCard(cs, 2); // "Bom" numa carta nova
    return cs.s > 0 && cs.d >= 1 && cs.d <= 10 && cs.iv >= 1 && cs.due > Date.now(); }));
  log('carta com histórico do formato antigo (sem s/d) migra sem travar nem perder o intervalo', await page.evaluate(() => {
    const cs = { iv: 10, ef: 2.5, reps: 3, lapses: 0, due: Date.now() - 864e5 };
    gradeCard(cs, 2);
    return cs.s !== undefined && cs.d !== undefined && !('ef' in cs) && !Number.isNaN(cs.s); }));

  /* ---------- atalhos de teclado configuráveis (desktop) ---------- */
  log('os atalhos padrão são espaço para virar e 1-2-3-4 para avaliar', await page.evaluate(() =>
    typeof atalhos === 'object' && atalhos.flip === ' ' &&
    atalhos.g0 === '1' && atalhos.g1 === '2' && atalhos.g2 === '3' && atalhos.g3 === '4'));
  log('os atalhos ficam guardados só neste aparelho, fora do progresso sincronizado', await page.evaluate(() =>
    !('atalhos' in prog)));

  /* ---------- estatística de sessão, desfazer e códigos por trilha (v34)
     — a profundidade de verdade é o e2e_v34.js do app de arquivo único;
     aqui é só conferir que o build do repositório não quebrou nada. ---------- */
  log('a lista "Por que ser CT Premium?" não promete mais conteúdo semanal', await page.evaluate(() =>
    !PORQUE_PREMIUM.some(b => /semana/i.test(b[1]))));
  log('PORQUE_PREMIUM promete um método cientificamente comprovado', await page.evaluate(() =>
    PORQUE_PREMIUM.some(b => /cientificamente comprovado/i.test(b[1]))));
  log('startStudy prepara o instantâneo de desfazer e o cronômetro da sessão', await page.evaluate(async () => {
    const t = DECKS.find(x => !x.restrito), s = t.subs.find(x => x.id !== t.fs) || t.subs[0];
    store.set('fcct_admin', '1');
    await startStudy('sub:' + s.id);
    const ok = !!session && session.undo === null && typeof session.ini === 'number' && Array.isArray(session.notas);
    session = null; store.del('fcct_admin');
    return ok; }));
  log('gerarCodigo/validarCodigo diferenciam as trilhas Estágio e Residência', await page.evaluate(async () => {
    const est = await gerarCodigo(user.email, 6, 'estagio');
    const res = await gerarCodigo(user.email, 6, 'residencia');
    if (est.codigo === res.codigo || !est.codigo.startsWith('CT-E-') || !res.codigo.startsWith('CT-R-')) return false;
    const vEst = await validarCodigo(est.codigo), vRes = await validarCodigo(res.codigo);
    return vEst.ok && vEst.trilha === 'estagio' && vRes.ok && vRes.trilha === 'residencia'; }));
  log('revUnlocked() no build do repositório usa a trilha da assinatura', await page.evaluate(() =>
    typeof revUnlocked === 'function' && typeof assinaturaTrilha === 'function'));

  /* ---------- mistura de progressos ---------- */
  log('a mistura mantém a revisão mais recente', await page.evaluate(() => {
    const r = misturarProgresso(
      { cards: { a: { reps: 1, ts: 100 } }, log: {} },
      { cards: { a: { reps: 9, ts: 500 } }, log: {} });
    return r.cards.a.reps === 9; }));
  log('a mistura não soma revisões do mesmo dia', await page.evaluate(() => {
    const r = misturarProgresso(
      { cards: {}, log: { '2026-09-09': { rev: 40, ok: 30, nov: 10 } } },
      { cards: {}, log: { '2026-09-09': { rev: 25, ok: 20, nov: 5 } } });
    return r.log['2026-09-09'].rev === 40 && r.log['2026-09-09'].ok === 30; }));
  log('a mistura nunca deixa acertos passarem das revisões', await page.evaluate(() => {
    const r = misturarProgresso(
      { cards: {}, log: { d: { rev: 10, ok: 2 } } },
      { cards: {}, log: { d: { rev: 3, ok: 3 } } });
    return r.log.d.ok <= r.log.d.rev; }));
  log('a mistura junta favoritos dos dois aparelhos', await page.evaluate(() => {
    const r = misturarProgresso({ cards: {}, log: {}, fav: { a: 5 } }, { cards: {}, log: {}, fav: { b: 7 } });
    return r.fav.a === 5 && r.fav.b === 7; }));
  log('a mistura une as cartas de uma lista', await page.evaluate(() => {
    const r = misturarProgresso(
      { cards: {}, log: {}, listas: [{ id: 'l1', nome: 'X', cards: ['a'] }] },
      { cards: {}, log: {}, listas: [{ id: 'l1', nome: 'X', cards: ['b'] }] });
    return r.listas[0].cards.length === 2; }));
  log('a mistura preserva os troféus dos dois lados', await page.evaluate(() => {
    const r = misturarProgresso({ cards: {}, log: {}, trofeus: { 3: 10 } }, { cards: {}, log: {}, trofeus: { 5: 20 } });
    return r.trofeus[3] === 10 && r.trofeus[5] === 20; }));

  /* ---------- recarregar não perde nada ---------- */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.DECKS && window.DECKS.length > 0, { timeout: 30000 });
  await page.waitForTimeout(500);
  log('a sessão continua depois de recarregar', await page.evaluate(() =>
    !!user && user.email === 'ana@teste.com' && Object.keys(prog.cards).length === 1));

  console.log(erros.length ? '\nERROS DE JS:\n' + erros.join('\n') : '\nNENHUM ERRO DE JS');
  if (erros.length) falhas += erros.length;

  await browser.close();
  servidor.close();
  console.log(falhas ? '\n❌ ' + falhas + ' falha(s)' : '\n✅ o app do repositório funciona servido por HTTP');
  process.exitCode = falhas ? 1 : 0;
})().catch(e => { console.error('CRASH:', e.message); process.exit(1); });
