-- =====================================================================
-- Flashcards CT — testes de segurança do banco
-- =====================================================================
--
-- PARA QUE SERVE
-- Este arquivo prova, na prática, que as regras de segurança funcionam.
-- Ele cria três usuários de mentira (um admin e dois alunos), finge ser
-- cada um deles e tenta fazer coisas que NÃO deveriam ser permitidas:
-- ler o progresso do colega, virar administrador sozinho, se dar o
-- Premium de graça, etc.
--
-- Cada tentativa imprime PASSOU ou FALHOU.
-- No fim ainda aparece uma tabelinha com o resultado de todos os testes.
--
-- COMO RODAR
-- Cole o arquivo inteiro no SQL Editor do Supabase e clique em "Run".
-- Leia o resultado: TEM QUE SER "PASSOU" EM TODOS. Se algum der FALHOU,
-- não coloque o app no ar — rode o schema.sql de novo e teste outra vez.
--
-- ELE ESTRAGA MEUS DADOS?
-- Não. A última linha do arquivo é um "rollback", que desfaz tudo o que
-- foi feito aqui dentro. Os três usuários de mentira desaparecem sozinhos.
-- Nada do que você já tem é tocado.
--
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Tabelinha temporária onde os resultados vão sendo anotados.
-- ---------------------------------------------------------------------
create temp table _res (
  quando timestamptz default clock_timestamp(),
  teste  text,
  status text
);
grant select, insert on _res to public;

-- Função de apoio: anota o resultado e imprime na tela.
create function pg_temp.checar(p_teste text, p_ok boolean) returns void
language plpgsql as $$
declare
  v_status text := case when p_ok then 'PASSOU' else 'FALHOU' end;
begin
  insert into _res (teste, status) values (p_teste, v_status);
  raise notice '[%] %', v_status, p_teste;
end;
$$;


-- =====================================================================
-- PREPARO — três usuários de mentira
--   admin  : o dono do app
--   aluno1 : nosso cobaia, é ele quem vai tentar as travessuras
--   aluno2 : a vítima, cujos dados o aluno1 não pode enxergar
-- =====================================================================

insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111',
   'authenticated','authenticated','teste.admin@flashcards-ct.invalid','x',
   now(),'{}'::jsonb,'{"nome":"Admin de Teste"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-2222-2222-2222-222222222222',
   'authenticated','authenticated','teste.aluno1@flashcards-ct.invalid','x',
   now(),'{}'::jsonb,'{"nome":"Aluno Um"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000',
   '33333333-3333-3333-3333-333333333333',
   'authenticated','authenticated','teste.aluno2@flashcards-ct.invalid','x',
   now(),'{}'::jsonb,'{"nome":"Aluno Dois"}'::jsonb, now(), now());

-- Teste 0: o gatilho de cadastro criou os três perfis sozinho?
do $$
declare v_n integer;
begin
  select count(*) into v_n from public.perfis
   where email like 'teste.%@flashcards-ct.invalid';
  perform pg_temp.checar('gatilho on auth.users criou o perfil automaticamente', v_n = 3);

  select count(*) into v_n from public.perfis
   where id = '22222222-2222-2222-2222-222222222222' and nome = 'Aluno Um';
  perform pg_temp.checar('o nome veio de raw_user_meta_data->>''nome''', v_n = 1);
end;
$$;

-- O admin de teste vira administrador (pelo painel/SQL, que é o único
-- caminho permitido). Note que aqui não há usuário logado, por isso o
-- gatilho anti-escalonamento deixa passar.
update public.perfis set admin = true
 where id = '11111111-1111-1111-1111-111111111111';

