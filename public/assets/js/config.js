/* ============================================================
   CT Flashcards — configuração
   ------------------------------------------------------------
   COLE AQUI as duas chaves do seu projeto Supabase.
   Onde achar: painel do Supabase → Project Settings → API.
   O passo a passo completo está em docs/SUPABASE.md.

   Pode deixar em branco: sem as chaves o app funciona igual,
   só que guardando tudo no navegador do aluno (sem sincronizar
   entre aparelhos). É assim que ele roda hoje.

   A "anon key" PODE ficar pública aqui — é a segurança do banco
   (RLS) que protege os dados, não o segredo da chave.
   A "service_role key" NUNCA pode ser colada neste arquivo.
   ============================================================ */
window.CT_CONFIG = {
  SUPABASE_URL: 'https://wmohvaixqzcmukbunxna.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indtb2h2YWl4cXpjbXVrYnVueG5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwMTU3MDIsImV4cCI6MjEwNDU5MTcwMn0.ODmtmI_T6e0wSTobzdmv6Tvc8NDyqQPogZlu5LSNmSs',

  /* Links de checkout dos planos (Kiwify, Hotmart, Mercado Pago…) — um para
     cada trilha, porque o preço muda entre CT Estágio e CT Residência e cada
     preço é um produto diferente no checkout. Enquanto vazios, o botão avisa
     que a assinatura abre em breve. */
  CHECKOUT: {
    estagio:    { mensal: '', semestral: '', anual: '' },
    residencia: { mensal: '', semestral: '', anual: '' }
  },

  /* Onde estão os arquivos de conteúdo, relativo ao index.html. */
  DADOS: 'data/',

  /* Contato mostrado quando o aluno precisa falar com o CT. */
  CONTATO: '@ctdosacademicos'
};
