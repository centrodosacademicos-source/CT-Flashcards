# Operação do dia a dia

O que fazer depois que o site já está no ar. Cada seção é uma tarefa completa,
do começo ao fim.

**Antes de tudo, saiba em que modo o seu app está.** As tarefas mudam conforme
a resposta:

| Se em `public/assets/js/config.js` os campos `SUPABASE_URL` e `SUPABASE_ANON_KEY` estão… | O app está no… | O que muda |
|---|---|---|
| **vazios** | **modo local** | Cada aluno tem conta e progresso guardados só no navegador dele. Não existe lista de alunos, nem recuperação de senha, nem liberação de Premium por você. |
| **preenchidos** | **modo nuvem** | Contas, progresso e assinaturas ficam no Supabase. É o modo que este guia assume. |

Se ainda não fez a parte do banco, ela está em [SUPABASE.md](SUPABASE.md).

---

## Onde é o "painel do Supabase"

Sempre o mesmo caminho: **https://supabase.com** → **Sign in** → clique no
projeto `flashcards-ct`. As duas telas usadas o tempo todo são:

- **SQL Editor** (ícone de folha com `SQL`, na coluna da esquerda) — onde você
  cola comandos e clica em **Run**.
- **Table Editor** (ícone de tabela) — onde você vê as tabelas `perfis`,
  `progresso` e `assinaturas` como se fossem planilhas.

Em toda receita abaixo, "rodar isto" significa: SQL Editor → **+ New query** →
colar → **Run**.

---

## 1. Liberar o CT Premium para um aluno que pagou

### 1.1 Pelo painel do Supabase — é este o caminho que funciona

A função oficial do banco é esta, com esta assinatura exata:

```sql
public.admin_liberar(p_email text, p_plano text, p_meses integer, p_obs text) returns uuid
```

Para chamá-la, rode:

```sql
select public.admin_liberar('aluno@exemplo.com', 'anual', 12, 'Kiwify #1234');
```

| Argumento | O que é | Valores aceitos |
|---|---|---|
| `p_email` | e-mail da compra | qualquer e-mail; é guardado em minúsculas |
| `p_plano` | nome do plano | **só** `'mensal'`, `'semestral'` ou `'anual'` |
| `p_meses` | por quantos meses vale, a partir de hoje | um número maior que zero |
| `p_obs` | anotação sua | texto livre; pode ser `''` |

> **Cuidado com um detalhe que engana:** `p_plano` e `p_meses` são
> independentes. Nada impede escrever `'anual'` com `1` mês. Combine sempre:
> mensal → 1, semestral → 6, anual → 12.

**Se aparecer o erro `apenas administradores`**, não é problema seu. A função
pergunta "quem está logado é admin?", e **dentro do SQL Editor não há ninguém
logado** — quem roda ali é o dono do banco, não uma conta de aluno. Nesse caso,
use o comando equivalente abaixo, que faz exatamente a mesma coisa e sempre
funciona no painel:

```sql
insert into public.assinaturas (email, plano, inicio, fim, ativo, observacao)
values (
  lower(trim('aluno@exemplo.com')),
  'anual',
  current_date,
  (current_date + interval '12 months')::date,
  true,
  'Kiwify #1234'
);
```

Troque as três coisas: o e-mail, o `'anual'` e o `12`.

**Como saber se deu certo:** aparece `Success. No rows returned` (no `insert`)
ou uma tabelinha com um código longo (no `admin_liberar`). Confira com:

```sql
select email, plano, inicio, fim, ativo, observacao
  from public.assinaturas
 where lower(email) = lower('aluno@exemplo.com')
 order by fim desc;
```

### O aluno ainda não tem conta? Libere assim mesmo

A assinatura pode ser criada **antes** de a pessoa se cadastrar. Ela fica
guardada pelo e-mail e gruda sozinha no aluno no primeiro login — quem faz isso
é a função `vincular_assinaturas()`, que o app chama a cada entrada. Você não
precisa fazer mais nada.

O que **precisa** bater é o e-mail: o do cadastro tem que ser o mesmo da
compra. Se o aluno se cadastrar com outro e-mail, o Premium não aparece.

