# Ligando o Flashcards CT ao Supabase

Guia passo a passo para quem **nunca** mexeu com banco de dados.
Não é preciso saber programar. É copiar, colar e clicar.

Tempo total: cerca de **20 minutos**, sendo que uns 3 são só esperando.

---

## Antes de começar: o que é isso tudo?

Três palavras que vão aparecer o tempo todo. Vale ler, são 30 segundos.

**Banco de dados** — é a "gaveta" onde ficam guardados os seus alunos e o
progresso de estudo de cada um. Hoje o app guarda tudo no navegador do
aluno: se ele troca de celular, perde tudo. Com o banco, o progresso fica
guardado na internet e o aluno entra de qualquer aparelho.

**Supabase** — é a empresa que hospeda esse banco para você, de graça no
começo. É como o Google Drive, só que para dados de aplicativo em vez de
arquivos. Você vai criar uma conta lá.

**SQL** — é o idioma que se usa para conversar com o banco. Você **não
precisa aprender**. Os arquivos `.sql` desta pasta já estão prontos: seu
trabalho é copiar o conteúdo deles e colar num campo de texto do site do
Supabase.

E o mais importante:

**RLS (segurança por linha)** — é a tranca do banco. Sem ela, qualquer
aluno esperto conseguiria baixar os dados de todos os outros. Com ela
ligada, o banco checa, linha por linha, se aquela pessoa tem direito de
ver aquele dado. Os arquivos desta pasta já configuram tudo isso, e há um
arquivo de teste que **prova** que a tranca está funcionando.

---

## Parte 1 — Criar a conta no Supabase

1. Abra **https://supabase.com** no navegador.
2. Clique no botão **Start your project** (canto superior direito).
3. Faça login. Duas opções:
   - **Continue with GitHub** — se você já tem conta no GitHub, é o
     caminho mais rápido.
   - **Sign up with email** — cria uma conta nova com o seu e-mail.
     O Supabase manda um e-mail de confirmação; abra e clique no link.
4. Pronto, você está no painel. Ele vai perguntar o nome da sua
   **organização** (*organization*). Pode escrever `CT dos Acadêmicos`.
   Quando perguntar o tipo/plano, escolha **Free** (grátis).

---

## Parte 2 — Criar o projeto (o banco em si)

1. Clique em **New project**.
2. Preencha:

   | Campo | O que colocar |
   |---|---|
   | **Name** | `flashcards-ct` |
   | **Database Password** | clique em **Generate a password** |
   | **Region** | `South America (São Paulo)` |
   | **Pricing Plan** | `Free` |

3. **ATENÇÃO NA SENHA.** Clique em **Copy** e cole essa senha num lugar
   seguro (gerenciador de senhas, ou um papel na gaveta). Ela é a senha
   mestra do banco. Você provavelmente nunca vai precisar dela, mas se
   precisar e tiver perdido, só dá para gerar outra.
4. Clique em **Create new project**.
5. **Espere de 2 a 3 minutos.** A tela mostra "Setting up project" com uma
   barrinha. Não feche. Quando terminar, você cai no painel do projeto.

---

## Parte 3 — Criar as tabelas (rodar o `schema.sql`)

Aqui é onde o banco ganha forma: tabelas de alunos, de progresso, de
assinaturas, e todas as regras de segurança.

1. Na **coluna da esquerda**, procure o ícone do **SQL Editor**
   (parece uma folha de papel com `SQL` escrito). Clique nele.
2. Clique em **+ New query** (ou "New SQL snippet").
3. Abra o arquivo `supabase/schema.sql` deste projeto num editor de texto
   qualquer (Bloco de Notas, TextEdit, VS Code).
4. Selecione **tudo** (`Ctrl+A` no Windows / `Cmd+A` no Mac) e copie
   (`Ctrl+C` / `Cmd+C`).
5. Clique dentro do campo preto do SQL Editor e cole (`Ctrl+V` / `Cmd+V`).
6. Clique no botão verde **Run** (canto inferior direito), ou aperte
   `Ctrl+Enter` / `Cmd+Enter`.

**Como saber se deu certo:** aparece em baixo, em verde,
**"Success. No rows returned"**.

> É isso mesmo — "no rows returned" (nenhuma linha devolvida) é o
> resultado **certo** aqui. Este arquivo não faz perguntas ao banco, ele
> dá ordens. Quem dá ordem não recebe resposta em forma de tabela.

