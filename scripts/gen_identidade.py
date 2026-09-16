#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera a identidade visual do app "CT Flashcards" (CT dos Academicos).

Fonte unica da verdade: este script. Ele escreve o SVG mestre (icone.svg) e
rasteriza TODOS os PNG/ICO a partir do mesmo desenho vetorial, para que icone,
favicon, PWA e open graph fiquem coerentes.

Uso:
    python3 repo/scripts/gen_identidade.py

Dependencias:
    pip install cairosvg uharfbuzz fonttools pillow
    fonte Poppins (pacote fonts-google / Poppins-Bold.ttf, Poppins-Medium.ttf)

O texto e convertido em caminho vetorial (outline) antes de ir para o SVG,
entao os arquivos NAO dependem da fonte estar instalada em quem abrir.
"""

import io
import os
import sys

import cairosvg
import uharfbuzz as hb
from PIL import Image
from fontTools.misc.transform import Transform
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

# ---------------------------------------------------------------- marca ----
NAVY = "#0f1b30"        # fundo padrao do app
NAVY_DEEP = "#0a1628"   # fundo mais escuro
BLUE = "#3d85d8"        # azul da marca
BLUE_HOVER = "#5294e2"
GOLD = "#c9a84c"        # dourado (destaques / trofeus)
WHITE = "#ffffff"
DIM = "#a3a4ac"         # equivale a rgba(255,255,255,.6) sobre o navy

OUT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "public", "assets", "img",
)

FONT_DIRS = [
    "/usr/share/fonts/truetype/google-fonts",
    "/usr/share/fonts/truetype/poppins",
    "/usr/local/share/fonts",
    os.path.expanduser("~/.fonts"),
]


def find_font(name):
    for d in FONT_DIRS:
        p = os.path.join(d, name)
        if os.path.exists(p):
            return p
    raise SystemExit(
        "Fonte %s nao encontrada. Instale o Poppins (fonts-google) antes de gerar." % name
    )


# ------------------------------------------------------- texto -> vetor ----
class Vetor:
    """Converte texto em path SVG usando HarfBuzz (kerning real) + fontTools."""

    def __init__(self, path):
        self.tt = TTFont(path)
        self.glyphset = self.tt.getGlyphSet()
        self.order = self.tt.getGlyphOrder()
        self.upem = self.tt["head"].unitsPerEm
        face = hb.Face(hb.Blob.from_file_path(path))
        self.hb = hb.Font(face)
        self.hb.scale = (self.upem, self.upem)

    def outline(self, text, size):
        """Retorna (path_d, bbox, advance) com a baseline em y=0 e y para baixo."""
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(self.hb, buf, {"kern": True, "liga": True})

        scale = size / self.upem
        x = y = 0.0
        parts = []
        bbox = None
        for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
            gname = self.order[info.codepoint]
            t = Transform(
                scale, 0, 0, -scale,
                (x + pos.x_offset) * scale,
                -(y + pos.y_offset) * scale,
            )
            sp = SVGPathPen(self.glyphset)
            self.glyphset[gname].draw(TransformPen(sp, t))
            d = sp.getCommands()
            if d:
                parts.append(d)
            bp = BoundsPen(self.glyphset)
            self.glyphset[gname].draw(TransformPen(bp, t))
            if bp.bounds:
                bbox = bp.bounds if bbox is None else (
                    min(bbox[0], bp.bounds[0]), min(bbox[1], bp.bounds[1]),
                    max(bbox[2], bp.bounds[2]), max(bbox[3], bp.bounds[3]),
                )
            x += pos.x_advance
            y += pos.y_advance
        return " ".join(parts), bbox, x * scale

    def largura(self, text, size):
        _, bbox, _ = self.outline(text, size)
        return 0 if bbox is None else bbox[2] - bbox[0]

    def centrado(self, text, size, cx, cy, fill, opacity=None):
        """<path> com a caixa optica do texto centrada em (cx, cy)."""
        d, bbox, _ = self.outline(text, size)
        dx = cx - (bbox[0] + bbox[2]) / 2.0
        dy = cy - (bbox[1] + bbox[3]) / 2.0
        op = "" if opacity is None else ' opacity="%s"' % opacity
        return (
            '<g transform="translate(%.2f,%.2f)"><path fill="%s"%s d="%s"/></g>'
            % (dx, dy, fill, op, d)
        ), (bbox[2] - bbox[0], bbox[3] - bbox[1])

    def ajusta(self, text, size, largura_max):
        """Reduz o corpo ate o texto caber em largura_max."""
        w = self.largura(text, size)
        return size if w <= largura_max else size * largura_max / w


BOLD = Vetor(find_font("Poppins-Bold.ttf"))
MEDIUM = Vetor(find_font("Poppins-Medium.ttf"))


# --------------------------------------------------------------- icone -----
# A arte e desenhada numa caixa de 512x512. ESCALA_BASE amplia a arte dentro
# do quadrado; a versao maskable usa uma escala menor para respeitar a margem.
ART_SCALE_BASE = 1.12
ART_SCALE_MASK = 0.88


def _carta(cx, cy, ang, fill, w=240, h=288, rx=24, extra=""):
    return (
        '<rect x="%.1f" y="%.1f" width="%d" height="%d" rx="%d" fill="%s"%s '
        'transform="translate(%.1f,%.1f) rotate(%.1f)"/>'
        % (-w / 2.0, -h / 2.0, w, h, rx, fill, extra, cx, cy, ang)
    )


def arte(scale=1.0):
    """Baralho de flashcards com o monograma CT. Poucas formas, alto contraste."""
    # monograma: ajustado pela largura para nunca encostar na borda da carta
    corpo = 240.0
    corpo = corpo * 172.0 / BOLD.largura("CT", corpo)
    ct, (cw, ch) = BOLD.centrado("CT", corpo, 210, 257, NAVY)

    partes = [
        _carta(270, 256, 15, GOLD),          # carta do fundo (dourado)
        _carta(246, 259, 7.5, BLUE),         # carta do meio (azul da marca)
        _carta(210, 264, 0, WHITE),          # carta da frente (branca)
        ct,
        '<rect x="158" y="333" width="104" height="16" rx="8" fill="%s"/>' % BLUE,
    ]
    return (
        '<g transform="translate(256,256) scale(%.4f) translate(-256,-256)">%s</g>'
        % (scale, "".join(partes))
    )


def svg_icone(scale=ART_SCALE_BASE, cantos=104, fundo=NAVY, size=512):
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" '
        'width="%d" height="%d" role="img" aria-label="CT Flashcards">'
        '<title>CT Flashcards</title>'
        '<rect width="512" height="512" rx="%d" fill="%s"/>'
        '%s</svg>' % (size, size, cantos, fundo, arte(scale))
    )


def svg_favicon_32():
    """32/48 px: uma carta so, sem o baralho. Menos formas, mais contraste."""
    corpo = 240.0
    corpo = corpo * 216.0 / BOLD.largura("CT", corpo)
    ct, _ = BOLD.centrado("CT", corpo, 256, 236, NAVY)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
        '<rect width="512" height="512" rx="88" fill="%s"/>'
        '<rect x="336" y="88" width="96" height="336" rx="36" fill="%s"/>'
        '<rect x="80" y="72" width="304" height="368" rx="44" fill="%s"/>'
        '%s'
        '<rect x="168" y="344" width="128" height="26" rx="13" fill="%s"/>'
        '</svg>' % (NAVY, BLUE, WHITE, ct, BLUE)
    )


def svg_favicon_16():
    """16 px: so o monograma. A carta vira ruido nesse tamanho."""
    corpo = 240.0
    corpo = corpo * 400.0 / BOLD.largura("CT", corpo)
    ct, _ = BOLD.centrado("CT", corpo, 256, 256, WHITE)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
        '<rect width="512" height="512" rx="72" fill="%s"/>%s</svg>' % (NAVY, ct)
    )


# ----------------------------------------------------------- open graph ----
SUB = "10.274 flashcards de Medicina · Estágio e Residência"
TITULO = "CT Flashcards"


def _fundo(w, h):
    return (
        '<defs>'
        '<radialGradient id="glow" cx="50%%" cy="6%%" r="78%%">'
        '<stop offset="0" stop-color="%s" stop-opacity=".20"/>'
        '<stop offset="1" stop-color="%s" stop-opacity="0"/>'
        '</radialGradient>'
        '<linearGradient id="barra" x1="0" y1="0" x2="1" y2="0">'
        '<stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/>'
        '</linearGradient>'
        '</defs>'
        '<rect width="%d" height="%d" fill="%s"/>'
        '<rect width="%d" height="%d" fill="url(#glow)"/>'
        % (BLUE_HOVER, BLUE_HOVER, BLUE, GOLD, w, h, NAVY_DEEP, w, h)
    )


def _icone_em(cx, cy, altura):
    """Arte do icone (sem o quadrado de fundo) centrada em (cx, cy)."""
    # bbox da arte crua ~ x 90..423, y 86..426  => 340 de altura
    k = altura / 340.0
    return (
        '<g transform="translate(%.1f,%.1f) scale(%.4f) translate(-256,-256)">%s</g>'
        % (cx, cy, k, arte(1.0))
    )


def svg_og(w=1200, h=630):
    if w == h:  # 1200x1200 (Instagram)
        icone_y, icone_alt = 438, 280
        t_size, t_y = 132, 718
        rule_w, rule_h, rule_y = 160, 10, 798
        s_size, s_y, s_max = 46, 878, 980
        barra = 12
    else:       # 1200x630 (WhatsApp / Telegram / Google)
        icone_y, icone_alt = 180, 150
        t_size, t_y = 108, 355
        rule_w, rule_h, rule_y = 132, 8, 425
        s_size, s_y, s_max = 38, 495, 1000
        barra = 8

    titulo, _ = BOLD.centrado(TITULO, t_size, w / 2.0, t_y, WHITE)
    s_size = MEDIUM.ajusta(SUB, s_size, s_max)
    sub, _ = MEDIUM.centrado(SUB, s_size, w / 2.0, s_y, DIM)

    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d">'
        '%s%s%s'
        '<rect x="%.1f" y="%.1f" width="%d" height="%d" rx="%.1f" fill="%s"/>'
        '%s'
        '<rect x="0" y="%d" width="%d" height="%d" fill="url(#barra)"/>'
        '</svg>'
        % (
            w, h, w, h,
            _fundo(w, h),
            _icone_em(w / 2.0, icone_y, icone_alt),
            titulo,
            w / 2.0 - rule_w / 2.0, rule_y - rule_h / 2.0, rule_w, rule_h,
            rule_h / 2.0, GOLD,
            sub,
            h - barra, w, barra,
        )
    )


# ------------------------------------------------------------ rasteriza ----
def png(svg, path, w, h=None, fundo=None):
    h = h or w
    data = cairosvg.svg2png(
        bytestring=svg.encode("utf-8"), output_width=w, output_height=h,
        background_color=fundo,
    )
    img = Image.open(io.BytesIO(data))
    if fundo:
        img = img.convert("RGB")
    else:
        img = img.convert("RGBA")
    img.save(path)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    p = lambda n: os.path.join(OUT, n)

    mestre = svg_icone()
    with open(p("icone.svg"), "w", encoding="utf-8") as f:
        f.write(mestre + "\n")

    png(mestre, p("icone-192.png"), 192)
    png(mestre, p("icone-512.png"), 512)

    # maskable: fundo navy sangrando ate a borda + arte com 20% de margem
    png(svg_icone(scale=ART_SCALE_MASK, cantos=0), p("icone-maskable-512.png"), 512)

    # apple-touch: 180x180, sem transparencia
    png(svg_icone(cantos=0), p("apple-touch-icon.png"), 180, fundo=NAVY)

    # favicon multi-resolucao: cada tamanho rasterizado do seu proprio desenho
    fav16, fav32 = svg_favicon_16(), svg_favicon_32()
    quadros = [
        Image.open(io.BytesIO(cairosvg.svg2png(
            bytestring=svg.encode("utf-8"), output_width=s, output_height=s
        ))).convert("RGBA")
        for s, svg in ((16, fav16), (32, fav32), (48, fav32))
    ]
    quadros[2].save(p("favicon.ico"), format="ICO",
                    sizes=[(48, 48), (32, 32), (16, 16)],
                    append_images=quadros[:2])

    # ---- ícone do aplicativo, no formato que as lojas exigem ----
    # App Store e Play Store: 1024x1024, quadrado, SEM canto arredondado e SEM
    # transparência — a própria loja aplica a máscara. Um PNG com alfa é recusado
    # pela App Store, e cantos já arredondados ficam com borda dupla no iPhone.
    png(svg_icone(cantos=0), p("app-icon-1024.png"), 1024, fundo=NAVY)
    png(svg_icone(cantos=0), p("app-icon-512.png"), 512, fundo=NAVY)
    # versão já arredondada, para usar fora das lojas (site, apresentação, perfil)
    png(svg_icone(cantos=180), p("app-icon-1024-arredondado.png"), 1024)

    png(svg_og(1200, 630), p("og.png"), 1200, 630, fundo=NAVY_DEEP)
    png(svg_og(1200, 1200), p("og-quadrado.png"), 1200, 1200, fundo=NAVY_DEEP)

    for n in sorted(os.listdir(OUT)):
        if n != "README.md":
            print("  %-26s %7d bytes" % (n, os.path.getsize(p(n))))


if __name__ == "__main__":
    main()
