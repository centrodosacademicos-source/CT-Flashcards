# Contrato do banco — o que o cliente espera do Supabase

Este arquivo é a especificação que o SQL tem de cumprir. O código do app já foi
escrito contra ele. **Não invente tabela, coluna ou nome diferente.**

## Tabelas

### `perfis` — 1 linha por usuário, espelha `auth.users`
| coluna | tipo | notas |
|---|---|---|
| `id` | `uuid` PK | referencia `auth.users(id)` com `on delete cascade` |
| `email` | `text not null` | cópia do e-mail, para o admin achar o aluno |
| `nome` | `text not null default ''` | nome que aparece no app |
| `genero` | `text` | `'m'`, `'f'` ou null — usado nos nomes dos troféus |
| `admin` | `boolean not null default false` | **só o SQL/painel muda isto, nunca o cliente** |
| `residencia` | `boolean not null default false` | acesso à trilha CT Residência |
| `criado_em` | `timestamptz not null default now()` | |
| `visto_em` | `timestamptz` | último login |

Criada automaticamente por trigger `on auth.users insert`, lendo `nome` de
`raw_user_meta_data->>'nome'`.

### `progresso` — 1 linha por usuário, o estado do estudo
| coluna | tipo | notas |
|---|---|---|
| `user_id` | `uuid` PK | referencia `auth.users(id)` com `on delete cascade` |
| `dados` | `jsonb not null default '{}'` | o objeto `prog` inteiro do app |
| `versao` | `integer not null default 0` | incrementa a cada gravação |
| `atualizado_em` | `timestamptz not null default now()` | atualizado por trigger |

O `dados` tem esta forma (o app cuida do conteúdo; o banco só guarda):
```json
{ "cards": {"<cardId>": {"ef":2.5,"reps":3,"iv":7,"lapses":0,"due":1757000000000,"ts":1756900000000}},
  "log": {"2026-09-09": {"rev":40,"ok":33,"nov":12}},
  "fav": {"<cardId>": 1756900000000},
  "listas": [{"id":"l1","nome":"Revisar antes da prova","cards":["<cardId>"]}],
  "meus": [{"id":"b1","nome":"Plantão","criado":1756900000000,"cards":[{"id":"meu-b1-1","f":"…","v":"…","criado":1756900000000}]}],
  "plano": {"meta":40,"dias":[1,2,3,4,5],"prova":"2026-12-01"},
  "trofeus": {"3":1756900000000},
  "genero": "m" }
```

### `assinaturas` — quem tem CT Premium
| coluna | tipo | notas |
|---|---|---|
| `id` | `uuid` PK default `gen_random_uuid()` | |
| `user_id` | `uuid` | pode ser `null`: o CT libera pelo e-mail antes de o aluno se cadastrar |
| `email` | `text not null` | **guardar sempre em minúsculas** |
| `plano` | `text not null` | `'mensal'`, `'semestral'` ou `'anual'` |
| `inicio` | `date not null default current_date` | |
| `fim` | `date not null` | a assinatura vale até o fim deste dia |
| `ativo` | `boolean not null default true` | o CT pode cancelar sem apagar o histórico |
| `observacao` | `text` | ex.: "Kiwify pedido #1234" |
| `criado_por` | `uuid` | o admin que liberou |
| `criado_em` | `timestamptz not null default now()` | |

Índice em `lower(email)` e em `user_id`.

## Funções (RPC chamadas pelo app)

### `public.eh_admin() returns boolean`
`security definer`, `stable`. `true` se o usuário logado tem `perfis.admin`.
Usada dentro das políticas — **tem de evitar recursão de RLS** (consultar `perfis`
com `security definer` e `set search_path = public`).

### `public.minha_assinatura() returns table(plano text, fim date, dias_restantes integer)`
`security definer`, `stable`. Devolve **no máximo uma linha**: a assinatura ativa
do usuário logado com a data `fim` mais distante, casando por `user_id` **ou** por
`lower(email) = lower(e-mail do usuário logado)`, com `ativo = true` e
`fim >= current_date`. Se não houver, devolve zero linhas.

> É esta função que substitui o código `CT-AAAAMMDD-XXXXXX`. O aluno não consegue
> mais liberar o Premium sozinho: quem responde é o banco.

### `public.vincular_assinaturas() returns integer`
`security definer`, `volatile`. Preenche `user_id` das assinaturas que foram
criadas só com o e-mail e agora batem com o usuário logado. Devolve quantas
vinculou. O app chama isso uma vez a cada login.

### `public.admin_liberar(p_email text, p_plano text, p_meses integer, p_obs text) returns uuid`
`security definer`, `volatile`. **Só funciona se `eh_admin()`** — caso contrário
levanta exceção `'apenas administradores'`. Cria a assinatura com
`fim = current_date + (p_meses || ' months')::interval`, já vinculada ao `user_id`
se existir perfil com aquele e-mail. Devolve o id criado.

### `public.admin_alunos() returns table(...)`
`security definer`, `stable`, só para admin. Uma linha por perfil, com:
`email`, `nome`, `criado_em`, `visto_em`, `admin`, `residencia`,
`plano` (da assinatura ativa, ou null), `fim` (date, ou null),
`cartas_estudadas` (int, `jsonb_object_keys` de `dados->'cards'`),
`revisoes` (int, soma de `rev` em `dados->'log'`).
Ordenado por `visto_em desc nulls last`.

## Segurança (RLS) — ligar em TODAS as tabelas

| tabela | select | insert | update | delete |
|---|---|---|---|---|
| `perfis` | o próprio (`id = auth.uid()`) **ou** admin | o próprio | o próprio, **sem poder mudar `admin` nem `residencia`** | ninguém |
| `progresso` | o próprio | o próprio | o próprio | o próprio |
| `assinaturas` | o próprio (`user_id = auth.uid()` ou `lower(email)` = o e-mail logado) **ou** admin | só admin | só admin | só admin |

O bloqueio de escalonamento em `perfis` é obrigatório: sem ele, qualquer aluno faz
`update perfis set admin = true` e abre o app inteiro. Usar um trigger
`before update` que restaura os valores antigos de `admin` e `residencia` quando
quem edita não é admin.

## Entregáveis

1. `supabase/schema.sql` — idempotente (`create ... if not exists`, `drop policy if exists`
   antes de recriar). Tem de poder rodar duas vezes seguidas sem erro.
2. `supabase/seed.sql` — promove um e-mail a admin, com o e-mail em um lugar só,
   comentado e fácil de trocar. Usar `centrodosacademicos@gmail.com` como padrão.
3. `supabase/testes.sql` — consultas que provam que a RLS funciona: um aluno não
   lê o progresso de outro, não vira admin, não cria assinatura para si mesmo.
   Cada teste imprime PASSOU/FALHOU com `raise notice`.
4. `docs/SUPABASE.md` — passo a passo em português, para quem **nunca** usou banco
   de dados: criar a conta, criar o projeto, onde colar o SQL, onde achar as duas
   chaves (URL e anon key), como ativar o login por e-mail, e como conferir que
   deu certo. Explicar em uma linha por que a `anon key` pode ficar pública
   (é a RLS que protege) e que a `service_role key` **nunca** pode ir para o site.