**Se aparecer erro em vermelho:** o mais provável é que você tenha colado
só um pedaço do arquivo. Apague tudo do campo e refaça os passos 4 a 6
com atenção ao `Ctrl+A` (selecionar tudo).

> **Pode rodar de novo?** Pode, quantas vezes quiser, sem medo. O arquivo
> foi escrito para não apagar nada e não dar erro se rodado duas vezes.
> Se um dia o app for atualizado e o `schema.sql` mudar, é só colar o
> arquivo novo inteiro e rodar de novo.

### Conferindo com os próprios olhos

1. Na coluna da esquerda, clique em **Table Editor** (ícone de tabela).
2. Você deve ver três tabelas listadas: **perfis**, **progresso** e
   **assinaturas**. Estão vazias — normal, ninguém se cadastrou ainda.
3. Repare que ao lado do nome de cada uma aparece um cadeado ou a
   etiqueta **RLS enabled**. É a tranca ligada. Se em alguma delas
   aparecer **RLS disabled** em vermelho, rode o `schema.sql` de novo.

---

## Parte 4 — Ligar o login por e-mail

O app precisa que as pessoas consigam criar conta e entrar.

1. Coluna da esquerda → **Authentication** (ícone de pessoa).
2. No submenu, clique em **Sign In / Providers** (em painéis mais antigos
   o nome é só **Providers**).
3. Na lista, ache **Email** e clique. A chavinha **Enable Sign in with
   Email** tem que estar **ligada** (verde). Normalmente já vem ligada.
4. Ali dentro há a opção **Confirm email**:
   - **Ligada** (recomendado no fim): o aluno recebe um e-mail e precisa
     clicar no link antes de conseguir entrar. Mais seguro.
   - **Desligada**: o aluno entra na hora.

   > **Dica prática:** deixe **desligada enquanto você estiver testando**,
   > para não ficar esperando e-mail a cada teste. O plano grátis do
   > Supabase só manda pouquíssimos e-mails por hora e trava fácil.
   > Ligue de volta quando for abrir para os alunos de verdade.
5. Clique em **Save** se mudou alguma coisa.

### Dizendo ao Supabase qual é o endereço do seu site

1. Ainda em **Authentication**, clique em **URL Configuration**.
2. Em **Site URL**, coloque o endereço onde o app fica no ar
   (por exemplo `https://flashcards.ctdosacademicos.com.br`).
   Se ainda estiver testando no seu computador, use `http://localhost:3000`
   (ou a porta que você usa).
3. Em **Redirect URLs**, clique em **Add URL** e coloque o mesmo endereço.
4. **Save**.

> Sem isso, o link de confirmação do e-mail joga o aluno na página errada.

---

## Parte 5 — As duas chaves (a parte mais importante)

O app precisa de duas informações para achar o seu banco. Elas ficam no
mesmo lugar.

### Onde encontrar

1. No **canto inferior esquerdo**, clique na **engrenagem** ⚙️
   (**Project Settings**).
2. No menu que abre, clique em **API**.
   (Em painéis mais novos pode estar dividido em **Data API** e
   **API Keys** — as informações são as mesmas, só separadas em duas telas.)

Nessa tela você acha:

**1. Project URL** — algo como
`https://abcdefghijklmno.supabase.co`
É o endereço do seu banco. Clique no ícone de copiar ao lado.

**2. A chave pública** — na lista **Project API keys**, a linha marcada
como **`anon`** / **`public`**. É um texto enorme, começando com
`eyJhbGciOi...`.

> Se o seu painel for do modelo novo, essa mesma chave pode aparecer com
> o nome **Publishable key**, começando com `sb_publishable_...`.
> É a mesma coisa: é a chave pública. Use a que o seu painel mostrar.

**3. A chave secreta** — na mesma lista, a linha **`service_role`** /
**`secret`** (ou **Secret key**, `sb_secret_...`). Ela vem escondida atrás
de um botão **Reveal** ou de um ícone de olho.
**Você não vai precisar dela agora. Nem olhe.**

### Qual vai para o site e qual não vai — leia com atenção

| | pode ficar no site? | por quê |
|---|---|---|
| **Project URL** | ✅ **sim** | é só um endereço, como o link de um site |
| **anon key** (pública) | ✅ **sim** | ela sozinha não abre nada: quem decide o que essa pessoa pode ver é a **RLS**, que já está ligada |
| **service_role key** (secreta) | ❌ **NUNCA** | ela **passa por cima da RLS** e enxerga o banco inteiro |

