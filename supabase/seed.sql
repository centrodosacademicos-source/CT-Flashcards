-- =====================================================================
-- Flashcards CT — seed.sql
-- Transforma a SUA conta em administradora do app.
-- =====================================================================
--
-- O QUE ESTE ARQUIVO FAZ
-- Marca uma conta como "admin". Quem é admin enxerga a lista de alunos
-- dentro do app e pode liberar o CT Premium para quem comprou.
--
-- ANTES DE RODAR: CADASTRE-SE NO APP PRIMEIRO
-- Este arquivo só consegue promover uma conta que JÁ EXISTE. Então:
--   1. abra o app no navegador;
--   2. crie a sua conta normalmente, com o seu e-mail;
--   3. confirme o e-mail, se o Supabase pedir;
--   4. só então cole e rode este arquivo no SQL Editor.
-- Se você rodar antes de se cadastrar, ele avisa em vez de dar erro.
--
-- COMO USAR
-- Cole o arquivo inteiro no SQL Editor do Supabase e clique em "Run".
-- Depois é só recarregar o app: o menu de administração aparece.
--
-- PODE RODAR MAIS DE UMA VEZ? Pode, sem problema nenhum.
--
-- =====================================================================

do $$
declare
  -- ↓↓↓ ---------------------------------------------------------- ↓↓↓
  -- ÚNICA LINHA QUE VOCÊ PRECISA MEXER:
  -- troque o e-mail abaixo pelo e-mail da conta que vai ser admin.
  -- Deixe as aspas simples no lugar.

  v_email text := 'centrodosacademicos@gmail.com';

  -- ↑↑↑ ---------------------------------------------------------- ↑↑↑

  v_qtd integer;
begin
  v_email := lower(trim(v_email));

  update public.perfis
     set admin      = true,
         -- o dono do app também recebe acesso à trilha CT Residência.
         -- Se não quiser isso, apague a linha abaixo.
         residencia = true
   where lower(email) = v_email;

  get diagnostics v_qtd = row_count;

  if v_qtd = 1 then
    raise notice '=====================================================';
    raise notice 'PRONTO! A conta % agora e ADMINISTRADORA.', v_email;
    raise notice 'Recarregue o app (F5) para o menu de admin aparecer.';
    raise notice '=====================================================';

  elsif v_qtd = 0 then
    raise notice '=====================================================';
    raise notice 'NADA FOI ALTERADO: nao existe conta com o e-mail %.', v_email;
    raise notice '';
    raise notice 'Provaveis motivos:';
    raise notice '  1) voce ainda nao se cadastrou no app com esse e-mail;';
    raise notice '  2) o e-mail escrito aqui em cima esta diferente do';
    raise notice '     que voce usou no cadastro (confira letra por letra).';
    raise notice '';
    raise notice 'Faca o cadastro no app primeiro e rode este arquivo de novo.';
    raise notice '=====================================================';

  else
    raise notice 'ATENCAO: % contas foram promovidas a admin. Confira a lista abaixo.', v_qtd;
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- Conferência: lista quem é administrador agora.
-- Se aparecer o seu e-mail com "admin = true", está tudo certo.
-- Se não aparecer NENHUMA linha, é porque a conta ainda não foi criada.
-- ---------------------------------------------------------------------
select email,
       nome,
       admin,
       residencia,
       criado_em
  from public.perfis
 where admin = true
 order by criado_em;


-- =====================================================================
-- RECEITAS ÚTEIS PARA O DIA A DIA
-- (estão comentadas com "--"; para usar uma delas, copie a linha,
--  tire os "--" do começo, troque o e-mail e rode)
-- =====================================================================

-- Liberar o CT Premium para quem comprou (a assinatura funciona mesmo
-- que a pessoa ainda não tenha criado a conta — ela é vinculada sozinha
-- no primeiro login). Os planos aceitos são 'mensal', 'semestral' e 'anual';
-- o número é a quantidade de meses:
--
--   select public.admin_liberar('aluno@exemplo.com', 'anual', 12, 'Kiwify #1234');
--   select public.admin_liberar('aluno@exemplo.com', 'mensal', 1, 'cortesia');

-- Ver a lista completa de alunos (só funciona se você for admin):
--
--   select * from public.admin_alunos();

-- Cancelar uma assinatura sem apagar o histórico:
--
--   update public.assinaturas set ativo = false
--    where lower(email) = lower('aluno@exemplo.com');

-- Ver as assinaturas de uma pessoa:
--
--   select plano, inicio, fim, ativo, observacao from public.assinaturas
--    where lower(email) = lower('aluno@exemplo.com') order by fim desc;

-- Dar acesso à trilha CT Residência para um aluno:
--
--   update public.perfis set residencia = true
--    where lower(email) = lower('aluno@exemplo.com');

-- Tirar o poder de admin de alguém:
--
--   update public.perfis set admin = false
--    where lower(email) = lower('outro@exemplo.com');
