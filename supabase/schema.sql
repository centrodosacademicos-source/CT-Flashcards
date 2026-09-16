-- =====================================================================
-- Flashcards CT — esquema completo do banco de dados (Supabase/PostgreSQL)
-- =====================================================================
--
-- O QUE É ESTE ARQUIVO
-- Este é o "molde" do banco de dados do app. Ele cria as tabelas onde ficam
-- guardados os alunos, o progresso de estudo e as assinaturas do CT Premium,
-- e cria as regras de segurança que impedem um aluno de ver ou mexer nos
-- dados de outro.
--
-- COMO USAR
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run".
-- O passo a passo com fotos está em docs/SUPABASE.md.
--
-- PODE RODAR DUAS VEZES?
-- Pode. O arquivo é "idempotente": rodar de novo não apaga nada e não dá
-- erro. Ele só recria o que precisa ser recriado. Se um dia você mudar
-- alguma coisa aqui, é só colar o arquivo todo de novo e rodar.
--
-- ORDEM DOS BLOCOS
--   1. Tabelas
--   2. Índices
--   3. Funções auxiliares (eh_admin, meu_email)
--   4. Funções que o app chama (minha_assinatura, vincular_assinaturas,
--      admin_liberar, admin_alunos)
--   5. Gatilhos ("triggers"): criar perfil no cadastro, bloquear
--      auto-promoção a admin, carimbar a data de atualização do progresso
--   6. Segurança (RLS) — as regras de quem pode ler e escrever o quê
--   7. Permissões de acesso
--
-- =====================================================================


-- =====================================================================
-- 1. TABELAS
-- =====================================================================

-- ---------------------------------------------------------------------
-- perfis — uma linha por usuário cadastrado.
--
-- O Supabase já tem uma tabela própria de usuários (auth.users), mas ela é
-- do sistema de login e não podemos mexer nela. A tabela "perfis" é a nossa
-- cópia, com os campos que o app precisa. Ela é preenchida automaticamente
-- por um gatilho toda vez que alguém se cadastra (ver bloco 5).
-- ---------------------------------------------------------------------
create table if not exists public.perfis (
  -- mesmo id do usuário no sistema de login do Supabase.
  -- "on delete cascade": se o usuário for apagado no painel, o perfil some junto.
  id          uuid primary key references auth.users(id) on delete cascade,

  -- cópia do e-mail, para o admin conseguir achar o aluno pela busca.
  email       text        not null,

  -- nome que aparece dentro do app.
  nome        text        not null default '',

  -- 'm', 'f' ou vazio. Serve só para escrever os nomes dos troféus no
  -- masculino ou no feminino.
  genero      text,

  -- true = administrador (você). Quem é admin enxerga a lista de alunos e
  -- pode liberar o Premium. NUNCA é o app que muda isso: só o painel do
  -- Supabase ou o arquivo seed.sql. Há um gatilho no bloco 5 que garante isso.
  admin       boolean     not null default false,

  -- true = tem acesso à trilha "CT Residência".
  residencia  boolean     not null default false,

  -- quando o aluno se cadastrou.
  criado_em   timestamptz not null default now(),

  -- último login (o app carimba esta data quando o aluno entra).
  visto_em    timestamptz,

  -- só aceita 'm', 'f' ou vazio — evita lixo no banco.
  constraint perfis_genero_valido check (genero is null or genero in ('m','f'))
);

comment on table  public.perfis is
  'Um registro por usuário. Espelha auth.users com os campos que o app usa.';
comment on column public.perfis.admin is
  'Somente o painel/SQL altera. O app nunca consegue (ver trigger perfis_bloqueia_escalonamento).';
comment on column public.perfis.residencia is
  'Acesso à trilha CT Residência. Também só o painel/SQL altera.';


