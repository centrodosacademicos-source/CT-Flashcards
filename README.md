# CT Flashcards

App de flashcards de Medicina do **CT dos Acadêmicos**, com revisão espaçada.
São **21 temas**, **246 subtemas** e **10.274 flashcards** — 16 temas abertos na
trilha *CT Estágio* e 5 temas restritos na trilha *CT Residência* (Cirurgia,
Ginecologia e Obstetrícia, Pediatria, Oncologia e Medicina Preventiva).
É um site comum: abre no navegador do celular ou do computador, funciona sem
internet depois da primeira visita e pode ser instalado como aplicativo.

> Os números acima estão em `public/data/index.json` (campos `temas`, `subs` e
> `total`). Sempre que o conteúdo mudar, esse arquivo muda junto.

---

## Começar em 15 minutos

Esta é a sequência mínima do zero até o site no ar. Não pule etapas e não
troque a ordem.

| # | Etapa | Tempo | Onde está o passo a passo |
|---|---|---|---|
| 1 | Criar a conta no GitHub | 3 min | [docs/GITHUB.md](docs/GITHUB.md) — "Parte 1" |
| 2 | Criar o repositório **público** e subir esta pasta | 5 min | [docs/GITHUB.md](docs/GITHUB.md) — "Parte 2" e "Parte 3" |
| 3 | Ligar o GitHub Pages (Settings → Pages → Source: **GitHub Actions**) | 1 min | [docs/GITHUB.md](docs/GITHUB.md) — "Parte 4" |
| 4 | Esperar a publicação na aba **Actions** e abrir o endereço | 3 min | [docs/GITHUB.md](docs/GITHUB.md) — "Parte 5" |
| 5 | Abrir o site e conferir que os temas aparecem | 2 min | — |

Ao fim da etapa 5 o app já está no ar e funcionando. Nesse estado, cada aluno
tem conta e progresso guardados **no navegador dele**: se trocar de celular ou
limpar os dados do site, o progresso não vem junto.

Quando quiser que o progresso siga o aluno entre aparelhos e que o CT Premium
seja liberado por você (e não por um código), faça o passo seguinte:

| # | Etapa | Tempo | Onde está o passo a passo |
|---|---|---|---|
| 6 | Criar o banco de dados no Supabase e colar as 2 chaves no app | 20 min | [docs/SUPABASE.md](docs/SUPABASE.md) |

> Prefere publicar na **Vercel** em vez do GitHub Pages? Dá para fazer, mas
> leia [docs/VERCEL.md](docs/VERCEL.md) antes — sem aquele passo o deploy
> falha com "Command npm run build exited with 1".

Depois que tudo estiver no ar, o dia a dia (liberar Premium, corrigir uma carta,
ver quem está usando) está em **[docs/OPERACAO.md](docs/OPERACAO.md)**.

---

## Mapa das pastas