Sobre a **anon key**: é normal e esperado que ela apareça no código do
site, visível para qualquer um que abra o "ver código-fonte" do navegador.
Ela é feita para isso. Ela não é uma senha — é mais como o número da
recepção do prédio: qualquer um pode ligar, mas só entra no apartamento
quem o porteiro (a RLS) autorizar. **É por isso que a Parte 6, o teste da
tranca, não é opcional.**

Sobre a **service_role key**: ela é a chave-mestra do prédio. Se ela
vazar, a pessoa lê, altera e apaga tudo — dados de todos os alunos,
assinaturas, tudo. Regras:

- ❌ nunca cole ela no código do app;
- ❌ nunca mande por WhatsApp, e-mail ou print de tela;
- ❌ nunca coloque num repositório do GitHub;
- ✅ ela pode ficar apenas dentro do painel do Supabase, onde já está.

Se um dia você desconfiar que ela vazou, volte nessa mesma tela e use
**Reset / Generate new key** para invalidar a antiga.

### Colocando as duas no app

Abra o arquivo de configuração do app — é onde existem duas linhas
parecidas com estas, provavelmente com um valor de exemplo ou vazias:

```js
const SUPABASE_URL      = "https://SEU-PROJETO.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

Substitua os dois valores pelo **Project URL** e pela **anon key** que
você acabou de copiar, mantendo as aspas. Salve o arquivo e publique o
site como você já faz normalmente.

---

## Parte 6 — Testar se a tranca está mesmo trancada

Esta parte é rápida e é a que dá tranquilidade. O arquivo
`supabase/testes.sql` cria três alunos de mentira e tenta fazer, na marra,
tudo o que um aluno mal-intencionado tentaria: ler o progresso do colega,
virar administrador, liberar o Premium de graça. Se a tranca estiver boa,
todas as tentativas fracassam.

1. Volte ao **SQL Editor** → **+ New query**.
2. Copie **todo** o conteúdo de `supabase/testes.sql` e cole.
3. Clique em **Run**.
4. Olhe a área de mensagens embaixo do editor. Se houver uma aba
   **Messages** ou **Logs**, clique nela. Você vai ver uma lista assim:

```
[PASSOU] aluno NÃO lê o progresso de outro aluno
[PASSOU] aluno NÃO consegue se promover a admin
[PASSOU] aluno NÃO consegue se dar acesso à Residência
[PASSOU] aluno NÃO cria assinatura para si mesmo (barrado pela RLS)
...
=====================================================
TUDO CERTO — 47 testes, nenhuma falha.
=====================================================
```

**O que você precisa ver: `TUDO CERTO` e nenhum `FALHOU`.**

Se aparecer qualquer `FALHOU`, **não abra o app para os alunos**. Rode o
`supabase/schema.sql` de novo (Parte 3) e repita este teste.

> **Esse teste bagunça meus dados?** Não. A última linha do arquivo é um
> `rollback`, que desfaz tudo. Os alunos de mentira somem sozinhos e nada
> do que você já tinha é tocado. Pode rodar quantas vezes quiser.

---

## Parte 7 — Criar a sua conta e virar administrador

Agora, na ordem certa:

1. **Abra o app** (o site) e **cadastre-se normalmente**, com o seu
   e-mail de verdade — o mesmo que está no `seed.sql`
   (`centrodosacademicos@gmail.com`). Se você ligou o "Confirm email",
   confirme pelo e-mail que chegou.
2. **Confira que o cadastro chegou no banco:** painel → **Authentication**
   → **Users**. O seu e-mail tem que estar na lista.
3. **Confira que o perfil foi criado sozinho:** painel → **Table Editor**
   → tabela **perfis**. Tem que haver uma linha com o seu e-mail. Repare
   que a coluna `admin` está `false` — vamos mudar isso agora.
4. Volte ao **SQL Editor** → **+ New query**, cole **todo** o conteúdo de
   `supabase/seed.sql` e clique em **Run**.

   > Se o seu e-mail for outro, abra o `seed.sql` antes e troque o e-mail
   > na única linha marcada com setas `↓↓↓`. É a única coisa que se mexe
   > nesse arquivo.

5. O resultado mostra uma tabelinha com o seu e-mail e `admin = true`.
   Nas mensagens aparece **"PRONTO! A conta ... agora e ADMINISTRADORA."**
6. Volte ao app e **recarregue a página** (`F5`). O menu de administração
   deve aparecer.

> Se der **"NADA FOI ALTERADO"**, é porque o e-mail do `seed.sql` não bate
> com o e-mail do cadastro. Confira letra por letra e rode de novo.

---

## Parte 8 — Conferência final

Faça este teste de mesa. Leva 2 minutos e prova que tudo funciona de
verdade:

1. No app, estude **umas 5 cartas** e responda.
2. Painel → **Table Editor** → tabela **progresso**. Tem que existir uma
   linha com o seu usuário. Clique na célula da coluna `dados`: aparece
   um monte de texto com `cards`, `log`, etc. **Isso é o seu estudo,
   salvo na nuvem.** Repare também na coluna `versao` — ela sobe sozinha
   a cada gravação.
3. Feche o navegador, abra numa **janela anônima**, entre com a sua conta.
   O progresso tem que estar lá.
4. No app, na tela de administração, use a função de liberar Premium para
   um e-mail de teste. Depois confira em **Table Editor** → **assinaturas**
   que a linha apareceu, com `ativo = true` e a data em `fim` certa.

Se os quatro passos deram certo, está tudo no ar e funcionando.

---

## Liberando o CT Premium no dia a dia

Quando alguém comprar, você tem dois caminhos.

**Pelo app:** use a tela de administração (é para isso que ela existe).

**Pelo painel do Supabase**, se preferir: SQL Editor → New query → cole a
linha abaixo trocando o e-mail, o plano e o número de meses:

```sql
select public.admin_liberar('aluno@exemplo.com', 'anual', 12, 'Kiwify #1234');
```

- Planos aceitos: `'mensal'`, `'semestral'`, `'anual'`.
- O número (`12`) é a quantidade de **meses** de validade a partir de hoje.
- O último texto é uma anotação livre, para você lembrar de onde veio a
  compra.

> **Funciona mesmo se a pessoa ainda não tem conta!** A assinatura fica
> guardada pelo e-mail e "gruda" sozinha no aluno assim que ele se
> cadastrar. Não precisa fazer mais nada.

**Cancelar uma assinatura** (sem apagar o histórico da compra):

```sql
update public.assinaturas set ativo = false
 where lower(email) = lower('aluno@exemplo.com');
