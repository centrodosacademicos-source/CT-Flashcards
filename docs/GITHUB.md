# GitHub, do zero, para quem nunca usou

Guia para pôr o CT Flashcards no ar. Não é preciso saber programar nem instalar
nada: quase tudo é feito pelo site do GitHub, clicando.

Tempo total: cerca de **15 minutos**, mais a espera do DNS se você for usar
domínio próprio.

---

## O que é o GitHub, em três linhas

O GitHub é um lugar na internet onde ficam guardados os arquivos de um projeto,
com histórico de tudo o que mudou. Ele também sabe **publicar** esses arquivos
como um site, de graça — esse serviço se chama **GitHub Pages**. É assim que o
CT Flashcards vai ficar no ar.

Duas palavras que vão aparecer o tempo todo:

- **Repositório** — a pasta do projeto dentro do GitHub.
- **Commit** — cada vez que você salva uma alteração. Fica registrado quem
  mudou, o quê e quando.

---

## Parte 1 — Criar a conta

1. Abra **https://github.com**.
2. Clique em **Sign up** (canto superior direito).
3. Digite o seu e-mail, crie uma senha e escolha um nome de usuário
   (*username*). Sugestão: `ctdosacademicos`.
   > Esse nome vai aparecer no endereço do site
   > (`https://ctdosacademicos.github.io/...`). Escolha com calma: mudar depois
   > quebra o endereço.
4. O GitHub manda um código de 8 dígitos por e-mail. Digite o código.
5. Pronto. Se ele perguntar sobre planos, escolha **Free**.

---

## Parte 2 — Criar o repositório

1. No canto superior direito, clique no **+** e depois em **New repository**.
2. Preencha:

   | Campo | O que colocar |
   |---|---|
   | **Owner** | o seu nome de usuário |
   | **Repository name** | `flashcards-ct` |
   | **Description** | pode deixar vazio |
   | **Public / Private** | **Public** — leia a seção abaixo antes |
   | **Add a README file** | **deixe desmarcado** |
   | **Add .gitignore** | **None** |
   | **Choose a license** | **None** |

   > Deixar essas três últimas opções vazias evita um conflito na hora de subir
   > os arquivos. Você já tem um `README.md` pronto na pasta do projeto.

3. Clique em **Create repository**.

### Público ou privado — decida sabendo o que está decidindo

**O GitHub Pages de graça só funciona em repositório público.** Publicar a
partir de um repositório privado exige um plano pago (GitHub Pro ou Team).

Repositório **público** significa que qualquer pessoa na internet pode ler todos
os arquivos: o código, o histórico de alterações e — o que mais importa aqui —
**o conteúdo dos 10.274 flashcards**, que está em `public/data/temas/*.json`.

E é preciso dizer com todas as letras: **mesmo que o repositório fosse privado,
o conteúdo continuaria exposto.** O site publicado é aberto, e os arquivos de
conteúdo são baixáveis pelo endereço direto. Quem digitar

```
https://SEU-ENDERECO/data/temas/pediatria.json
```

no navegador baixa a Pediatria inteira, com as 1.223 cartas, sem precisar de
conta, de senha ou de assinatura. A senha da trilha *CT Residência* e o limite
de 10 cartas grátis servem para organizar a experiência de quem usa o app —
**não são proteção contra cópia**.

Consequências práticas:

| Se você aceita isso | Se não aceita |
|---|---|
| Repositório **público** + GitHub Pages grátis. É o caminho deste guia. | Você precisará de outro tipo de hospedagem, com o conteúdo servido só para quem está logado. Isso é outro projeto: o app de hoje não foi feito assim. |

Duas regras que valem em qualquer caso:

- **Nunca** coloque a `service_role key` do Supabase em nenhum arquivo. A
  verificação automática barra a publicação se ela aparecer, mas não confie
  nisso como única defesa.
- A `anon key` do Supabase **pode** ficar no site. Ela é feita para isso. Quem
  protege os dados é a segurança do banco (RLS). Está explicado em
  [SUPABASE.md](SUPABASE.md).