-- Progresso de cada aluno.
insert into public.progresso (user_id, dados) values
  ('22222222-2222-2222-2222-222222222222',
   '{"cards":{"c1":{"ef":2.5,"reps":3,"iv":7,"lapses":0,"due":1757000000000,"ts":1756900000000},
              "c2":{"ef":2.3,"reps":1,"iv":1,"lapses":1,"due":1757000000000,"ts":1756900000000}},
     "log":{"2026-09-08":{"rev":40,"ok":33,"nov":12},
            "2026-09-09":{"rev":25,"ok":20,"nov":5}},
     "fav":{},"listas":[],"meus":[],"trofeus":{}}'::jsonb),
  ('33333333-3333-3333-3333-333333333333',
   '{"cards":{"c9":{"ef":2.5,"reps":1,"iv":1,"lapses":0,"due":1757000000000,"ts":1756900000000}},
     "log":{"2026-09-09":{"rev":10,"ok":9,"nov":3}}}'::jsonb);

-- O aluno2 tem Premium; o aluno1 ainda não tem nada.
insert into public.assinaturas (user_id, email, plano, fim, criado_por)
values ('33333333-3333-3333-3333-333333333333',
        'teste.aluno2@flashcards-ct.invalid',
        'anual', current_date + 300,
        '11111111-1111-1111-1111-111111111111');


-- =====================================================================
-- BLOCO 1 — fingindo ser o ALUNO 1
--
-- As duas linhas abaixo são o que "faz de conta" que estamos logados:
--   set local role authenticated  -> deixo de ser o dono do banco e passo
--                                    a ser um aluno comum, sujeito à RLS
--   set local request.jwt...sub   -> digo qual é o meu crachá (auth.uid())
-- =====================================================================

set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

do $$
declare
  v_n     integer;
  v_bool  boolean;
  v_txt   text;