### 1.2 Pelo painel de administrador dentro do app — não funciona no modo nuvem

Dizendo com todas as letras: **o painel de admin do app não libera o Premium
quando o Supabase está configurado.**

O que aquela tela faz é gerar um código no formato `CT-20270308-A1B2C3`. Esse
código só é aceito no **modo local** (sem banco). Com o banco ligado, quem
responde se o aluno é Premium é a função `minha_assinatura()` do servidor, e o
código gerado ali **não libera nada** — o aluno vai colar e continuar vendo a
tela de assinatura.

Enquanto essa tela não for reescrita para chamar `admin_liberar`, use sempre o
caminho 1.1.

### Cancelar uma assinatura

Sem apagar o histórico da compra:

```sql
update public.assinaturas set ativo = false
 where lower(email) = lower('aluno@exemplo.com');
```

O acesso cai na próxima vez que o aluno abrir o app (o app pergunta ao servidor
a cada entrada).

### Renovar

Não altere a linha antiga. Crie uma nova assinatura, do mesmo jeito da seção
1.1. O banco sempre usa a de **data de fim mais distante**.

---

## 2. Conferir quem tem assinatura ativa e quem vai vencer

### Todos os assinantes ativos hoje

```sql
select email, plano, inicio, fim, (fim - current_date) as dias_restantes, observacao
  from public.assinaturas
 where ativo = true
   and fim >= current_date
 order by fim;
```

`dias_restantes` igual a `0` quer dizer **vence hoje** — e ainda vale o dia
inteiro.

### Quem vence nos próximos 15 dias

```sql
select email, plano, fim, (fim - current_date) as dias_restantes
  from public.assinaturas
 where ativo = true
   and fim between current_date and current_date + 15
 order by fim;
```

Troque o `15` pelo número de dias que quiser.

### Quem já venceu e não renovou

```sql
select email, plano, fim
  from public.assinaturas
 where ativo = true
   and fim < current_date
 order by fim desc;
```

### A lista completa de alunos, com plano

O banco tem a função `admin_alunos()`, feita para isso:

```sql
select * from public.admin_alunos();
```

**Se ela responder `apenas administradores`**, é o mesmo motivo da seção 1.1 —
no SQL Editor não existe usuário logado. Use a consulta abaixo, que devolve as
mesmas informações:

```sql
select p.email,
       p.nome,
       p.criado_em,
       p.visto_em,
       p.admin,
       p.residencia,
       a.plano,
       a.fim
  from public.perfis p
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
```

`plano` vazio significa aluno sem assinatura ativa. `visto_em` é a última vez
que ele entrou.

---

## 3. Dar acesso de administrador a alguém

Ser administrador dá duas coisas: acesso total ao conteúdo e o menu **Admin**
dentro do app.

**A pessoa precisa já ter criado a conta no app.** Sem conta, não há o que
promover.

```sql
update public.perfis
   set admin = true,
       residencia = true
 where lower(email) = lower('fulano@exemplo.com');
```

Confira quem é admin hoje:

```sql
select email, nome, admin, residencia, criado_em
  from public.perfis
 where admin = true
 order by criado_em;
```

Para tirar o poder de admin:

```sql
update public.perfis set admin = false
 where lower(email) = lower('fulano@exemplo.com');
```

Para dar só a trilha CT Residência, sem virar admin:

```sql
update public.perfis set residencia = true
 where lower(email) = lower('fulano@exemplo.com');
```

Depois de qualquer um desses comandos, a pessoa precisa **recarregar o app**
(`F5`) ou sair e entrar de novo.

> **Por que isso funciona no painel e não funciona pelo app?** Existe uma trava
> no banco (um gatilho chamado `perfis_bloqueia_escalonamento`) que desfaz
> qualquer tentativa de um aluno se promover a administrador ou se dar a trilha
> Residência mexendo no próprio perfil. A trava deixa passar só quando a
> alteração vem do painel, onde não há aluno logado. É de propósito, e é o que
> impede alguém de abrir o app inteiro de graça.

---

## 4. Corrigir o texto de um flashcard

### 4.1 Achar o arquivo

Cada tema tem um arquivo em `public/data/temas/`:

| Tema | Arquivo | Cartas |
|---|---|---|
| Cardiologia | `cardio.json` | 509 |
| Emergência | `emerg.json` | 441 |
| Terapia Intensiva & VM | `uti.json` | 390 |
| Neurologia | `neuro.json` | 444 |
| Pneumologia | `pneumo.json` | 486 |
| Infectologia | `infecto.json` | 507 |
| Nefrologia | `nefro.json` | 361 |
| Endocrinologia | `endocrino.json` | 436 |
| Gastro-Hepatologia | `gastro.json` | 424 |
| Hematologia | `hemato.json` | 444 |
| Reumatologia | `reumato.json` | 389 |
| Psiquiatria | `psiq.json` | 276 |
| Geriatria & Paliativos | `geriatria.json` | 170 |
| Dermatologia | `derma.json` | 200 |
| Oftalmo & Otorrino | `oftorl.json` | 154 |
| SUS & Saúde Coletiva | `sus.json` | 202 |
| Cirurgia | `cirurgia.json` | 875 |
| Ginecologia & Obstetrícia | `go.json` | 1.029 |
| Pediatria | `pediatria.json` | 1.223 |
| Oncologia | `onco.json` | 515 |
| Medicina Preventiva | `preventiva.json` | 799 |

### 4.2 Achar a carta dentro do arquivo

Cada arquivo tem esta forma — **tudo numa linha só**, sem quebras:

```json
{"sca":{"sca-b1":{"f":"O que é uma síndrome coronariana aguda sem supra de ST?","v":"Quadro agudo de isquemia…"},"sca-b2":{…}},"iam":{…}}
```

Lendo de fora para dentro:

| Pedaço | O que é |
|---|---|
| `"sca"` | o **id do subtema** |
| `"sca-b1"` | o **id da carta** |
| `"f"` | a **frente** — a pergunta |
| `"v"` | o **verso** — a resposta |
| `"ex"` | a **dica/armadilha** (opcional; muitas cartas não têm) |

**Como achar a carta que você quer corrigir.** O jeito prático é **não** procurar
pelo id, e sim por um pedaço do próprio texto:

1. No app, abra a carta e copie um trecho curto e específico da pergunta
   (por exemplo: `dose de adrenalina na PCR`).
2. No GitHub, abra o arquivo do tema e clique no lápis ✏️ (*Edit this file*).
3. Clique dentro do texto e aperte `Ctrl+F` (`Cmd+F` no Mac).
4. Cole o trecho. O editor pula para ele.

> Se o editor do GitHub se recusar a abrir o arquivo por ser grande — acontece
> com o `pediatria.json`, de 1,2 MB — volte à página inicial do repositório e
> aperte a tecla **`.`** (ponto). Abre um editor completo dentro do navegador,
> que aguenta arquivos grandes. O caminho está detalhado em
> [GITHUB.md](GITHUB.md), Parte 7.

Os ids seguem um padrão que ajuda a se localizar: `sca-b1` a `sca-b6` são as
**seis cartas de base** do subtema `sca` (as da "Revisão rápida"), e depois vêm
`sca-x1`, `sca-n1`, `sca-r1` e afins. Alguns ids antigos têm o formato
`cardio#12` — o `#` faz parte do nome e não pode ser mudado.

### 4.3 O que pode e o que não pode escrever

| Pode | Não pode |
|---|---|
| Trocar o texto dentro das aspas de `"f"`, `"v"` e `"ex"` | Trocar o id da carta (`"sca-b1"`) — o progresso dos alunos está preso a ele |
| Usar `<b>negrito</b>`, `<i>itálico</i>` e `<br>` para quebrar linha | Apagar as aspas, as vírgulas, as chaves `{ }` |
| Usar acentos, ç, símbolos (µg, ≥, °C) | Usar aspas duplas dentro do texto |

**Sobre as aspas duplas:** elas fechariam o campo no meio e quebrariam o
arquivo. Se precisar de aspas no texto, use aspas simples (`'assim'`) ou o
código `&quot;`.

### 4.4 Salvar e o que acontece depois