---

## Parte 3 — Subir os arquivos pela primeira vez

Dois caminhos. Escolha um.

### Caminho A — pelo site, arrastando (sem instalar nada)

1. Na página do repositório recém-criado, clique no link
   **uploading an existing file** (está no meio da tela).
   Se você não vir esse link, use **Add file → Upload files**.
2. Abra a pasta `repo` no seu computador.
3. Selecione **o conteúdo** da pasta — as pastas `public`, `scripts`, `supabase`,
   `docs` e os arquivos `README.md` e `CONTRATO_BANCO.md` — e arraste tudo para
   a área tracejada do navegador.
   > **Não arraste a pasta `repo` inteira**, e **não inclua o `node_modules`**.
   > O `node_modules` é um atalho para bibliotecas que não têm nada a ver com o
   > site.
4. Espere as barrinhas de progresso terminarem. São cerca de 60 arquivos, 9 MB.
   O GitHub aceita até 100 arquivos por vez pelo navegador, então cabe numa
   viagem só.
5. Em **Commit changes**, escreva `primeira versão` e clique em
   **Commit changes**.

**Falta um arquivo, e é o mais importante.** O arrastar não leva a pasta
`.github` — o ponto no começo do nome faz o computador escondê-la. Sem ela, o
site nunca é publicado. Crie o arquivo à mão:

1. Na página do repositório, clique em **Add file → Create new file**.
2. No campo do nome, digite exatamente:

   ```
   .github/workflows/deploy.yml
   ```

   > Ao digitar cada `/`, o GitHub cria a pasta sozinho. Você vai ver o caminho
   > se transformando em caixinhas.
3. Abra o arquivo `.github/workflows/deploy.yml` da sua pasta num editor de
   texto (Bloco de Notas, TextEdit), selecione tudo (`Ctrl+A` / `Cmd+A`), copie
   e cole no campo grande do GitHub.
4. Clique em **Commit changes** → **Commit changes**.

Confira: na página do repositório devem aparecer as pastas `.github`, `docs`,
`public`, `scripts`, `supabase`.

### Caminho B — com o git, pela linha de comando

Para quem preferir. Instale o git em **https://git-scm.com/downloads** e rode,
dentro da pasta `repo`:

```bash
git init
git add .
git commit -m "primeira versão"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/flashcards-ct.git
git push -u origin main
```

Troque `SEU-USUARIO` pelo seu nome de usuário. Duas observações:

- Quando o git pedir a senha, ele **não** aceita a senha da sua conta. Ele quer
  um *Personal Access Token*: GitHub → foto do perfil → **Settings** →
  **Developer settings** → **Personal access tokens** → **Tokens (classic)** →
  **Generate new token**, marcando a permissão `repo`. Copie o token e use no
  lugar da senha.
- O `node_modules` vai junto se você não tirar. Apague o atalho antes do
  `git add .`, ou crie um arquivo `.gitignore` com uma linha escrita
  `node_modules`.

---

## Parte 4 — Ligar o GitHub Pages

1. Na página do repositório, clique em **Settings** (a engrenagem, na barra de
   cima — não confundir com o Settings da sua conta).
2. Na coluna da esquerda, clique em **Pages**.
3. Em **Build and deployment**, no campo **Source**, troque de
   *Deploy from a branch* para **GitHub Actions**.

É só isso — não há botão de salvar nessa tela; a escolha vale na hora.

> Se você deixar em *Deploy from a branch*, a publicação falha com uma mensagem
> sobre "Pages site failed". É o erro mais comum de todos.

---

## Parte 5 — Ver a publicação acontecendo

1. Volte para a página do repositório e clique na aba **Actions**.
2. Você vai ver uma linha chamada **Publicar no GitHub Pages** com um círculo
   **amarelo girando**. Clique nela.