begin
  -- ---------- o que ELE PODE fazer (a RLS não pode ser rígida demais) ----------

  select count(*) into v_n from public.perfis
   where id = '22222222-2222-2222-2222-222222222222';
  perform pg_temp.checar('aluno LÊ o próprio perfil', v_n = 1);

  select count(*) into v_n from public.progresso
   where user_id = '22222222-2222-2222-2222-222222222222';
  perform pg_temp.checar('aluno LÊ o próprio progresso', v_n = 1);

  update public.perfis set nome = 'Aluno Um Renomeado'
   where id = '22222222-2222-2222-2222-222222222222';
  get diagnostics v_n = row_count;
  perform pg_temp.checar('aluno consegue mudar o próprio nome', v_n = 1);

  update public.progresso set dados = dados || '{"fav":{"c1":1756900000000}}'::jsonb
   where user_id = '22222222-2222-2222-2222-222222222222';
  get diagnostics v_n = row_count;
  perform pg_temp.checar('aluno consegue gravar o próprio progresso', v_n = 1);

  select versao into v_n from public.progresso
   where user_id = '22222222-2222-2222-2222-222222222222';
  perform pg_temp.checar('a versão do progresso subiu sozinha a cada gravação', v_n >= 1);

  -- ---------- o que ele NÃO PODE fazer ----------

  select count(*) into v_n from public.perfis
   where id = '33333333-3333-3333-3333-333333333333';
  perform pg_temp.checar('aluno NÃO lê o perfil de outro aluno', v_n = 0);

  select count(*) into v_n from public.progresso
   where user_id = '33333333-3333-3333-3333-333333333333';
  perform pg_temp.checar('aluno NÃO lê o progresso de outro aluno', v_n = 0);

  select count(*) into v_n from public.progresso;
  perform pg_temp.checar('aluno enxerga APENAS a própria linha de progresso', v_n = 1);

  update public.progresso set dados = '{"hackeado":true}'::jsonb
   where user_id = '33333333-3333-3333-3333-333333333333';
  get diagnostics v_n = row_count;
  perform pg_temp.checar('aluno NÃO altera o progresso de outro aluno', v_n = 0);

  delete from public.progresso
   where user_id = '33333333-3333-3333-3333-333333333333';
  get diagnostics v_n = row_count;
  perform pg_temp.checar('aluno NÃO apaga o progresso de outro aluno', v_n = 0);

  -- A TENTATIVA MAIS IMPORTANTE: se promover a administrador.
  update public.perfis set admin = true
   where id = '22222222-2222-2222-2222-222222222222';
  select admin into v_bool from public.perfis
   where id = '22222222-2222-2222-2222-222222222222';
  perform pg_temp.checar('aluno NÃO consegue se promover a admin', v_bool = false);

  -- Segunda tentativa: se dar a trilha CT Residência.
  update public.perfis set residencia = true
   where id = '22222222-2222-2222-2222-222222222222';
  select residencia into v_bool from public.perfis
   where id = '22222222-2222-2222-2222-222222222222';
  perform pg_temp.checar('aluno NÃO consegue se dar acesso à Residência', v_bool = false);

  -- Terceira tentativa: promover mudando tudo de uma vez.
  update public.perfis set nome = 'x', admin = true, residencia = true
   where id = '22222222-2222-2222-2222-222222222222';
  select admin or residencia into v_bool from public.perfis
   where id = '22222222-2222-2222-2222-222222222222';
  perform pg_temp.checar('aluno NÃO se promove nem escondendo no meio de outros campos', v_bool = false);

  -- Promover OUTRA pessoa também não rola.
  update public.perfis set admin = true
   where id = '33333333-3333-3333-3333-333333333333';
  get diagnostics v_n = row_count;
  perform pg_temp.checar('aluno NÃO promove outra pessoa a admin', v_n = 0);

  delete from public.perfis where id = '22222222-2222-2222-2222-222222222222';
  get diagnostics v_n = row_count;
  perform pg_temp.checar('aluno NÃO apaga o próprio perfil', v_n = 0);

  -- Assinaturas: a fraude clássica, se dar Premium de graça.
  begin
    insert into public.assinaturas (user_id, email, plano, fim)
    values ('22222222-2222-2222-2222-222222222222',
            'teste.aluno1@flashcards-ct.invalid', 'anual', current_date + 3650);
    perform pg_temp.checar('aluno NÃO cria assinatura para si mesmo', false);
  exception when others then
    -- 42501 é o código do Postgres para "a regra de RLS barrou esta linha".
    -- Exigimos justamente esse código, para o teste não passar por engano
    -- por causa de outro erro qualquer.
    perform pg_temp.checar('aluno NÃO cria assinatura para si mesmo (barrado pela RLS)',
                           sqlstate = '42501');
  end;

  select count(*) into v_n from public.assinaturas;
  perform pg_temp.checar('aluno NÃO lê a assinatura de outro aluno', v_n = 0);

  select count(*) into v_n from public.minha_assinatura();
  perform pg_temp.checar('minha_assinatura() devolve ZERO linhas para quem não tem Premium', v_n = 0);

  -- Funções de administrador têm que barrar o aluno.
  select public.eh_admin() into v_bool;
  perform pg_temp.checar('eh_admin() devolve false para aluno comum', v_bool = false);

  begin
    perform public.admin_liberar('teste.aluno1@flashcards-ct.invalid', 'anual', 12, 'fraude');
    perform pg_temp.checar('admin_liberar() barra aluno comum', false);
  exception when others then
    perform pg_temp.checar(
      'admin_liberar() barra aluno comum com a mensagem "apenas administradores"',
      sqlerrm = 'apenas administradores');
  end;

  begin
    select count(*) into v_n from public.admin_alunos();
    perform pg_temp.checar('admin_alunos() barra aluno comum', false);
  exception when others then
    perform pg_temp.checar(
      'admin_alunos() barra aluno comum com a mensagem "apenas administradores"',
      sqlerrm = 'apenas administradores');
  end;
end;
$$;


-- =====================================================================
-- BLOCO 2 — o Premium liberado só pelo e-mail, antes do cadastro
--
-- É o caso real: alguém compra na Kiwify, você libera pelo e-mail, e a
-- pessoa só depois cria a conta. A assinatura precisa "achar" o dono.
-- =====================================================================

reset role;

insert into public.assinaturas (email, plano, fim, observacao, criado_por)
values ('TESTE.ALUNO1@Flashcards-CT.INVALID',   -- de propósito com maiúsculas
        'semestral', current_date + 180, 'compra por e-mail, sem user_id',
        '11111111-1111-1111-1111-111111111111');