| Pasta / arquivo | Para que serve |
|---|---|
| `public/` | **É o site.** Tudo o que está aqui dentro vai para o ar, exatamente como está. Cerca de 8,9 MB. |
| `public/index.html` | A página. É **gerada** por `scripts/monta_index.js` — não edite à mão. |
| `public/_markup.html` | O miolo do HTML (telas, botões, formulários), sem cabeçalho. Serve de matéria-prima para o `index.html`. |
| `public/assets/css/app.css` | Toda a aparência do app. Arquivo **gerado**. |
| `public/assets/js/config.js` | **Suas configurações**: chaves do Supabase, links de checkout, contato. Feito para ser editado à mão. |
| `public/assets/js/conteudo.js` | Baixa `data/index.json` na abertura e o arquivo de cada tema só quando o aluno vai estudar aquele tema. |
| `public/assets/js/nuvem.js` | Conversa com o Supabase: login, progresso e assinatura. Sem chaves em `config.js`, não faz nada e o app roda no modo local. |
| `public/assets/js/app.js` | O app inteiro: telas, revisão espaçada, planos, troféus, painel do admin. Arquivo **gerado**. |
| `public/sw.js` | Faz o app abrir sem internet e ser instalável no celular. |
| `public/manifest.webmanifest` | Nome, cores e ícones do app quando instalado no aparelho. |
| `public/data/index.json` | O índice: temas, subtemas, pesos e a lista de **ids** de todas as 10.274 cartas. 206 KB — é o primeiro arquivo que o aluno baixa. |
| `public/data/temas/*.json` | O texto das cartas, um arquivo por tema (8,2 MB somados). Só o tema estudado é baixado. |
| `public/assets/img/` | Ícones, favicon e a miniatura de compartilhamento. Tem um `README.md` próprio explicando cada arquivo. |
| `scripts/` | Programas que **geram** o `public/` a partir das fontes. Não vão para o ar. |
| `supabase/` | Os três arquivos `.sql` do banco: `schema.sql` (cria tudo), `seed.sql` (te torna admin), `testes.sql` (prova que a segurança funciona). |
| `docs/` | Os guias: GitHub, Supabase e operação do dia a dia. |
| `.github/workflows/deploy.yml` | A receita que o GitHub segue sozinho para conferir e publicar o site a cada alteração. |
| `CONTRATO_BANCO.md` | A especificação técnica do banco. Serve de referência para quem for mexer no SQL. |
| `node_modules` | **Não suba isso para o GitHub.** É um atalho para uma pasta de bibliotecas que fica fora do repositório. |

---

## Os comandos

**Ainda não existe um arquivo `package.json` neste repositório.** Por isso os
comandos `npm run build` e `npm test`, citados nos comentários dos scripts,
**ainda não funcionam**. Vou criar esse arquivo. Enquanto ele não existe, use os
comandos `node` diretamente, a partir da pasta `repo/`:

| O que você quer | Comando | O que acontece |
|---|---|---|
| Conferir se o site pode ir ao ar | `node scripts/verifica.js` | Cerca de 40 verificações: arquivos que faltam, JavaScript com erro de digitação, JSON quebrado, carta sem frente ou verso, contagem do índice, id repetido e chave secreta vazada. Termina com `✅ tudo certo, pode publicar` ou `❌ N problema(s)`. **É exatamente o que o GitHub roda antes de publicar.** |
| Reconstruir o `public/` inteiro | `node scripts/build.js` | Roda, em ordem, os cinco passos abaixo e confere o resultado. |
| Só regerar o conteúdo | `node scripts/split_content.js` | Lê o app de arquivo único e reescreve `data/index.json` e `data/temas/*.json`. |
| Só remontar o `index.html` | `node scripts/monta_index.js` | Reescreve `public/index.html` com cabeçalho, miniatura e ordem dos scripts. |
| Testar o app rodando de verdade | `node scripts/e2e_repo.js` | Sobe um servidor local, abre o app num navegador automatizado e testa 40 comportamentos. **Precisa da biblioteca Playwright instalada** — hoje ela não está. |
| Regerar ícones e miniaturas | `python3 scripts/gen_identidade.py` | Ver `public/assets/img/README.md`. Precisa de Python e da fonte Poppins. |

Os outros scripts (`extrai_shell.js`, `adapta_logic.js`, `adapta_auth.js`,
`remendos.js`) são passos internos do `build.js`. Rodar cada um sozinho, fora de
ordem, produz resultado errado.

> **Aviso importante sobre o `build.js`.** Ele não se basta: lê dois arquivos
> que ficam **fora deste repositório** (`flashcards-ct.html` e `logic.js`, na
> pasta acima). Sem esses dois arquivos, o `build.js` para com erro. Veja
> "Limitações", mais abaixo.

---

## Como mudar as coisas mais comuns

### Preço dos planos

A vitrine do CT Premium tem um switch — **CT Estágio** / **CT Residência** —
acima dos preços, porque a CT Residência inclui tudo da CT Estágio mais
Cirurgia, GO, Pediatria e Preventiva, e por isso custa mais. Duração e preço
ficam em lugares separados no arquivo `public/assets/js/app.js`.