3. Dentro, há duas etapas, nesta ordem:

   | Etapa | O que faz |
   |---|---|
   | **Conferir antes de publicar** | roda `scripts/verifica.js` — cerca de 40 conferências no site |
   | **Publicar** | só começa se a primeira passar; envia o `public/` para o ar |

4. Quando as duas ficarem com **✓ verde**, está no ar. O endereço aparece em
   **Settings → Pages**, no alto, em letras grandes. Costuma ser
   `https://SEU-USUARIO.github.io/flashcards-ct/`.
5. Abra o endereço. A tela inicial deve mostrar **10274 flashcards · 21 temas ·
   246 subtemas** e a lista dos temas abertos.

Isso vale para todas as próximas vezes: **toda alteração enviada publica o site
sozinha**, em 2 a 4 minutos.

> **Exceção:** alterações só em arquivos `.md` ou nas pastas `docs/` e
> `supabase/` **não** publicam nada, de propósito — elas não mudam o site. Se
> você quiser publicar mesmo assim, vá em Actions → **Publicar no GitHub Pages**
> (na coluna da esquerda) → botão **Run workflow** → **Run workflow**.

### Quando aparece o X vermelho

Um **✗ vermelho** significa que alguma coisa foi barrada. A boa notícia: **o
site antigo continua no ar, intacto**. A etapa "Publicar" só roda se a
conferência passar, então um erro nunca chega aos alunos.

Para ver o que houve:

1. Aba **Actions** → clique na execução com o ✗.
2. Clique na etapa que falhou (a que tem o ✗).
3. Clique na linha **Conferir os arquivos publicados** para abrir o texto.
4. Procure as linhas que começam com **✗**. Elas dizem o problema em português.

| Linha que apareceu | O que aconteceu | O que fazer |
|---|---|---|
| `✗ existe assets/js/app.js` (ou outro arquivo) | o arquivo não subiu | envie o arquivo que falta (Add file → Upload files) |
| `✗ sintaxe de app.js` | erro de digitação no JavaScript — vírgula, aspas ou chave faltando | abra o arquivo e desfaça a última edição |
| `✗ data/index.json é JSON válido` | vírgula ou aspas erradas no índice | desfaça a última edição no `index.json` |
| `✗ contagem do índice confere → 10275 ≠ 10274` | você adicionou carta e esqueceu de mudar o `total` | corrija o campo `total` no `index.json` |
| `✗ nenhum id de carta repetido` | duas cartas com o mesmo id | troque o id da carta nova |
| `✗ nenhuma carta sem frente ou verso` | o id está no índice mas o texto não está no arquivo do tema | acrescente o texto, ou tire o id do índice |
| `✗ nenhuma chave secreta publicada` | a `service_role key` do Supabase entrou em algum arquivo | apague-a imediatamente e gere uma nova no painel do Supabase |
| `Get Pages site failed` / erro na etapa **Publicar** | o Pages não está em *GitHub Actions* | refaça a Parte 4 |

Depois de corrigir, o envio da correção já dispara uma publicação nova. Se
quiser apenas tentar de novo sem mudar nada, abra a execução e clique em
**Re-run all jobs**.

---

## Parte 6 — Domínio próprio

Exemplo: `flashcards.ctdosacademicos.com.br`. São três coisas, nesta ordem.

### 6.1 O arquivo CNAME

O GitHub precisa de um arquivo chamado `CNAME`, sem extensão, dentro da pasta
que vai para o ar — que aqui é a `public/`.

1. No repositório, clique em **Add file → Create new file**.
2. No nome, digite exatamente:

   ```
   public/CNAME
   ```

3. No campo grande, escreva **só o endereço**, numa linha:

   ```
   flashcards.ctdosacademicos.com.br
   ```

   Sem `https://`, sem `www`, sem barra no fim, sem linha em branco extra.
4. **Commit changes**.

### 6.2 Os registros de DNS

Isso é feito no site onde você comprou o domínio (Registro.br, GoDaddy,
Cloudflare, Hostinger…), na tela que costuma se chamar **Zona DNS**,
**Gerenciar DNS** ou **DNS Records**.