-- ---------------------------------------------------------------------
-- progresso — uma linha por usuário, com TODO o estado de estudo dele.
--
-- Em vez de dezenas de tabelas (cartas, revisões, favoritos, listas...),
-- guardamos o objeto inteiro que o app já usa na memória, num campo do tipo
-- "jsonb" (um texto em formato JSON que o Postgres entende e sabe consultar).
-- Vantagem: o app pode evoluir o formato sem precisar mexer no banco.
-- ---------------------------------------------------------------------
create table if not exists public.progresso (
  user_id       uuid        primary key references auth.users(id) on delete cascade,

  -- o objeto "prog" inteiro do app: cards, log, fav, listas, meus, plano,
  -- trofeus, genero. O banco só guarda; quem entende o conteúdo é o app.
  dados         jsonb       not null default '{}'::jsonb,

  -- contador que sobe 1 a cada gravação. Serve para detectar conflito
  -- quando o aluno usa o app em dois aparelhos.
  versao        integer     not null default 0,

  -- data/hora da última gravação (carimbada por gatilho, ver bloco 5).
  atualizado_em timestamptz not null default now()
);

comment on table public.progresso is
  'Estado de estudo do aluno (cards, log, favoritos, listas, baralhos próprios, plano, troféus).';


-- ---------------------------------------------------------------------
-- assinaturas — quem tem o CT Premium e até quando.
--
-- Detalhe importante: a linha pode existir ANTES do aluno se cadastrar.
-- Quando alguém compra, você libera pelo e-mail (user_id fica vazio).
-- Quando essa pessoa cria a conta, a função vincular_assinaturas() casa o
-- e-mail com o usuário e preenche o user_id.
-- ---------------------------------------------------------------------
create table if not exists public.assinaturas (
  id          uuid        primary key default gen_random_uuid(),

  -- pode ficar vazio até o aluno se cadastrar.
  user_id     uuid        references auth.users(id) on delete cascade,

  -- SEMPRE guardado em minúsculas (garantido pelo gatilho do bloco 5).
  email       text        not null,

  plano       text        not null,

  inicio      date        not null default current_date,

  -- a assinatura vale ATÉ O FIM deste dia.
  fim         date        not null,

  -- false = cancelada. Nunca apagamos a linha, para não perder o histórico.
  ativo       boolean     not null default true,

  -- anotação livre, ex.: 'Kiwify pedido #1234'.
  observacao  text,

  -- qual admin liberou.
  criado_por  uuid        references auth.users(id) on delete set null,

  criado_em   timestamptz not null default now(),

  -- só três planos existem.
  constraint assinaturas_plano_valido check (plano in ('mensal','semestral','anual')),

  -- a data de fim nunca pode ser anterior à de início.
  constraint assinaturas_periodo_valido check (fim >= inicio)
);

comment on table  public.assinaturas is
  'Assinaturas do CT Premium. Pode ser criada só com o e-mail, antes do cadastro do aluno.';
comment on column public.assinaturas.email is
  'Sempre em minúsculas (normalizado por trigger).';


-- =====================================================================
-- 2. ÍNDICES
--
-- Índice é o "índice remissivo" do banco: faz a busca ser instantânea em
-- vez de o banco ter que ler linha por linha. Criamos onde realmente há
-- busca: por e-mail (sempre comparado em minúsculas), por usuário e por
-- data de fim da assinatura.
-- =====================================================================

-- achar um aluno pelo e-mail digitado de qualquer jeito (Maria@X.com).
create index if not exists perfis_email_lower_idx
  on public.perfis (lower(email));

-- ordenação da tela "Alunos" do admin (mais recentes primeiro).
create index if not exists perfis_visto_em_idx
  on public.perfis (visto_em desc nulls last);

-- casar assinatura com aluno pelo e-mail.
create index if not exists assinaturas_email_lower_idx
  on public.assinaturas (lower(email));

-- buscar as assinaturas de um usuário já vinculado.
create index if not exists assinaturas_user_id_idx
  on public.assinaturas (user_id);

-- descobrir rapidamente quais assinaturas ainda estão dentro do prazo.
create index if not exists assinaturas_fim_idx
  on public.assinaturas (fim);