1. Role até o fim da página e clique em **Commit changes**.
2. Escreva o que mudou ("corrigi a dose de adrenalina") e confirme.
3. Vá na aba **Actions**. A conferência roda e, se passar, o site é publicado.
   Leva de 2 a 4 minutos.
4. Se aparecer **✗ vermelho**, o site antigo continua no ar e nada quebrou para
   os alunos. A tabela de erros está em [GITHUB.md](GITHUB.md), Parte 5.

**Quando o aluno vê a correção.** Quem abrir o app pela primeira vez depois da
publicação já vê o texto novo. Quem já usava o app vê o texto **antigo** na
primeira abertura seguinte, e o novo a partir da segunda. Isso não é defeito: o
app guarda o conteúdo no aparelho para funcionar sem internet, e busca a versão
nova por trás enquanto o aluno estuda.

**O progresso não é afetado.** Corrigir o texto de uma carta não zera nem
embaralha nada: o histórico de revisões está ligado ao id, que não mudou.

---

## 5. Adicionar flashcards novos

Aqui você mexe em **dois** arquivos. Se mexer só num, a publicação é barrada.

### Passo 1 — escolher onde a carta entra

Decida o tema e o subtema. Os ids dos subtemas estão no
`public/data/index.json`, e também aparecem como prefixo dos ids das cartas
(`sca-b1` está no subtema `sca`).

### Passo 2 — inventar um id que não exista

Regra: **o id tem que ser único no app inteiro**, não só no tema. Use o id do
subtema como prefixo e um sufixo que ninguém usou:

```
sca-novo1    sca-novo2    sca-2026a
```

A conferência automática reprova ids repetidos, então não há risco de estragar
nada por engano — só de a publicação parar.

### Passo 3 — acrescentar o texto no arquivo do tema

Abra `public/data/temas/cardio.json` e ache o bloco do subtema (`"sca":{`).
Acrescente a carta nova **no fim do bloco**, antes do `}` que fecha aquele
subtema, com uma vírgula antes:

```json
,"sca-novo1":{"f":"Qual a dose de adrenalina na PCR?","v":"1 mg IV a cada 3-5 minutos.","ex":"Não confundir com a dose da anafilaxia, que é IM."}
```

O `,"ex":…` é opcional.

### Passo 4 — acrescentar o id no índice

Abra `public/data/index.json` e ache o subtema. Ele se parece com isto:

```json
{"id":"sca","nome":"SCA sem Supra (AI/NSTEMI)","p":5,"nb":6,"cards":["sca-b1","sca-b2", … ,"sca-x20"]}
```

Duas alterações:

1. Acrescente o id novo no fim da lista `cards`:
   `… ,"sca-x20","sca-novo1"]`
2. No fim do arquivo inteiro há `"total":10274`. **Some as cartas que você
   acrescentou.** Uma carta nova → `"total":10275`.

| Campo | O que é | Mexer? |
|---|---|---|
| `cards` | a ordem em que as cartas aparecem | sim, acrescentando no fim |
| `total` | o total de cartas do app | sim, sempre |
| `nb` | quantas das primeiras cartas da lista são de "base" (Revisão rápida) | **não** — a menos que a carta nova seja de base, e nesse caso ela tem que entrar **no começo** da lista e o `nb` sobe junto |
| `p` | o peso do subtema no plano de estudos | não |
| `subs` | o total de subtemas | só se você criar um subtema novo |

### Passo 5 — salvar e conferir

Salve os dois arquivos (dois commits estão ótimos) e acompanhe a aba
**Actions**. A conferência avisa em português se algo não bate:

| Erro | Causa |
|---|---|
| `✗ contagem do índice confere → 10275 ≠ 10274` | você esqueceu de mudar o `total` |
| `✗ nenhuma carta sem frente ou verso` | o id entrou no índice, mas o texto não entrou no arquivo do tema |
| `✗ nenhum id de carta repetido` | o id escolhido já existia |
| `✗ data/index.json é JSON válido` | sobrou ou faltou uma vírgula |

Para os alunos, as cartas novas aparecem como **novas** e entram na fila normal
de revisão espaçada. O progresso deles nas cartas antigas não muda.