**Se for um subdomínio** (`flashcards.ctdosacademicos.com.br`) — recomendado:

| Campo | Valor |
|---|---|
| Tipo | `CNAME` |
| Nome / Host | `flashcards` |
| Valor / Destino | `SEU-USUARIO.github.io` |
| TTL | deixe o padrão |

**Se for o domínio raiz** (`ctdosacademicos.com.br`, sem nada na frente), não dá
para usar CNAME. Crie **quatro** registros do tipo `A`, todos com o nome `@`:

| Tipo | Nome | Valor |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

### 6.3 Avisar o GitHub e esperar

1. Repositório → **Settings** → **Pages**.
2. Em **Custom domain**, digite `flashcards.ctdosacademicos.com.br` e clique em
   **Save**.
3. Aparece **DNS check in progress**. Essa é a hora de esperar.

**Quanto tempo demora.** Normalmente de 10 minutos a 1 hora. Pode chegar a 24
horas, e em casos raros 48 — depende de quanto tempo o seu provedor guarda a
resposta antiga. Não adianta mexer nos registros a cada 5 minutos: cada mudança
reinicia a contagem. Confira, espere, confira de novo no dia seguinte.

4. Quando a verificação passar (✓ verde), marque **Enforce HTTPS**. Se a caixa
   estiver acinzentada, é porque o certificado de segurança ainda está sendo
   emitido — leva até 24 horas. Volte depois e marque.

**Depois que o domínio estiver funcionando**, se você já tiver ligado o
Supabase, atualize lá: painel do Supabase → **Authentication** →
**URL Configuration** → coloque o novo endereço em **Site URL** e em
**Redirect URLs**. Sem isso, o link de confirmação de e-mail e o de recuperar
senha jogam o aluno na página errada.

---

## Parte 7 — Editar um arquivo depois, pelo site

Este é o caminho do dia a dia. Não precisa instalar nada.

1. Na página do repositório, clique nas pastas até chegar no arquivo
   (por exemplo: `public` → `assets` → `js` → `config.js`).
2. Clique no ícone de **lápis** ✏️, no alto à direita do arquivo
   (*Edit this file*).
3. Faça a alteração.
4. Role até o fim e clique no botão verde **Commit changes**.
5. Na janela que abre:
   - em **Commit message**, escreva o que você mudou, em português mesmo
     ("corrigi a dose de adrenalina");
   - deixe marcado **Commit directly to the `main` branch**;
   - clique em **Commit changes**.
6. Vá na aba **Actions** e acompanhe a publicação. Em 2 a 4 minutos o site está
   atualizado.

### Dois avisos sobre editar arquivos grandes

**Os arquivos de conteúdo são uma linha só.** Cada `public/data/temas/*.json`
tem todo o tema numa única linha imensa, sem quebras. Para achar o que você
quer dentro do editor do GitHub, clique dentro do texto e aperte `Ctrl+F`
(`Cmd+F` no Mac) — o editor tem busca própria.

**O `pediatria.json` pode não abrir.** Ele tem 1,2 MB, e o editor do GitHub
costuma se recusar a abrir arquivos acima de 1 MB, mostrando algo como *"this
file is too large to edit"*. Quando isso acontecer, use o editor completo, que
também roda no navegador:

1. Vá para a página inicial do repositório.
2. Aperte a tecla **`.`** (ponto final) do teclado.
3. Abre um editor de código completo dentro do navegador (é o VS Code). Ache o
   arquivo na coluna da esquerda, edite, e use o ícone de ramificação na lateral
   esquerda para escrever a mensagem e clicar em **Commit & Push**.

### Como desfazer uma alteração errada

1. Aba **Commits** (ou clique no relógio com o número de commits, na página do
   repositório).
2. Clique no commit que você quer desfazer.
3. Botão **Revert** no alto à direita → **Create pull request** →
   **Merge pull request**.

Isso cria uma alteração nova que desfaz a anterior. O histórico fica todo
registrado, e a publicação acontece sozinha em seguida.