do $$
declare v_txt text;
begin
  select email into v_txt from public.assinaturas
   where observacao = 'compra por e-mail, sem user_id';
  perform pg_temp.checar('o e-mail da assinatura foi guardado em minúsculas',
                         v_txt = 'teste.aluno1@flashcards-ct.invalid');
end;
$$;

set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

do $$
declare
  v_n     integer;
  v_plano text;
  v_dias  integer;
begin
  select count(*) into v_n from public.assinaturas;
  perform pg_temp.checar('aluno LÊ a assinatura que foi criada só com o e-mail dele', v_n = 1);

  select plano, dias_restantes into v_plano, v_dias from public.minha_assinatura();
  perform pg_temp.checar('minha_assinatura() reconhece o Premium pelo e-mail', v_plano = 'semestral');
  perform pg_temp.checar('minha_assinatura() calcula os dias restantes', v_dias between 179 and 181);

  -- o aluno não pode cancelar nem esticar a própria assinatura
  update public.assinaturas set fim = current_date + 3650;
  get diagnostics v_n = row_count;
  perform pg_temp.checar('aluno NÃO estica a validade da própria assinatura', v_n = 0);

  update public.assinaturas set ativo = false;
  get diagnostics v_n = row_count;
  perform pg_temp.checar('aluno NÃO cancela assinatura', v_n = 0);

  delete from public.assinaturas;
  get diagnostics v_n = row_count;
  perform pg_temp.checar('aluno NÃO apaga assinatura', v_n = 0);

  -- agora o vínculo: a assinatura passa a apontar para o user_id dele
  select public.vincular_assinaturas() into v_n;
  perform pg_temp.checar('vincular_assinaturas() vinculou 1 assinatura pelo e-mail', v_n = 1);

  select public.vincular_assinaturas() into v_n;
  perform pg_temp.checar('vincular_assinaturas() rodado de novo não duplica nada (devolve 0)', v_n = 0);

  select count(*) into v_n from public.minha_assinatura();
  perform pg_temp.checar('minha_assinatura() continua devolvendo no máximo UMA linha', v_n = 1);
end;
$$;


-- =====================================================================
-- BLOCO 3 — fingindo ser o ADMIN
-- =====================================================================

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
declare
  v_n      integer;
  v_bool   boolean;
  v_id     uuid;
  v_cartas integer;
  v_rev    integer;
  v_plano  text;
begin
  select public.eh_admin() into v_bool;
  perform pg_temp.checar('eh_admin() devolve true para o administrador', v_bool = true);

  select count(*) into v_n from public.perfis
   where email like 'teste.%@flashcards-ct.invalid';
  perform pg_temp.checar('admin LÊ o perfil de todos os alunos', v_n = 3);

  select count(*) into v_n from public.admin_alunos();
  perform pg_temp.checar('admin_alunos() funciona para o administrador', v_n >= 3);

  -- confere as contas de cartas e revisões do aluno1
  select cartas_estudadas, revisoes into v_cartas, v_rev
    from public.admin_alunos()
   where email = 'teste.aluno1@flashcards-ct.invalid';
  perform pg_temp.checar('admin_alunos() conta as cartas estudadas certo (2)', v_cartas = 2);
  perform pg_temp.checar('admin_alunos() soma as revisões certo (40+25=65)', v_rev = 65);

  select plano into v_plano from public.admin_alunos()
   where email = 'teste.aluno1@flashcards-ct.invalid';
  perform pg_temp.checar('admin_alunos() mostra o plano ativo do aluno', v_plano = 'semestral');

  -- liberar o Premium para um e-mail que ainda não tem conta
  select public.admin_liberar('novo.comprador@flashcards-ct.invalid','mensal',1,'Kiwify #1234')
    into v_id;
  perform pg_temp.checar('admin_liberar() cria a assinatura e devolve o id', v_id is not null);

  select count(*) into v_n from public.assinaturas
   where email = 'novo.comprador@flashcards-ct.invalid'
     and plano = 'mensal'
     and fim = (current_date + interval '1 month')::date;
  perform pg_temp.checar('admin_liberar() calculou a data de fim certa (hoje + 1 mês)', v_n = 1);

  -- liberar para quem JÁ tem conta: precisa nascer vinculado
  select public.admin_liberar('teste.aluno2@flashcards-ct.invalid','anual',12,'renovação')
    into v_id;
  select count(*) into v_n from public.assinaturas
   where id = v_id and user_id = '33333333-3333-3333-3333-333333333333';
  perform pg_temp.checar('admin_liberar() já vincula ao aluno que tem conta', v_n = 1);

  -- MESMO SENDO ADMIN, ninguém lê o progresso bruto de um aluno:
  -- o contrato diz que progresso é só do próprio dono.
  select count(*) into v_n from public.progresso
   where user_id = '22222222-2222-2222-2222-222222222222';
  perform pg_temp.checar('nem o admin lê o progresso bruto de um aluno (só os números agregados)', v_n = 0);