```

**Ver a lista de todos os alunos**, com plano, cartas estudadas e revisões:

```sql
select * from public.admin_alunos();
```

Há mais receitas prontas, todas comentadas, no fim do arquivo
`supabase/seed.sql`.

---

## Se algo der errado

| O que aparece | O que está acontecendo | O que fazer |
|---|---|---|
| `relation "public.perfis" does not exist` | o `schema.sql` não rodou | refaça a Parte 3 |
| `permission denied for table ...` | falta rodar o `schema.sql` completo | refaça a Parte 3 (cole o arquivo **inteiro**) |
| `new row violates row-level security policy` | a tranca funcionando: alguém tentou fazer algo que não pode | se foi você testando, é o comportamento correto |
| `apenas administradores` | a conta usada não é admin | refaça a Parte 7 |
| O app diz que ninguém está logado | a `anon key` ou a URL estão erradas no app | refaça a Parte 5, copiando de novo com o botão de copiar |
| O aluno se cadastra mas não aparece em `perfis` | o gatilho de criação de perfil não foi criado | rode o `schema.sql` de novo (Parte 3) |
| Não chega o e-mail de confirmação | limite do plano grátis | desligue o "Confirm email" (Parte 4) enquanto testa |
| Algum `FALHOU` no `testes.sql` | a segurança não está completa | **não abra o app**; rode o `schema.sql` e teste de novo |

---

## Resumo de uma página

1. Criar conta no Supabase e um projeto na região de São Paulo.
   Guardar a senha do banco.
2. SQL Editor → colar `supabase/schema.sql` → **Run**.
3. Authentication → Providers → **Email** ligado; URL Configuration com o
   endereço do site.
4. Project Settings → API → copiar **Project URL** e **anon key** para o
   app. **Nunca** copiar a `service_role key`.
5. SQL Editor → colar `supabase/testes.sql` → **Run** → tem que dar
   **TUDO CERTO**.
6. Cadastrar-se no app → SQL Editor → colar `supabase/seed.sql` → **Run**
   → recarregar o app.

E a frase para não esquecer nunca:

> **A `anon key` pode ficar pública no site — é a RLS que protege.
> A `service_role key` nunca sai do painel do Supabase.**