A **duração** de cada plano (igual nas duas trilhas) está em `const PLANOS`
(por volta da linha 560):

```js
const PLANOS = [
  {id:'mensal',    nome:'Mensal',    meses:1,  cobranca:'todo mês'},
  {id:'semestral', nome:'Semestral', meses:6,  cobranca:'a cada 6 meses', destaque:1},
  {id:'anual',     nome:'Anual',     meses:12, cobranca:'uma vez por ano'}
];
```

- `meses` é quanto tempo o plano vale — **é esse número que você vai repetir
  quando liberar o Premium no banco**.
- `destaque:1` marca o plano com o selo "Mais escolhido".

O **preço** de cada plano em cada trilha está logo abaixo, em `const PRECOS`:

```js
const PRECOS = {
  estagio: {
    mensal:    {mes:'79,90', total:'79,90',  economia:0},
    semestral: {mes:'49,90', total:'299,40', economia:37},
    anual:     {mes:'39,90', total:'478,80', economia:50}
  },
  residencia: {
    mensal:    {mes:'99,90', total:'99,90',  economia:0},
    semestral: {mes:'69,90', total:'419,40', economia:30},
    anual:     {mes:'59,90', total:'718,80', economia:40}
  }
};
```

- `mes` é o valor por mês que aparece grande na tela.
- `total` é o valor cheio da cobrança (`mes × meses`, arredondado).
- `economia` é a porcentagem de desconto anunciada contra o plano mensal
  **da mesma trilha**. Confira a conta antes de mudar: na CT Residência,
  59,90 é 40% de desconto sobre pagar 99,90 por 12 meses.

Mantenha as aspas e as vírgulas exatamente onde estão, nos dois blocos.

### Links de checkout (Kiwify, Hotmart, Mercado Pago…)

Arquivo: `public/assets/js/config.js`. Como o preço muda por trilha, são
**6 links** — um por plano, em cada trilha. Cole cada um entre as aspas:

```js
CHECKOUT: {
  estagio:    { mensal: '', semestral: '', anual: '' },
  residencia: { mensal: '', semestral: '', anual: '' }
}
```

Enquanto ficarem vazios, o botão de assinar abre um aviso pedindo para o aluno
falar com o CT pelo `@ctdosacademicos`.

### Conteúdo de um flashcard

Arquivo: `public/data/temas/<tema>.json`. O passo a passo completo — como achar
a carta, o que pode e o que não pode escrever, e o que acontece depois de salvar
— está em **[docs/OPERACAO.md](docs/OPERACAO.md)**.

### Senha do administrador

Arquivo: `public/assets/js/app.js`, linha 14. A senha **não** fica escrita ali:
o que fica é o resultado de uma conta matemática feita com ela (um "hash").

```js
const ADMIN_HASH='5489193c50256d4cd97ccbb8b1306c17099e8d2b683aef673e6e0235d17bc566';
```

Para trocar a senha, gere o novo hash no seu computador (troque
`MINHA-NOVA-SENHA` pela senha desejada):

```bash
node -e "console.log(require('crypto').createHash('sha256').update('fcct-admin|'+process.argv[1]).digest('hex'))" MINHA-NOVA-SENHA
```

Cole o resultado no lugar do valor antigo, entre as aspas.

A senha da trilha **CT Residência** funciona igual, na linha 16 (`RES_HASHES`),
só que a palavra da frente é `fcct-rev|` em vez de `fcct-admin|`. São aceitas
duas senhas ao mesmo tempo — a atual e a antiga.

> **Escolha uma senha longa.** Esse hash fica visível para qualquer pessoa que
> abra o código do site. Senha curta ou óbvia é descoberta por tentativa e erro
> em minutos.

### Cartas grátis

Duas coisas controlam o que o aluno vê sem pagar:

| O quê | Onde | Hoje |
|---|---|---|
| Quantas cartas grátis por subtema | `public/assets/js/app.js`, `const FREE_CARDS` (linha 672) | `5` |
| Qual subtema de cada tema é o grátis | `public/data/index.json`, campo `fs` de cada tema | 1 subtema por tema (18 dos 21 temas têm; Geriatria, Dermatologia e Oftalmo/ORL não têm) |

Exemplo: em Cardiologia o `fs` é `sca`, então o aluno grátis estuda as **5
primeiras** cartas de "SCA sem Supra". O resto pede assinatura.

> `FREE_CARDS` foi reduzido de 10 para 5 (decisão do CT, 09/2026) — metade do
> tamanho da amostra grátis por subtema. Para mudar de novo, edite a constante
> em `logic.js` (fonte) e rode `npm run build`; **não** edite `app.js`
> diretamente, ele é sobrescrito a cada build.

### Revisão espaçada (FSRS-5)

Desde 09/2026 o app usa a **FSRS-5** (Free Spaced Repetition Scheduler),
sucessora do SM-2 e o algoritmo padrão do Anki desde 2023 — é o método com
mais evidência publicada para maximizar retenção de longo prazo por minuto de
estudo. Toda a lógica está em `logic.js`, seção `/* ===== SRS (revisão
espaçada) ===== */`, e chega ao app.js sem nenhuma transformação de build (é
lógica pura, sem dependência de servidor).

Como funciona, resumido:

- Cada carta guarda **estabilidade** (`s`, em dias — o intervalo em que a
  chance de lembrar cai para 90%) e **dificuldade** (`d`, de 1 a 10), em vez
  de um "ease factor" solto como no SM-2 clássico.
- A cada resposta (`gradeCard(cs, g)`, onde `g` é 0=Errei · 1=Difícil ·
  2=Bom · 3=Fácil), o algoritmo olha quanto tempo passou desde a última
  revisão (`cs.ts`), calcula a chance atual de lembrar, e recalcula `s` e `d`.
  Cartas erradas voltam em ~1 minuto (dentro da mesma sessão) e não crescem;
  cartas certas ganham um intervalo (`cs.iv`, em dias) cada vez maior,
  proporcional à estabilidade nova.
- Os pesos (`FSRS_W`, 19 números) são os padrão publicados pelo projeto
  open-spaced-repetition — o mesmo ponto de partida do Anki antes de alguém
  rodar a "otimização" pessoal (que precisaria de milhares de revisões por
  aluno pra valer a pena).
- Cartas com progresso salvo pela fórmula antiga (SM-2, de antes de 09/2026)
  migram sozinhas na primeira revisão pós-atualização: o intervalo (`iv`) e a
  "facilidade" (`ef`) antigos viram o ponto de partida de `s`/`d`, em vez de
  reiniciar o histórico do aluno do zero.
- "Vencida" (devida para revisão) é calculado na hora, comparando `cs.due`
  com o relógio (`countsFor`) — não existe um job que precise rodar para
  marcar cartas como vencidas.
- O carimbo de tempo de cada revisão (`cs.ts`) é o mesmo campo que a mistura
  de progresso entre aparelhos (`misturarProgresso`, em `nuvem.js`) já usava
  para decidir qual dos dois estados é mais recente — não precisou de nenhum
  campo novo de sincronia.

Testado em `e2e_repo.js` (smoke test do build) e, com muito mais profundidade
— fórmulas conferidas contra a publicação original, monotonicidade,
migração, cartas vencidas — no app de arquivo único (`e2e_fsrs.js`, fora
deste repositório).

### Atalhos de teclado (desktop)

Em Perfil → Configurações, o aluno pode personalizar as teclas usadas para
estudar: uma para "mostrar resposta" (padrão: barra de espaço) e quatro para
avaliar a carta depois de virada (padrão: 1=Esqueci, 2=Difícil, 3=Bom,
4=Fácil). A lógica mora em `logic.js`, um pouco antes da seção `/* =====
ESTUDO ===== */`.

Pontos importantes:

- Os atalhos **não são sincronizados na nuvem** — ficam salvos só no
  aparelho (`localStorage`, chave `fcct_atalhos_<email>`), porque um teclado
  físico diferente em outro aparelho pode pedir teclas diferentes. É de
  propósito que `misturarProgresso` nunca veja esse campo.
- O mesmo `keydown` listener cuida de duas coisas: capturar uma tecla nova
  (quando o aluno está personalizando) e, durante o estudo, agir como os
  botões de virar/avaliar — sempre ignorando campos de texto, teclas
  repetidas (segurar não avalia várias vezes) e janelas modais abertas por
  cima.

---

### Contato mostrado no app

`public/assets/js/config.js`, campo `CONTATO` (hoje `@ctdosacademicos`).

---

## Limitações — leia antes de contar com alguma coisa

**1. `app.js` e `app.css` são arquivos gerados.**
Se você editar `public/assets/js/app.js` à mão (preço, senha, cartas grátis) e
depois alguém rodar `node scripts/build.js`, **suas edições somem**. As duas
fontes de verdade do build (`flashcards-ct.html` e `logic.js`) ficam fora deste
repositório e não estão versionadas. Enquanto for você editando direto o
`public/`, está tudo bem — só não rode o `build.js`.

**2. O painel de administrador do app não fala com o banco de dados.**
Ele gera o código antigo `CT-AAAAMMDD-XXXXXX`. Esse código só libera o Premium
no **modo local** (sem Supabase configurado). Com o Supabase ligado, quem decide
quem é Premium é o banco (função `minha_assinatura`), e o código gerado no
painel **não libera nada**. Para liberar de verdade, use o painel do Supabase —
está em [docs/OPERACAO.md](docs/OPERACAO.md).

**3. Não existe tela no app que liste os alunos.**
O banco tem a função `admin_alunos()` pronta, mas o app nunca a chama. Para ver
alunos, assinaturas e uso, você vai ao painel do Supabase.

**4. Os botões "Organizar com IA" e "Publicar" do painel do admin não funcionam
no site publicado.** Eles dependem de uma ferramenta que só existe quando o app
é aberto dentro do claude.ai. No GitHub Pages, o botão de IA avisa que está
indisponível. Existe uma função de exportar cartas (`exportarCartas`) escrita no
código, mas **não há botão que a acione** e nada preenche a lista que ela leria.
Na prática, flashcards novos entram editando os arquivos JSON.

**5. O conteúdo é público.**
O site é aberto. Qualquer pessoa que digite `SEU-ENDERECO/data/temas/pediatria.json`
baixa aquele tema inteiro. A senha da trilha CT Residência é uma conveniência de
navegação, **não uma proteção**. Isso vale mesmo com repositório privado, porque
quem publica os arquivos é o site.

**6. Sem Supabase, não existe recuperação de progresso nem de senha.**
No modo local, a conta e o progresso vivem só naquele navegador. Limpou os dados
do site, trocou de celular, perdeu. Não há backup.

**7. Não há contador de visitas.**
O app não tem Google Analytics nem nada parecido. A única medida de uso vem do
Supabase — e só conta quem criou conta.

**8. O conteúdo corrigido demora uma abertura a mais para chegar.**
O `sw.js` guarda os arquivos de conteúdo no aparelho e os serve primeiro,
buscando a versão nova por trás. O aluno que já usa o app vê o texto antigo na
primeira vez que abrir depois da correção, e o novo na vez seguinte.

**9. A publicação não roda quando você mexe só na documentação.**
O `deploy.yml` ignora alterações em arquivos `.md` e nas pastas `docs/` e
`supabase/`. É de propósito. Se precisar publicar mesmo assim, use
Actions → *Publicar no GitHub Pages* → **Run workflow**.

**10. Não existe `.gitignore`.**
Nada impede que arquivos indesejados (como `node_modules`) sejam enviados por
engano. Ao subir os arquivos, deixe o `node_modules` de fora à mão.