end;
$$;


-- =====================================================================
-- BLOCO 4 — fingindo ser um VISITANTE (ninguém logado)
-- =====================================================================

reset role;
set local role anon;
set local request.jwt.claim.sub = '';

do $$
declare v_n integer; v_bool boolean;
begin
  select public.eh_admin() into v_bool;
  perform pg_temp.checar('eh_admin() devolve false para visitante não logado', v_bool = false);

  begin
    select count(*) into v_n from public.perfis;
    perform pg_temp.checar('visitante não logado NÃO lê a tabela de perfis', v_n = 0);
  exception when insufficient_privilege then
    perform pg_temp.checar('visitante não logado NÃO lê a tabela de perfis', true);
  end;

  begin
    select count(*) into v_n from public.assinaturas;
    perform pg_temp.checar('visitante não logado NÃO lê a tabela de assinaturas', v_n = 0);
  exception when insufficient_privilege then
    perform pg_temp.checar('visitante não logado NÃO lê a tabela de assinaturas', true);
  end;

  -- E a tentativa mais óbvia de todas: usar a chave pública do site para
  -- se promover a admin sem nem fazer login.
  begin
    update public.perfis set admin = true;
    get diagnostics v_n = row_count;
    perform pg_temp.checar('visitante não logado NÃO promove ninguém a admin', v_n = 0);
  exception when insufficient_privilege then
    perform pg_temp.checar('visitante não logado NÃO promove ninguém a admin', true);
  end;
end;
$$;


-- =====================================================================
-- RESULTADO FINAL
-- =====================================================================

reset role;

-- O resumo sai como mensagem (NOTICE) porque o SQL Editor do Supabase
-- mostra só o resultado do ÚLTIMO comando — e o último aqui é o rollback.
-- Procure este texto na lista de mensagens embaixo do editor.
do $$
declare
  v_total  integer;
  v_falhou integer;
  r        record;
begin
  select count(*), count(*) filter (where status = 'FALHOU')
    into v_total, v_falhou
    from _res;

  raise notice '=====================================================';
  if v_falhou = 0 then
    raise notice 'TUDO CERTO — % testes, nenhuma falha.', v_total;
  else
    raise notice 'ATENCAO — % de % testes FALHARAM:', v_falhou, v_total;
    for r in select teste from _res where status = 'FALHOU' order by quando loop
      raise notice '   FALHOU: %', r.teste;
    end loop;
    raise notice 'Rode o supabase/schema.sql de novo e repita este teste.';
  end if;
  raise notice '=====================================================';
end;
$$;

-- Estas duas consultas aparecem para quem roda por linha de comando (psql).
select status, teste
  from _res
 order by quando;

select case when count(*) filter (where status = 'FALHOU') = 0
            then 'TUDO CERTO — ' || count(*) || ' testes, nenhuma falha'
            else 'ATENÇÃO — ' || count(*) filter (where status = 'FALHOU') ||
                 ' teste(s) FALHARAM. Rode o schema.sql de novo.'
       end as resultado
  from _res;


-- =====================================================================
-- Desfaz TUDO o que este arquivo criou. Nada aqui fica no banco.
-- =====================================================================
rollback;
