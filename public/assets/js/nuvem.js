/* ============================================================
   Nuvem — Supabase (login, progresso e assinatura)
   ------------------------------------------------------------
   Regra de ouro deste arquivo: o app NUNCA depende da nuvem para
   funcionar. O localStorage continua sendo a fonte imediata —
   é dele que a tela lê, e é por isso que o app abre instantâneo e
   funciona sem internet. A nuvem entra por cima:

     ao entrar  → baixa o progresso do servidor e MISTURA com o local
     ao estudar → envia o progresso (com atraso, sem travar a tela)
     no Premium → quem responde é o servidor, não um código local

   Sem as chaves em config.js, tudo aqui vira operação vazia e o app
   se comporta exatamente como a versão de arquivo único.
   ============================================================ */

const nuvem = {
  sb: null,            // cliente Supabase
  ligado: false,       // há chaves configuradas?
  usuario: null,       // { id, email }
  perfil: null,        // linha de `perfis`
  assinatura: null,    // { plano, fim, dias_restantes } ou null
  estado: 'offline',   // 'offline' | 'conectando' | 'ok' | 'erro'
  ultimoErro: null
};

/* ---------- início ---------- */
function nuvemLigada() { return nuvem.ligado && !!nuvem.sb; }

async function iniciarNuvem() {
  const c = window.CT_CONFIG || {};
  if (!c.SUPABASE_URL || !c.SUPABASE_ANON_KEY) {
    nuvem.estado = 'offline';
    return false;                                   // modo local, como sempre foi
  }
  if (typeof supabase === 'undefined' || !supabase.createClient) {
    console.warn('biblioteca do Supabase não carregou — seguindo no modo local');
    nuvem.estado = 'erro'; nuvem.ultimoErro = 'biblioteca ausente';
    return false;
  }
  nuvem.sb = supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  nuvem.ligado = true;
  nuvem.estado = 'conectando';
  return true;
}

/* ---------- contas ---------- */
async function nuvemCadastrar(nome, email, senha) {
  const { data, error } = await nuvem.sb.auth.signUp({
    email: email.trim().toLowerCase(), password: senha,
    options: { data: { nome: nome.trim() } }
  });
  if (error) throw new Error(traduzErro(error.message));
  /* Se a confirmação por e-mail estiver ligada, não há sessão ainda. */
  if (!data.session) return { confirmar: true };
  return { confirmar: false };
}

async function nuvemEntrar(email, senha) {
  const { error } = await nuvem.sb.auth.signInWithPassword({
    email: email.trim().toLowerCase(), password: senha
  });
  if (error) throw new Error(traduzErro(error.message));
}

async function nuvemSair() {
  try { await nuvem.sb.auth.signOut(); } catch (e) {}
  nuvem.usuario = null; nuvem.perfil = null; nuvem.assinatura = null;
}

async function nuvemRecuperarSenha(email) {
  const { error } = await nuvem.sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: location.origin + location.pathname
  });
  if (error) throw new Error(traduzErro(error.message));
}

async function nuvemSessao() {
  if (!nuvemLigada()) return null;
  const { data } = await nuvem.sb.auth.getSession();
  if (!data.session) return null;
  nuvem.usuario = { id: data.session.user.id, email: data.session.user.email };
  return nuvem.usuario;
}