> Lembrete honesto: os botões "Organizar com IA" e "Publicar" do painel de admin
> **não funcionam no site publicado** — eles dependem de uma ferramenta que só
> existe dentro do claude.ai. Acrescentar cartas pelos arquivos, como acima, é o
> caminho que funciona.

---

## 6. Quando um aluno diz "perdi meu progresso"

### Primeiro: qual é o modo do app

**No modo local (sem Supabase configurado):** o progresso vive só naquele
navegador, numa gaveta chamada `localStorage`. Se o aluno limpou os dados do
site, trocou de celular ou usou uma janela anônima, **o progresso acabou**. Não
existe backup e não há como recuperar. Diga isso com franqueza, e considere que
isso sozinho já é motivo para ligar o Supabase.

**No modo nuvem:** siga a investigação abaixo.

### Passo 1 — confirmar com qual e-mail ele entrou

Este é o motivo de longe mais comum. Painel → **Authentication** → **Users** →
campo de busca → digite o e-mail que ele te passou.

- **Não aparece nada?** Ele nunca criou conta com esse e-mail. Peça o print da
  tela de perfil dentro do app, que mostra o e-mail de verdade. Costuma ser um
  `gmail.com` que virou `gmail.com.br`, ou um ponto a mais.
- **Aparece?** Copie o `id` — é um código longo com traços, tipo
  `3f2a...-...-...`. Você vai usar no passo 2.

### Passo 2 — ver se o progresso está no servidor

Rode, trocando o e-mail:

```sql
select p.email,
       pr.versao,
       pr.atualizado_em,
       case when jsonb_typeof(pr.dados -> 'cards') = 'object'
            then (select count(*) from jsonb_object_keys(pr.dados -> 'cards'))
            else 0
       end as cartas_estudadas
  from public.perfis p
  left join public.progresso pr on pr.user_id = p.id
 where lower(p.email) = lower('aluno@exemplo.com');
```

Como ler a resposta:

| O que aparece | O que significa | O que fazer |
|---|---|---|
| `versao` e `atualizado_em` preenchidos, `cartas_estudadas` > 0 | **O progresso está lá.** | Vá para o passo 3. |
| Tudo vazio (a linha de `progresso` não existe) | O progresso nunca subiu para o servidor. | Vá para o passo 4. |
| `cartas_estudadas` = 0 | Existe a linha, mas está vazia. | Vá para o passo 4. |

### Passo 3 — o progresso está no servidor, mas ele não vê

Peça para o aluno, no aparelho onde falta o progresso:

1. Abrir o app.
2. Ir em **Perfil** → **Sair**.
3. Entrar de novo com o mesmo e-mail e senha.

Ao entrar, o app baixa o progresso do servidor e o **junta** com o que houver no
aparelho — não substitui um pelo outro. Cartas revisadas mais recentemente
ganham; favoritos, listas e troféus dos dois lados são somados.

Se ele estiver com o app instalado na tela de início do celular, peça também
para fechar e abrir o app de novo, para pegar a versão mais nova.

### Passo 4 — o progresso não chegou ao servidor

Causas, da mais comum para a menos:

1. **Ele estudou sem entrar na conta**, ou entrou com outro e-mail. O progresso
   ficou no navegador daquele aparelho.
2. **Ele estudou sem internet** e fechou o app antes de reconectar.
3. **Ele limpou os dados do site** ou desinstalou o navegador.

O que fazer, na ordem:

- **Se ele ainda tem o aparelho antigo com o progresso**, aja antes de qualquer
  outra coisa: peça para ele abrir o app **naquele aparelho** e entrar com o
  e-mail certo. O app junta o que está no aparelho com o que está no servidor e
  manda tudo para cima. Depois disso o progresso aparece nos outros aparelhos.
  **Não peça para ele limpar nada, nem reinstalar, antes disso.**
- **Se o aparelho antigo não existe mais**, o progresso acabou. Não há backup.

### O que não dá para fazer

Dizendo com todas as letras: **não existe histórico de versões do progresso.**
O banco guarda apenas o estado atual de cada aluno. O campo `versao` conta
quantas vezes o progresso foi gravado, mas os valores antigos não ficam
guardados. Se o progresso foi sobrescrito por um estado vazio, não há como
voltar atrás.