-- =====================================================================
-- 3. FUNÇÕES AUXILIARES
--
-- SOBRE "security definer" — leia, é a parte mais delicada do arquivo.
--
-- As regras de segurança (RLS, bloco 6) precisam perguntar "quem está
-- logado é admin?". Para responder, é preciso ler a tabela perfis. Só que
-- a tabela perfis também tem regra de segurança — que por sua vez chama a
-- mesma função. Isso é uma pescadinha mordendo o rabo: recursão infinita,
-- e o banco devolve erro.
--
-- A saída é marcar a função como "security definer": ela roda com os
-- privilégios de quem a criou (o dono do banco), e não com os do aluno.
-- Como o dono da tabela não é submetido às regras de RLS, a consulta passa
-- direto e a recursão nunca acontece.
--
-- O "set search_path = public" trava em qual esquema a função procura as
-- tabelas. Sem isso, alguém poderia criar uma tabela falsa chamada "perfis"
-- em outro esquema e enganar a função. É trava de segurança obrigatória em
-- toda função "security definer".
-- =====================================================================

-- ---------------------------------------------------------------------
-- eh_admin() — devolve true se quem está logado agora é administrador.
--
-- Consulta public.perfis diretamente (sem passar pela política de RLS,
-- graças ao security definer). Se ninguém estiver logado, devolve false.
-- ---------------------------------------------------------------------
create or replace function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.admin from public.perfis p where p.id = auth.uid()),
    false
  );
$$;

comment on function public.eh_admin() is
  'true se o usuário logado é administrador. security definer para não criar recursão de RLS.';


-- ---------------------------------------------------------------------
-- meu_email() — devolve o e-mail de quem está logado, em minúsculas.
--
-- Também precisa ser security definer, porque a tabela de login
-- (auth.users) é do sistema e o app não tem permissão de ler direto.
-- Usada para casar assinaturas que foram liberadas só pelo e-mail.
-- ---------------------------------------------------------------------
create or replace function public.meu_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(u.email) from auth.users u where u.id = auth.uid();
$$;

comment on function public.meu_email() is
  'E-mail (minúsculo) do usuário logado, lido de auth.users. Usado para casar assinaturas por e-mail.';


-- =====================================================================
-- 4. FUNÇÕES QUE O APP CHAMA
--
-- São as "perguntas" que o app faz ao banco. No código do app elas
-- aparecem como supabase.rpc('nome_da_funcao', {...}).
-- =====================================================================

-- ---------------------------------------------------------------------
-- minha_assinatura() — "eu tenho Premium? até quando?"
--
-- Devolve NO MÁXIMO UMA linha: a assinatura ativa do usuário logado com a
-- data de fim mais distante. Casa tanto por user_id quanto pelo e-mail
-- (para funcionar mesmo antes de a assinatura ser vinculada).
-- Se não houver assinatura válida, devolve ZERO linhas — e é assim que o
-- app sabe que o aluno não tem Premium.
--
-- É esta função que substituiu o antigo código CT-AAAAMMDD-XXXXXX: o aluno
-- não consegue mais liberar o Premium sozinho, quem responde é o banco.
--
-- dias_restantes: 0 significa "vence hoje" (ainda vale o dia inteiro).
-- ---------------------------------------------------------------------
drop function if exists public.minha_assinatura();

create function public.minha_assinatura()
returns table (plano text, fim date, dias_restantes integer)
language sql
stable
security definer
set search_path = public
as $$
  select a.plano,
         a.fim,
         (a.fim - current_date)::integer as dias_restantes
    from public.assinaturas a
   where a.ativo = true
     and a.fim >= current_date
     and (
           a.user_id = auth.uid()
           or lower(a.email) = coalesce(public.meu_email(), '')
         )
   order by a.fim desc
   limit 1;
$$;

comment on function public.minha_assinatura() is
  'Assinatura ativa do usuário logado (a de fim mais distante), ou zero linhas se não houver.';


