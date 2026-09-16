# Publicar na Vercel (alternativa ao GitHub Pages)

O guia principal (`docs/GITHUB.md`) usa o GitHub Pages, que é de graça e não
precisa de conta em mais nenhum lugar. Se preferir a Vercel mesmo assim
(domínio próprio mais simples de configurar, por exemplo), leia isto primeiro
— tem uma pegadinha.

## Por que o deploy falhava com "Command npm run build exited with 1"

Este repositório tem um `package.json` com um script `build`. Ele existe só
para **você** rodar na sua máquina quando muda o conteúdo (`npm run build`,
explicado em `docs/OPERACAO.md`) — esse comando lê um arquivo gigante
(`flashcards-ct.html`) que fica **fora** desta pasta e nunca é enviado ao
GitHub.

A Vercel, ao ver um `package.json` com script `build`, tenta rodar
`npm install` e depois `npm run build` sozinha. Como o arquivo que o build
precisa não existe no repositório que ela clonou, o script quebra logo no
primeiro passo e a Vercel mostra aquele erro genérico, sem detalhe.

A solução não é "consertar o build" — é dizer para a Vercel **não rodar build
nenhum**. A pasta `public/` já vem pronta, gerada e testada; é exatamente o
que o GitHub Pages também publica sem rodar nada.

## O que já está resolvido (duas camadas, para não depender de configuração)

**1) `vercel.json`**, nesta pasta, instrui a Vercel a pular o `npm install` e o
`npm run build` e publicar `public/` direto:

```json
{
  "buildCommand": null,
  "installCommand": null,
  "outputDirectory": "public"
}
```

**2) `scripts/build.js` agora se protege sozinho.** Mesmo que a Vercel ignore
o `vercel.json` (por exemplo, se o projeto já tinha um **Build Command**
travado manualmente nas configurações do painel, o que tem prioridade sobre o
`vercel.json`) e rode `npm run build` de qualquer jeito, o script agora
percebe que `flashcards-ct.html`/`logic.js` não existem ali, vê que `public/`
já está construído, imprime um aviso e **encerra com sucesso sem tentar
reconstruir nada** — em vez de quebrar com aquele `ENOENT`. Ou seja: o build
não falha mais nessa hospedagem mesmo que a Vercel insista em rodá-lo.

## Passo a passo

1. Garanta que o `vercel.json` e a versão nova de `scripts/build.js` estão no
   repositório que a Vercel usa (suba a pasta atualizada, ou só esses dois
   arquivos, e faça commit).
2. No painel da Vercel, abra o projeto → **Settings → Build & Development
   Settings** e confira se **Build Command** ou **Install Command** têm algum
   valor com o toggle **Override** ligado. Se tiverem, desligue o Override
   (deixa o `vercel.json` decidir) — embora agora, com o passo 2 acima, mesmo
   deixando como está o deploy não deve mais quebrar.
3. **Output Directory**: `public`.
4. Vá em **Deployments** e clique em **Redeploy** (ou apenas faça um novo
   commit — qualquer envio dispara um novo deploy automaticamente).

Depois disso o deploy passa a ser só "copiar os arquivos de `public/` e
publicar", sem nenhum passo que possa quebrar.

## Sobre o aviso amarelo do `engines`

Se aparecer um aviso (não erro) tipo `Detected "engines": { "node": ">=18" }
... will automatically upgrade when a new major Node.js Version is released`,
pode ignorar — é só um aviso da Vercel sobre versão do Node, não é o que
derruba o build.

## Se um dia quiser que a Vercel gere o `public/` sozinha

Isso pediria enviar também o `flashcards-ct.html` (uns 10 MB) dentro deste
repositório, o que não é o que este projeto foi pensado para fazer — ele foi
desenhado para você rodar `npm run build` na sua máquina, conferir o
resultado, e só depois subir o `public/` já pronto. Continue nesse fluxo: é o
mesmo que o GitHub Pages usa e evita subir esse arquivo grande (e o conteúdo
das cartas) para um lugar público sem querer.