Se quiser uma rede de segurança para os alunos mais importantes, dá para copiar
o conteúdo à mão: Table Editor → **progresso** → clique na célula da coluna
`dados` → copie o texto e guarde num arquivo. É manual e não escala, mas
funciona.

---

## 7. Onde ver quantas pessoas estão usando

**Não há contador de visitas.** O app não tem Google Analytics nem nada
parecido, e o GitHub Pages não mostra quantas pessoas abriram o site. Tudo o que
você consegue medir vem do Supabase — ou seja, **só quem criou conta**. Quem
abre a página inicial e vai embora não aparece em lugar nenhum.

Com isso claro, rode:

### O resumo em uma consulta

```sql
select
  (select count(*) from public.perfis)                                              as contas_criadas,
  (select count(*) from public.perfis where visto_em > now() - interval '7 days')    as ativos_7_dias,
  (select count(*) from public.perfis where visto_em > now() - interval '30 days')   as ativos_30_dias,
  (select count(*) from public.perfis where criado_em > now() - interval '30 days')  as novos_30_dias,
  (select count(*) from public.assinaturas
    where ativo = true and fim >= current_date)                                      as assinantes_ativos;
```

`visto_em` é carimbado pelo app toda vez que o aluno entra, então "ativos nos
últimos 7 dias" é uma medida honesta de uso.

### Quantas revisões foram feitas no total

```sql
select count(*)                                as alunos_com_progresso,
       sum(cartas)::bigint                     as cartas_estudadas,
       sum(revisoes)::bigint                   as revisoes_totais
  from (
    select (select count(*) from jsonb_object_keys(dados -> 'cards')) as cartas,
           case when jsonb_typeof(dados -> 'log') = 'object'
                then (select coalesce(sum((e.value ->> 'rev')::numeric), 0)
                        from jsonb_each(dados -> 'log') as e(key, value)
                       where jsonb_typeof(e.value -> 'rev') = 'number')
                else 0
           end                                                          as revisoes
      from public.progresso
     where jsonb_typeof(dados -> 'cards') = 'object'
  ) x;
```

### Quem estudou mais

```sql
select p.email,
       p.nome,
       p.visto_em,
       (select count(*) from jsonb_object_keys(pr.dados -> 'cards')) as cartas_estudadas
  from public.perfis p
  join public.progresso pr on pr.user_id = p.id
 where jsonb_typeof(pr.dados -> 'cards') = 'object'
 order by cartas_estudadas desc
 limit 20;
```

### Sem escrever SQL

Painel → **Table Editor** → tabela **perfis**. O número de linhas é o número de
contas criadas. Clique no cabeçalho da coluna `visto_em` para ordenar e ver quem
entrou por último.

Painel → **Reports** mostra o volume de chamadas ao banco. Serve como
termômetro de movimento, não como contagem de pessoas.

---

## Resumo de uma página

| Tarefa | Onde | Como |
|---|---|---|
| Liberar Premium | Supabase → SQL Editor | `select public.admin_liberar('email','anual',12,'obs');` — se der `apenas administradores`, use o `insert into public.assinaturas` da seção 1.1 |
| Cancelar Premium | Supabase → SQL Editor | `update public.assinaturas set ativo = false where lower(email)=lower('email');` |
| Ver assinantes ativos | Supabase → SQL Editor | seção 2 |
| Tornar alguém admin | Supabase → SQL Editor | `update public.perfis set admin = true, residencia = true where lower(email)=lower('email');` |
| Corrigir uma carta | GitHub → `public/data/temas/<tema>.json` | lápis ✏️ → `Ctrl+F` pelo texto → Commit |
| Adicionar cartas | GitHub → o arquivo do tema **e** `public/data/index.json` | seção 5 — não esqueça o `total` |
| Trocar preços | GitHub → `public/assets/js/app.js`, `const PRECOS` (por trilha) | veja o README |
| Trocar links de pagamento | GitHub → `public/assets/js/config.js`, `CHECKOUT` | veja o README |
| Ver o que quebrou numa publicação | GitHub → aba **Actions** | [GITHUB.md](GITHUB.md), Parte 5 |
