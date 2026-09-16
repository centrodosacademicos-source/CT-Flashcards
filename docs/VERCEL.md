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

## O que já está resolvido

O arquivo `vercel.json`, nesta pasta, já instrui a Vercel a pular o
`npm install` e o `npm run build` e publicar `public/` direto:

```json
{
  "buildCommand": null,
  "installCommand": null,
  "outputDirectory": "public"
}
```

## Passo a passo

1. Garanta que este `vercel.json` está no repositório que a Vercel usa (se
   você já tinha subido a pasta antes desse arquivo existir, suba de novo ou
   só adicione este arquivo e faça commit).
2. No painel da Vercel, abra o projeto → **Settings → Build & Development
   Settings** e confira que **Build Command** e **Install Command** aparecem
   como "Not required" / desativados (o `vercel.json` faz isso sozinho; só
   confira se alguém não ativou um valor manual por cima).
3. **Output Directory**: `public`.
4. Vá em **Deployments** e clique em **Redeploy** (ou apenas faça um novo
   commit — qualquer envio dispara um novo deploy automaticamente).

Depois disso o deploy passa a ser só "copiar os arquivos de `public/` e
publicar", sem nenhum passo que possa quebrar.

## Se um dia quiser que a Vercel gere o `public/` sozinha

Isso pediria enviar também o `flashcards-ct.html` (uns 10 MB) dentro deste
repositório, o que não é o que este projeto foi pensado para fazer — ele foi
desenhado para você rodar `npm run build` na sua máquina, conferir o
resultado, e só depois subir o `public/` já pronto. Continue nesse fluxo: é o
mesmo que o GitHub Pages usa e evita subir esse arquivo grande (e o conteúdo
das cartas) para um lugar público sem querer.