/* mensagens do Supabase vêm em inglês; aqui viram português de gente */
function traduzErro(m) {
  const s = String(m || '').toLowerCase();
  if (s.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (s.includes('already registered') || s.includes('already been registered')) return 'Esse e-mail já tem conta. Tente entrar.';
  if (s.includes('password should be')) return 'A senha precisa de pelo menos 6 caracteres.';
  if (s.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar — veja a caixa de entrada.';
  if (s.includes('rate limit') || s.includes('too many')) return 'Muitas tentativas. Espere um minuto e tente de novo.';
  if (s.includes('network') || s.includes('fetch')) return 'Sem conexão com o servidor. Verifique sua internet.';
  return m || 'Não consegui completar. Tente de novo.';
}

/* ---------- perfil ---------- */
async function nuvemPerfil() {
  if (!nuvemLigada() || !nuvem.usuario) return null;
  const { data, error } = await nuvem.sb.from('perfis').select('*').eq('id', nuvem.usuario.id).maybeSingle();
  if (error) { console.warn('perfil:', error.message); return null; }
  nuvem.perfil = data;
  if (data) {
    nuvem.sb.from('perfis').update({ visto_em: new Date().toISOString() })
      .eq('id', nuvem.usuario.id).then(() => {}, () => {});
  }
  return data;
}

async function nuvemSalvarPerfil(campos) {
  if (!nuvemLigada() || !nuvem.usuario) return;
  const { error } = await nuvem.sb.from('perfis').update(campos).eq('id', nuvem.usuario.id);
  if (error) console.warn('salvar perfil:', error.message);
  else Object.assign(nuvem.perfil || {}, campos);
}

/* ---------- assinatura: quem decide é o servidor ---------- */
async function nuvemAssinatura() {
  if (!nuvemLigada() || !nuvem.usuario) return null;
  try {
    await nuvem.sb.rpc('vincular_assinaturas');            // liberada pelo e-mail antes do cadastro
    const { data, error } = await nuvem.sb.rpc('minha_assinatura');
    if (error) throw error;
    nuvem.assinatura = (data && data[0]) || null;
    return nuvem.assinatura;
  } catch (e) {
    console.warn('assinatura:', e.message);
    return null;
  }
}

/* ---------- progresso ---------- */
async function nuvemBaixarProgresso() {
  if (!nuvemLigada() || !nuvem.usuario) return null;
  const { data, error } = await nuvem.sb.from('progresso')
    .select('dados, versao, atualizado_em').eq('user_id', nuvem.usuario.id).maybeSingle();
  if (error) { console.warn('baixar progresso:', error.message); return null; }
  return data ? data.dados : null;
}

let _envioPendente = null, _enviando = false, _sujo = false;

function nuvemAgendarEnvio() {
  if (!nuvemLigada() || !nuvem.usuario) return;
  _sujo = true;
  clearTimeout(_envioPendente);
  _envioPendente = setTimeout(nuvemEnviarProgresso, 2500);   // junta várias respostas num envio só
}

async function nuvemEnviarProgresso() {
  if (!nuvemLigada() || !nuvem.usuario || !_sujo) return;
  if (_enviando) { nuvemAgendarEnvio(); return; }
  _enviando = true; _sujo = false;
  try {
    const { error } = await nuvem.sb.from('progresso')
      .upsert({ user_id: nuvem.usuario.id, dados: window.prog || {} }, { onConflict: 'user_id' });
    if (error) throw error;
    nuvem.estado = 'ok'; nuvem.ultimoErro = null;
  } catch (e) {
    nuvem.estado = 'erro'; nuvem.ultimoErro = e.message;
    _sujo = true;                                            // tenta de novo no próximo gatilho
    console.warn('enviar progresso:', e.message);
  } finally {
    _enviando = false;
    if (typeof atualizarSelosNuvem === 'function') atualizarSelosNuvem();
  }
}

/* não perder o que acabou de ser estudado ao fechar a aba */
window.addEventListener('beforeunload', () => {
  if (_sujo && nuvemLigada() && nuvem.usuario) { try { nuvemEnviarProgresso(); } catch (e) {} }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && _sujo) nuvemEnviarProgresso();
});

/* ============================================================
   Mistura de progressos — o coração da sincronia
   ------------------------------------------------------------
   O mesmo aluno pode ter estudado no celular e no computador sem
   internet. Ao voltar, os dois estados precisam virar um só sem
   perder nada. A regra, item a item:

   cards   — vence o que foi revisado por último (cs.ts). Sem ts,
             vence quem tem mais repetições: é o mais avançado.
   log     — por dia, vence o MAIOR número. Nunca somamos, senão
             estudar em dois aparelhos inflaria a estatística.
   fav     — união; o mais antigo manda (foi quando favoritou).
   listas  — por id, vence a de mais cartas; ids novos entram.
   meus    — por id, vence o baralho de edição mais recente.
   plano   — vence o do servidor só se o local nunca foi configurado.
   trofeus — união, sempre o resgate mais antigo.
   ============================================================ */
function misturarProgresso(local, remoto) {
  if (!remoto) return local;
  if (!local) return remoto;
  const out = {
    cards: {}, log: {}, fav: {}, listas: [], meus: [],
    plano: null, trofeus: {}, genero: local.genero || remoto.genero || null
  };

  const cl = local.cards || {}, cr = remoto.cards || {};
  for (const id of new Set([...Object.keys(cl), ...Object.keys(cr)])) {
    const a = cl[id], b = cr[id];
    if (!a) { out.cards[id] = b; continue; }
    if (!b) { out.cards[id] = a; continue; }
    if (a.ts && b.ts) out.cards[id] = a.ts >= b.ts ? a : b;
    else out.cards[id] = (a.reps || 0) >= (b.reps || 0) ? a : b;
  }

  const ll = local.log || {}, lr = remoto.log || {};
  for (const d of new Set([...Object.keys(ll), ...Object.keys(lr)])) {
    const a = ll[d] || {}, b = lr[d] || {};
    out.log[d] = {
      rev: Math.max(a.rev || 0, b.rev || 0),
      ok:  Math.max(a.ok  || 0, b.ok  || 0),
      nov: Math.max(a.nov || 0, b.nov || 0)
    };
    /* acertos não podem passar de revisões, senão a precisão passa de 100% */
    out.log[d].ok = Math.min(out.log[d].ok, out.log[d].rev);
  }

  const fl = local.fav || {}, fr = remoto.fav || {};
  for (const id of new Set([...Object.keys(fl), ...Object.keys(fr)]))
    out.fav[id] = Math.min(fl[id] || Infinity, fr[id] || Infinity);

  const porId = arr => Object.fromEntries((arr || []).map(x => [x.id, x]));
  const Ll = porId(local.listas), Lr = porId(remoto.listas);
  for (const id of new Set([...Object.keys(Ll), ...Object.keys(Lr)])) {
    const a = Ll[id], b = Lr[id];
    if (!a) { out.listas.push(b); continue; }
    if (!b) { out.listas.push(a); continue; }
    out.listas.push({ id, nome: a.nome || b.nome, cards: [...new Set([...(a.cards || []), ...(b.cards || [])])] });
  }

  const ed = bar => Math.max(bar.criado || 0, ...(bar.cards || []).map(c => c.criado || 0));
  const Ml = porId(local.meus), Mr = porId(remoto.meus);
  for (const id of new Set([...Object.keys(Ml), ...Object.keys(Mr)])) {
    const a = Ml[id], b = Mr[id];
    if (!a) { out.meus.push(b); continue; }
    if (!b) { out.meus.push(a); continue; }
    out.meus.push(ed(a) >= ed(b) ? a : b);
  }

  out.plano = local.plano || remoto.plano || null;

  const tl = local.trofeus || {}, tr = remoto.trofeus || {};
  for (const d of new Set([...Object.keys(tl), ...Object.keys(tr)]))
    out.trofeus[d] = Math.min(tl[d] || Infinity, tr[d] || Infinity);

  return out;
}