-- ---------------------------------------------------------------------
-- vincular_assinaturas() — "as compras feitas com o meu e-mail são minhas".
--
-- Quando você libera o Premium pelo e-mail antes de a pessoa se cadastrar,
-- a assinatura fica sem user_id. Assim que essa pessoa entra no app, o app
-- chama esta função uma vez, e ela carimba o user_id nas assinaturas com
-- aquele e-mail. Devolve quantas foram vinculadas (0 é normal).
-- ---------------------------------------------------------------------
create or replace function public.vincular_assinaturas()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_qtd   integer := 0;
begin
  -- ninguém logado: não há o que vincular.
  if v_uid is null then
    return 0;
  end if;

  v_email := public.meu_email();
  if v_email is null or v_email = '' then
    return 0;
  end if;

  update public.assinaturas
     set user_id = v_uid
   where user_id is null
     and lower(email) = v_email;

  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;

comment on function public.vincular_assinaturas() is
  'Preenche o user_id das assinaturas criadas só com o e-mail do usuário logado. Devolve quantas vinculou.';


-- ---------------------------------------------------------------------
-- admin_liberar(e-mail, plano, meses, observação) — liberar o Premium.
--
-- SÓ FUNCIONA PARA ADMIN. Se um aluno tentar chamar, o banco levanta o
-- erro 'apenas administradores' e nada acontece.
--
-- Exemplo de uso no SQL Editor:
--   select public.admin_liberar('maria@exemplo.com', 'anual', 12, 'Kiwify #1234');
--
-- Se já existir um perfil com aquele e-mail, a assinatura já sai vinculada
-- ao aluno. Se não existir, ela fica esperando o cadastro.
-- Devolve o id da assinatura criada.
-- ---------------------------------------------------------------------
create or replace function public.admin_liberar(
  p_email  text,
  p_plano  text,
  p_meses  integer,
  p_obs    text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_email text;
  v_uid   uuid;
  v_id    uuid;
begin
  -- porteiro: só admin passa.
  if not public.eh_admin() then
    raise exception 'apenas administradores';
  end if;

  v_email := lower(trim(coalesce(p_email, '')));
  if v_email = '' then
    raise exception 'e-mail obrigatório';
  end if;

  if p_meses is null or p_meses < 1 then
    raise exception 'informe um número de meses maior que zero';
  end if;

  -- se o aluno já tem conta, a assinatura já nasce vinculada a ele.
  select p.id into v_uid
    from public.perfis p
   where lower(p.email) = v_email
   limit 1;

  insert into public.assinaturas (user_id, email, plano, inicio, fim, ativo, observacao, criado_por)
  values (
    v_uid,
    v_email,
    p_plano,
    current_date,
    (current_date + (p_meses || ' months')::interval)::date,
    true,
    nullif(trim(coalesce(p_obs, '')), ''),
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.admin_liberar(text, text, integer, text) is
  'Cria uma assinatura do Premium. Exclusiva de administradores.';


-- ---------------------------------------------------------------------
-- admin_alunos() — a lista de alunos da tela de administração.
--
-- SÓ FUNCIONA PARA ADMIN. Uma linha por aluno, com o plano ativo (se
-- houver), quantas cartas ele já estudou e quantas revisões fez no total.
-- Ordenada por quem entrou mais recentemente.
--
-- "cartas_estudadas" conta as chaves dentro de dados->'cards'.
-- "revisoes" soma o campo 'rev' de cada dia dentro de dados->'log'.
-- Os testes de jsonb_typeof evitam erro caso um aluno tenha dados
-- em formato inesperado.
-- ---------------------------------------------------------------------
drop function if exists public.admin_alunos();

create function public.admin_alunos()
returns table (
  email            text,
  nome             text,
  criado_em        timestamptz,
  visto_em         timestamptz,
  admin            boolean,
  residencia       boolean,
  plano            text,
  fim              date,
  cartas_estudadas integer,
  revisoes         integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  -- porteiro: só admin passa.
  if not public.eh_admin() then
    raise exception 'apenas administradores';
  end if;

  return query
  select
      p.email,
      p.nome,
      p.criado_em,
      p.visto_em,
      p.admin,
      p.residencia,
      a.plano,
      a.fim,
      coalesce(
        (select case
                  when jsonb_typeof(pr.dados -> 'cards') = 'object'
                    then (select count(*)::integer from jsonb_object_keys(pr.dados -> 'cards'))
                  else 0
                end
           from public.progresso pr
          where pr.user_id = p.id),
        0
      )::integer as cartas_estudadas,
      coalesce(
        (select case
                  when jsonb_typeof(pr.dados -> 'log') = 'object'
                    then (
                      select coalesce(sum((e.value ->> 'rev')::numeric), 0)::integer
                        from jsonb_each(pr.dados -> 'log') as e(key, value)
                       where jsonb_typeof(e.value -> 'rev') = 'number'
                    )
                  else 0
                end
           from public.progresso pr
          where pr.user_id = p.id),
        0
      )::integer as revisoes
    from public.perfis p
    -- pega a assinatura ativa mais longa deste aluno, se houver
    left join lateral (
      select s.plano, s.fim
        from public.assinaturas s
       where s.ativo = true
         and s.fim >= current_date
         and (s.user_id = p.id or lower(s.email) = lower(p.email))
       order by s.fim desc
       limit 1
    ) a on true
   order by p.visto_em desc nulls last;
end;
$$;

comment on function public.admin_alunos() is
  'Lista de alunos com plano, cartas estudadas e revisões. Exclusiva de administradores.';


-- =====================================================================
-- 5. GATILHOS ("TRIGGERS")
--
-- Gatilho é uma regra que o banco executa sozinho quando algo acontece.
-- São três aqui, e todos são importantes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 5.1 Criar o perfil automaticamente quando alguém se cadastra.
--
-- O Supabase grava o novo usuário em auth.users. Este gatilho ouve esse
-- momento e cria a linha correspondente em public.perfis, aproveitando o
-- nome que o app enviou no cadastro (raw_user_meta_data->>'nome').
--
-- O "on conflict do nothing" faz o gatilho ser seguro se por algum motivo
-- o perfil já existir.
-- ---------------------------------------------------------------------
create or replace function public.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis (id, email, nome)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.criar_perfil_novo_usuario() is
  'Cria a linha em public.perfis assim que um usuário se cadastra no Supabase.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.criar_perfil_novo_usuario();


-- ---------------------------------------------------------------------
-- 5.2 TRAVA ANTI-ESCALONAMENTO — o gatilho mais importante do arquivo.
--
-- Sem ele, qualquer aluno poderia abrir o console do navegador e mandar
--     update perfis set admin = true
-- na PRÓPRIA linha (o que a regra de RLS permite, porque é a linha dele!)
-- e virar administrador, abrindo o app inteiro de graça.
--
-- Como funciona: antes de gravar qualquer alteração em perfis, o banco
-- verifica quem está mandando. Se não for um admin, os valores de "admin"
-- e "residencia" são silenciosamente devolvidos ao que eram antes. O resto
-- da alteração (nome, gênero, visto_em) passa normalmente.
--
-- A condição "auth.uid() is null" libera a alteração quando ela vem do
-- painel do Supabase / seed.sql (onde não existe usuário logado). Isso é
-- seguro: sem usuário logado, a própria RLS já impede qualquer aluno de
-- alterar linha nenhuma.
-- ---------------------------------------------------------------------
create or replace function public.perfis_bloqueia_escalonamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- painel do Supabase / seed.sql (sem usuário logado) ou um admin de verdade:
  -- pode alterar os campos sensíveis.
  if auth.uid() is null or public.eh_admin() then
    return new;
  end if;

  -- qualquer outra pessoa: os dois campos voltam ao valor antigo.
  new.admin      := old.admin;
  new.residencia := old.residencia;
  return new;
end;
$$;

comment on function public.perfis_bloqueia_escalonamento() is
  'Impede que um aluno se promova a admin ou se dê acesso à trilha Residência.';

drop trigger if exists perfis_antes_de_atualizar on public.perfis;
create trigger perfis_antes_de_atualizar
  before update on public.perfis
  for each row
  execute function public.perfis_bloqueia_escalonamento();


-- ---------------------------------------------------------------------
-- 5.3 Progresso: carimbar a data e subir o número da versão.
--
-- A cada gravação do progresso, o banco atualiza sozinho "atualizado_em"
-- e soma 1 em "versao". O app não precisa (e não consegue) mentir sobre
-- esses dois campos.
-- ---------------------------------------------------------------------
create or replace function public.progresso_carimbar()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();

  if tg_op = 'UPDATE' then
    new.versao := coalesce(old.versao, 0) + 1;
  end if;

  return new;
end;
$$;

comment on function public.progresso_carimbar() is
  'Mantém progresso.atualizado_em e progresso.versao sempre corretos.';

drop trigger if exists progresso_antes_de_gravar on public.progresso;
create trigger progresso_antes_de_gravar
  before insert or update on public.progresso
  for each row
  execute function public.progresso_carimbar();


-- ---------------------------------------------------------------------
-- 5.4 Assinaturas: e-mail sempre em minúsculas.
--
-- Garante a regra do contrato mesmo se alguém inserir uma linha na mão
-- pelo painel, digitando "Maria@Exemplo.COM".
-- ---------------------------------------------------------------------
create or replace function public.assinaturas_normalizar()
returns trigger
language plpgsql
as $$
begin
  new.email := lower(trim(new.email));
  return new;
end;
$$;

comment on function public.assinaturas_normalizar() is
  'Guarda o e-mail da assinatura sempre em minúsculas e sem espaços sobrando.';

drop trigger if exists assinaturas_antes_de_gravar on public.assinaturas;
create trigger assinaturas_antes_de_gravar
  before insert or update on public.assinaturas
  for each row
  execute function public.assinaturas_normalizar();


-- =====================================================================
-- 6. SEGURANÇA — RLS (Row Level Security, "segurança por linha")
--
-- Esta é a parte que protege os dados. Sem RLS, qualquer pessoa com a
-- chave pública do site (a "anon key") conseguiria baixar o banco inteiro.
--
-- Com a RLS ligada, o banco passa a fazer uma pergunta antes de CADA linha
-- que alguém tenta ler ou escrever: "esta pessoa pode ver/mexer nesta linha
-- específica?". Se a resposta for não, a linha simplesmente não existe para
-- ela — nem aparece, nem dá erro suspeito.
--
-- Regra de ouro: com RLS ligada e NENHUMA política escrita, ninguém pode
-- nada. Cada política abaixo é uma permissão que abrimos de propósito.
--
-- auth.uid() é o "crachá" de quem está logado. Se ninguém estiver logado,
-- ele é vazio e nenhuma comparação dá certo — ou seja, um visitante anônimo
-- não lê nada.
-- =====================================================================

alter table public.perfis      enable row level security;
alter table public.progresso   enable row level security;
alter table public.assinaturas enable row level security;


-- ---------------------------------------------------------------------
-- 6.1 perfis
--   ler     : o próprio aluno, ou um admin
--   criar   : só a própria linha (rede de segurança; normalmente é o gatilho)
--   alterar : só a própria linha, e sem tocar em admin/residencia (gatilho 5.2)
--   apagar  : ninguém
-- ---------------------------------------------------------------------
drop policy if exists perfis_ler        on public.perfis;
drop policy if exists perfis_criar      on public.perfis;
drop policy if exists perfis_alterar    on public.perfis;
drop policy if exists perfis_apagar     on public.perfis;

create policy perfis_ler on public.perfis
  for select
  using (id = auth.uid() or public.eh_admin());

create policy perfis_criar on public.perfis
  for insert
  with check (id = auth.uid());

create policy perfis_alterar on public.perfis
  for update
  using      (id = auth.uid())
  with check (id = auth.uid());

-- "using (false)" = nunca. Deixamos escrito para ficar claro na leitura
-- que apagar perfil pelo app é proibido de propósito.
create policy perfis_apagar on public.perfis
  for delete
  using (false);


-- ---------------------------------------------------------------------
-- 6.2 progresso — cada aluno é dono do próprio progresso, e só dele.
--     Nem o admin lê o progresso bruto por aqui (ele vê os números
--     agregados através da função admin_alunos).
-- ---------------------------------------------------------------------
drop policy if exists progresso_ler     on public.progresso;
drop policy if exists progresso_criar   on public.progresso;
drop policy if exists progresso_alterar on public.progresso;
drop policy if exists progresso_apagar  on public.progresso;

create policy progresso_ler on public.progresso
  for select
  using (user_id = auth.uid());

create policy progresso_criar on public.progresso
  for insert
  with check (user_id = auth.uid());

create policy progresso_alterar on public.progresso
  for update
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy progresso_apagar on public.progresso
  for delete
  using (user_id = auth.uid());


-- ---------------------------------------------------------------------
-- 6.3 assinaturas
--   ler     : o dono (por user_id OU pelo e-mail), ou um admin
--   criar   : só admin   -- é isso que impede o aluno de se dar Premium
--   alterar : só admin
--   apagar  : só admin
-- ---------------------------------------------------------------------
drop policy if exists assinaturas_ler     on public.assinaturas;
drop policy if exists assinaturas_criar   on public.assinaturas;
drop policy if exists assinaturas_alterar on public.assinaturas;
drop policy if exists assinaturas_apagar  on public.assinaturas;

create policy assinaturas_ler on public.assinaturas
  for select
  using (
    user_id = auth.uid()
    or lower(email) = coalesce(public.meu_email(), '')
    or public.eh_admin()
  );

create policy assinaturas_criar on public.assinaturas
  for insert
  with check (public.eh_admin());

create policy assinaturas_alterar on public.assinaturas
  for update
  using      (public.eh_admin())
  with check (public.eh_admin());

create policy assinaturas_apagar on public.assinaturas
  for delete
  using (public.eh_admin());


-- =====================================================================
-- 7. PERMISSÕES DE ACESSO
--
-- A RLS decide QUAIS LINHAS a pessoa vê. As permissões abaixo decidem se
-- ela pode sequer encostar na tabela. O Supabase usa três "crachás":
--   anon          = visitante que abriu o site e ainda não entrou
--   authenticated = aluno logado
--   service_role  = a chave secreta do painel (passa por cima da RLS)
--
-- O bloco está protegido por um "if": se você rodar este arquivo num
-- Postgres comum, onde esses crachás não existem, ele simplesmente pula
-- em vez de dar erro.
-- =====================================================================

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then

    execute 'grant usage on schema public to anon, authenticated';

    execute 'grant select, insert, update, delete on public.perfis      to authenticated';
    execute 'grant select, insert, update, delete on public.progresso   to authenticated';
    -- em assinaturas, quem barra o aluno é a RLS (só admin escreve),
    -- por isso a permissão de tabela pode ser ampla.
    execute 'grant select, insert, update, delete on public.assinaturas to authenticated';

    execute 'grant execute on function public.eh_admin()               to anon, authenticated';
    execute 'grant execute on function public.meu_email()              to anon, authenticated';
    execute 'grant execute on function public.minha_assinatura()       to authenticated';
    execute 'grant execute on function public.vincular_assinaturas()   to authenticated';
    execute 'grant execute on function public.admin_liberar(text, text, integer, text) to authenticated';
    execute 'grant execute on function public.admin_alunos()           to authenticated';

    -- o visitante anônimo não recebe permissão em tabela nenhuma:
    -- ele só consegue se cadastrar / fazer login.
    execute 'revoke all on public.perfis      from anon';
    execute 'revoke all on public.progresso   from anon';
    execute 'revoke all on public.assinaturas from anon';

  end if;
end;
$$;


-- =====================================================================
-- FIM. Se apareceu "Success. No rows returned", deu tudo certo.
-- Rode agora o supabase/seed.sql para se tornar administrador.
-- =====================================================================
