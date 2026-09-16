# Identidade visual — CT Flashcards

Marca: **CT dos Acadêmicos**. Todos os arquivos desta pasta saem do mesmo desenho
vetorial, gerado por `repo/scripts/gen_identidade.py`. **Não edite os PNG/ICO à
mão** — altere o script e regere tudo, senão o ícone, o favicon e a miniatura de
compartilhamento saem de sincronia.

## Ícone do aplicativo (lojas e perfis)

| Arquivo | Tamanho | Formato | Para quê |
|---|---|---|---|
| `app-icon-1024.png` | 1024×1024 | **RGB, sem alfa, canto reto** | App Store, Play Store, e qualquer lugar que peça "a imagem do app". É o arquivo principal. |
| `app-icon-512.png` | 512×512 | RGB, sem alfa, canto reto | Play Store (ícone da ficha) e usos menores |
| `app-icon-1024-arredondado.png` | 1024×1024 | RGBA, canto arredondado | Fora das lojas: site, apresentação, foto de perfil, thumbnail |

**Por que sem canto arredondado e sem transparência:** a App Store **recusa** PNG com
canal alfa, e tanto iOS quanto Android aplicam a própria máscara. Um ícone já
arredondado entregue à loja fica com borda dupla no iPhone. Entregue o quadrado —
o sistema arredonda.

Conferido: a máscara do iOS (canto de 22,37%) não corta **nenhum** pixel do desenho.
Margens de 13,7% a 14,6% em volta da arte. Legível de 1024 px até 60 px.


## Paleta e tipografia

| Uso | Valor |
| --- | --- |
| Fundo navy (padrão do app) | `#0f1b30` |
| Fundo navy escuro (base do OG) | `#0a1628` |
| Azul da marca | `#3d85d8` (hover `#5294e2`) |
| Dourado (destaques / troféus) | `#c9a84c` |
| Branco | `#ffffff` |
| Texto secundário | `rgba(255,255,255,.6)` → `#a3a4ac` sobre o navy |
| Tipografia | Poppins Bold (700) nos títulos, Poppins Medium no apoio |

O texto é convertido em **caminho vetorial** antes de entrar no SVG/PNG. Os
arquivos entregues não dependem do Poppins estar instalado em quem abrir — só a
regeração precisa da fonte.

## Conceito do ícone

Um pequeno baralho de flashcards: carta dourada atrás, carta azul no meio, carta
branca à frente com o monograma **CT** em navy e um traço azul embaixo. Poucas
formas, contraste alto, sem detalhe fino — continua legível a 32×32.

## Arquivos

| Arquivo | Tamanho | Para que serve |
| --- | --- | --- |
| `icone.svg` | vetorial, `viewBox 0 0 512 512` | Ícone mestre. Fonte de tudo o que está abaixo. Cantos arredondados (`rx=104`), fundo navy. |
| `icone-192.png` | 192×192, RGBA | Ícone PWA (`manifest.json`, `purpose: any`). |
| `icone-512.png` | 512×512, RGBA | Ícone PWA em alta (splash do Android, lojas). |
| `icone-maskable-512.png` | 512×512, RGBA | Ícone PWA `purpose: maskable`. Fundo navy sangrando até a borda e arte com ~21% de margem em todos os lados (raio máximo 189 px, dentro da zona segura de 205 px) — o Android pode cortar em círculo, quadrado ou squircle sem comer o desenho. |
| `favicon.ico` | 16, 32 e 48 px no mesmo arquivo | Aba do navegador. Cada resolução é desenhada e rasterizada separadamente: **16 px** usa só o monograma CT branco sobre navy (a carta vira ruído nesse tamanho); **32 e 48 px** usam uma carta branca com o CT em navy e um vinco azul. |
| `apple-touch-icon.png` | 180×180, RGB (**sem transparência**) | Atalho na tela de início do iOS. Cantos retos e fundo navy sólido — o iOS aplica o próprio arredondamento. |
| `og.png` | 1200×630, RGB | Miniatura de compartilhamento (WhatsApp, Telegram, Google, Facebook, LinkedIn). `og:image` / `twitter:image`. |
| `og-quadrado.png` | 1200×1200, RGB | Mesma arte no quadrado, para Instagram e onde o corte é 1:1. |

Composição do OG: fundo navy escuro com brilho azul discreto no topo, o ícone
acima, **CT Flashcards** em Poppins Bold, um filete dourado e a linha de apoio
"10.274 flashcards de Medicina · Estágio e Residência". No rodapé, uma barra fina
com gradiente azul → dourado. Testado na redução para 300 px (tamanho da
miniatura do WhatsApp): título e linha de apoio continuam legíveis.

## Como regerar

```bash
# dependências (uma vez)
pip install cairosvg uharfbuzz fonttools pillow
sudo apt-get install -y fonts-google   # precisa de Poppins-Bold.ttf e Poppins-Medium.ttf

# gera todos os arquivos desta pasta
cd repo && python3 scripts/gen_identidade.py
```

O script escreve `icone.svg` e rasteriza os PNG/ICO a partir dele com cairosvg.
Ele imprime a lista de arquivos e os tamanhos ao final. `README.md` não é tocado.

Onde mexer no script:

- cores da marca: constantes no topo (`NAVY`, `BLUE`, `GOLD`, …);
- desenho do baralho: `arte()`;
- quanto a arte preenche o quadrado: `ART_SCALE_BASE` (ícone normal) e
  `ART_SCALE_MASK` (maskable);
- favicon 16 px e 32/48 px: `svg_favicon_16()` e `svg_favicon_32()`;
- texto e layout das miniaturas: `TITULO`, `SUB` e `svg_og()`.

## Como referenciar no HTML

```html
<link rel="icon" href="/assets/img/favicon.ico" sizes="16x16 32x32 48x48">
<link rel="icon" type="image/svg+xml" href="/assets/img/icone.svg">
<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
<meta property="og:image" content="https://SEU-DOMINIO/assets/img/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
```

E no `manifest.json`:

```json
"icons": [
  { "src": "/assets/img/icone-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
  { "src": "/assets/img/icone-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
  { "src": "/assets/img/icone-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
]
```
