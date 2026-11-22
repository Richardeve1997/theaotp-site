#!/usr/bin/env python3
"""Branded Clear Sky covers for the AOTP guide shelf (DESIGN.md 10.6, tokens.css "Guide cover").

Reads ../guides-all.json (every guide, newest first; it falls back to ../guides.json when that
file is missing) and covers.json (which drawing each guide gets), and writes one
../covers/<slug>.svg for every guide in either manifest, so the /guides/ grid, every gate and
the shelf all have their covers. Each cover is a 4:5 SVG (800 x 1000 user units) on the
signage sky with

  1. the kicker, "FREE GUIDE · /<slug>" in Geist Mono caps,
  2. the guide's own title in Inter Tight 400, white,
  3. one abstract white hairline drawing of the guide's idea, one part filled white,
     with no words, numbers or icons in it,
  4. the supplied white AOTP lockup, bottom left.

Every size is the spec's cqw value times 8 (the cover is 100 cqw = 800 wide). Each cover also
carries its own small form: shown under 200 px wide, the kicker drops, the title moves up and
grows, and the lockup becomes the white Qualia symbol. That switch is a media query inside the
SVG, which a browser evaluates against the size the cover is drawn at, so the same file works
as a 132 px strip tile and as a 1080 export.

Run it with a Python that has fontTools (the content-intelligence venv has it):

    python3 make_covers.py            # all covers
    ... make_covers.py --only pm     # one cover
    ... make_covers.py --check       # print the worst white-on-ground contrast per cover
    ... make_covers.py --shelf 15    # also rewrite guides.json as the newest 15 guides
    ... make_covers.py --mirror      # also copy both manifests, covers/ and cover-tools/ to <repo>/guides/
    ... make_covers.py --sheet /tmp/sheet.html   # write a contact sheet page for a visual check

Without fontTools it still writes every cover but skips the embedded font subsets, so a cover
shown through an <img> tag falls back to Helvetica Neue / Arial (browsers block the Google
Fonts @import inside an SVG image). See README.md.
"""
import argparse
import base64
import io
import json
import math
import os
import re
import shutil
import sys
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))
GUIDES_DIR = os.path.dirname(HERE)                       # app/public/guides
MANIFEST_ALL = os.path.join(GUIDES_DIR, 'guides-all.json')   # every guide: the grid and the gates
MANIFEST = os.path.join(GUIDES_DIR, 'guides.json')            # the shelf: the newest few, for the ring
COVERS_DIR = os.path.join(GUIDES_DIR, 'covers')
CONFIG = os.path.join(HERE, 'covers.json')
FONTS = os.path.join(HERE, 'fonts')
# The supplied white lockup (DESIGN.md: the logo is only the supplied SVG, never redrawn). Its
# first path is the Qualia symbol, which the small form uses on its own.
# On main the tools live at <repo>/guides/cover-tools with their own copy of the lockup (2026-11-22); on the
# clear-sky branch they live under app/public/guides and read the lockup from app/src.
_LOCAL_LOCKUP = os.path.join(HERE, 'lockup-white.svg')
LOCKUP = os.environ.get('AOTP_LOCKUP') or (_LOCAL_LOCKUP if os.path.exists(_LOCAL_LOCKUP) else os.path.normpath(
    os.path.join(GUIDES_DIR, '..', '..', 'src', 'assets', 'clear-sky', 'lockup-white.svg')))
if os.path.isdir(os.path.join(os.path.dirname(GUIDES_DIR), 'app', 'public')):
    # Run from <repo>/guides: mirror into app/public/guides, so a Vite build (which copies app/public over the
    # repo root) carries the same files and never puts older covers back.
    REPO_ROOT = os.path.dirname(GUIDES_DIR)
    MIRROR_DIR = os.path.join(REPO_ROOT, 'app', 'public', 'guides')
else:
    REPO_ROOT = os.path.normpath(os.path.join(GUIDES_DIR, '..', '..', '..'))
    MIRROR_DIR = os.path.join(REPO_ROOT, 'guides')

GOOGLE_FONTS = ("https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400"
                "&family=Geist+Mono:wght@400&display=swap")

# ---- The spec, in cqw of the cover's width (tokens.css --cover-*) -----------------------------
W, H = 800, 1000
CQW = W / 100
M = 6 * CQW                        # --cover-margin
KICK_SIZE = 3.9 * CQW              # --cover-kicker, Geist Mono caps, line height 1.2
KICK_TRACK = 0.12                  # em
TITLE_SIZE = 10.6 * CQW            # --cover-title
TITLE_TOP = 14.5 * CQW             # --cover-title-top (top of the line box)
TITLE_LH = 0.96
TITLE_TRACK = -0.04                # em
TITLE_MAX_W = W - 6 * CQW - 8 * CQW   # left 6 cqw, right 8 cqw
TITLE_MAX_LINES = 3
SMALL_TITLE_SIZE = 12.5 * CQW      # under 200 px wide
SMALL_TITLE_TOP = 7 * CQW
SMALL_TITLE_MAX_LINES = 4
SMALL_BREAK = 199.98               # px: the small form applies below 200 px wide
FIELD_X, FIELD_Y, FIELD_W, FIELD_H = M, 58 * CQW, 88 * CQW, 50 * CQW   # the drawing's field
STROKE = 0.42 * CQW                # --cover-stroke, never under 1 px on screen
LOCKUP_W = 40 * CQW                # --cover-lockup
SYMBOL_W = 11 * CQW                # --cover-symbol

# Line-box maths for the two faces (hhea/typo metrics of the bundled fonts, useTypoMetrics on),
# so a cover sets its type where the CSS version on the guidelines page does.
DISPLAY_ASC, DISPLAY_DESC = 1984 / 2048, 494 / 2048     # Inter Tight
MONO_ASC, MONO_DESC = 1005 / 1000, 295 / 1000           # Geist Mono


def baseline_in_line_box(lh, asc, desc):
    """Distance from the top of a CSS line box to the baseline, in em."""
    return (lh - (asc + desc)) / 2 + asc


# ---- The drawing space -----------------------------------------------------------------------
# Diagrams are drawn in a 688 x 440 box and scaled to fit the 704 x 400 field, centred.
DW, DH = 688, 440
S = min(FIELD_W / DW, FIELD_H / DH)
DX = FIELD_X + (FIELD_W - DW * S) / 2
DY = FIELD_Y + (FIELD_H - DH * S) / 2
SW = STROKE / S                    # the hairline in drawing units
DASH = f'{7 / S * 0.9:.1f} {9 / S * 0.9:.1f}'
INK = '#08070B'
WHITE = '#FFFFFF'

# The ground: --g-signage-sky, the deep, even sky that stays dark top to bottom (DESIGN.md 5).
SKY_STOPS = [(0.0, '#05416E'), (0.125, '#014A78'), (0.25, '#025283'), (0.375, '#02588C'),
             (0.5, '#026096'), (0.625, '#02679E'), (0.75, '#0270A8'), (0.875, '#0278B1'),
             (1.0, '#027EBA')]


# ---- Colour maths (WCAG 2) ----------------------------------------------------------------
def _hex(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _lin(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminance(rgb):
    r, g, b = rgb
    return 0.2126 * _lin(r) + 0.7152 * _lin(g) + 0.0722 * _lin(b)


def contrast(a, b):
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def ground_at(y):
    """The ground colour at canvas y (SVG gradients interpolate in sRGB)."""
    t = min(max(y / H, 0), 1)
    for (t0, c0), (t1, c1) in zip(SKY_STOPS, SKY_STOPS[1:]):
        if t <= t1:
            f = (t - t0) / (t1 - t0)
            a, b = _hex(c0), _hex(c1)
            return tuple(round(a[i] + (b[i] - a[i]) * f) for i in range(3))
    return _hex(SKY_STOPS[-1][1])


def ground_hex(y):
    return '#%02X%02X%02X' % ground_at(y)


# ---- Fonts ---------------------------------------------------------------------------------
def load_widths(name):
    with open(os.path.join(FONTS, name), encoding='utf-8') as fh:
        return json.load(fh)['advance_em']


DISPLAY_W = load_widths('inter-tight-400-widths.json')
MONO_W = load_widths('geist-mono-400-widths.json')


def text_width(text, size, widths, track_em):
    adv = sum(widths.get(ch, 0.6) for ch in text)
    return size * (adv + track_em * max(len(text) - 1, 0))


def subset_font(woff_name, chars):
    """A WOFF subset of one of the bundled fonts as a data URI, or None without fontTools."""
    try:
        from fontTools import subset
        from fontTools.ttLib import TTFont
    except ImportError:
        return None
    # recalcTimestamp=False keeps the bundled font's own head.modified, so a rebuild writes the
    # same bytes and only a real change shows up in a diff.
    font = TTFont(os.path.join(FONTS, woff_name), recalcTimestamp=False)
    opts = subset.Options()
    opts.flavor = 'woff'
    opts.layout_features = ['kern', 'liga', 'calt']
    opts.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]   # keep the copyright and the OFL notice
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(text=''.join(sorted(set(chars) | {' '})))
    sub.subset(font)
    buf = io.BytesIO()
    font.flavor = 'woff'
    font.save(buf)
    return 'data:font/woff;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')


# ---- Title wrapping -------------------------------------------------------------------------
def wrap_title(title, size, max_lines, max_w=TITLE_MAX_W):
    """Fewest lines that fit, then the most even break (like text-wrap: balance)."""
    words = title.split()
    width = lambda ws: text_width(' '.join(ws), size, DISPLAY_W, TITLE_TRACK)
    n = len(words)
    for lines in range(1, min(n, max_lines) + 1):
        best = None

        def splits(start, k):
            if k == 1:
                yield [words[start:]]
                return
            for cut in range(start + 1, n - k + 2):
                for rest in splits(cut, k - 1):
                    yield [words[start:cut]] + rest
        for cand in splits(0, lines):
            widths = [width(ws) for ws in cand]
            if max(widths) > max_w:
                continue
            score = max(widths) - min(widths)
            if best is None or score < best[0]:
                best = (score, [' '.join(ws) for ws in cand])
        if best:
            return best[1]
    return None


def fit_title(title, size, max_lines):
    """The title's lines at the spec size, stepping the size down only if it cannot fit."""
    while size > 40:
        lines = wrap_title(title, size, max_lines)
        if lines:
            return lines, size
        size -= 2
    return [title], size


# Quietened marks keep a floor, as on the Reel diagrams: a hairline never fades under .42
# opacity and a text bar never under .4, so nothing in a drawing turns to mush on a phone.
LINE_FLOOR, BAR_FLOOR = 0.42, 0.4


# ---- Drawing context ----------------------------------------------------------------------
class Cover:
    def __init__(self, slug):
        self.slug = slug
        self.p = f'aotp-cv-{slug}'
        self.out = []

    def add(self, s):
        self.out.append(s)

    # Diagram primitives draw in the 688 x 440 drawing box.
    @staticmethod
    def _abs_y(y):
        return DY + y * S

    def _paint(self, mode, op=1.0, y=0):
        if mode in ('line', 'node'):
            op = max(op, LINE_FLOOR)
        line = f'fill="none" stroke="{WHITE}" stroke-width="{SW:.2f}"'
        if mode == 'fill':
            return f'fill="{WHITE}"' + (f' fill-opacity="{op}"' if op != 1 else '')
        if mode == 'soft':
            return (f'fill="{WHITE}" fill-opacity="{0.12 * op:.3f}" stroke="{WHITE}" stroke-width="{SW:.2f}"'
                    + (f' stroke-opacity="{op}"' if op != 1 else ''))
        if mode == 'ghost':
            return (f'fill="none" stroke="{WHITE}" stroke-width="{SW:.2f}" stroke-dasharray="{DASH}" '
                    f'stroke-opacity="{0.55 * op:.3f}"')
        if mode == 'node':
            # A hollow node that hides the lines running under it: filled with the ground.
            return (f'fill="{ground_hex(self._abs_y(y))}" stroke="{WHITE}" stroke-width="{SW:.2f}"'
                    + (f' stroke-opacity="{op}"' if op != 1 else ''))
        return line + (f' stroke-opacity="{op}"' if op != 1 else '')

    def rect(self, x, y, w, h, rx=12, mode='line', op=1.0):
        self.add(f'<rect x="{x:g}" y="{y:g}" width="{w:g}" height="{h:g}" rx="{rx:g}" {self._paint(mode, op, y + h / 2)}/>')

    def circle(self, cx, cy, r, mode='line', op=1.0):
        self.add(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:g}" {self._paint(mode, op, cy)}/>')

    def path(self, d, mode='line', op=1.0, dash=False):
        if mode in ('fill', 'soft'):
            self.add(f'<path d="{d}" {self._paint(mode, op)} stroke-linejoin="round"/>')
            return
        attrs = f'fill="none" stroke="{WHITE}" stroke-width="{SW:.2f}" stroke-linecap="round" stroke-linejoin="round"'
        op = max(op, LINE_FLOOR)
        if op != 1:
            attrs += f' stroke-opacity="{op}"'
        if dash:
            attrs += f' stroke-dasharray="{DASH}"'
        self.add(f'<path d="{d}" {attrs}/>')

    def line(self, x1, y1, x2, y2, op=1.0, dash=False):
        self.path(f'M{x1:.1f} {y1:.1f}L{x2:.1f} {y2:.1f}', op=op, dash=dash)

    def link(self, a, b, ra=0, rb=0, op=1.0, dash=False, arrow=False):
        """A straight line from circle a to circle b, trimmed to their edges."""
        (x1, y1), (x2, y2) = a, b
        d = math.hypot(x2 - x1, y2 - y1)
        ux, uy = (x2 - x1) / d, (y2 - y1) / d
        p1 = (x1 + ux * ra, y1 + uy * ra)
        p2 = (x2 - ux * rb, y2 - uy * rb)
        if arrow:
            self.arrow(*p1, *p2, op=op, dash=dash)
        else:
            self.line(*p1, *p2, op=op, dash=dash)

    def head(self, x, y, ang, size=13, op=1.0):
        """An open chevron arrowhead with its tip at (x, y), pointing along ang (degrees)."""
        a = math.radians(ang)
        pts = []
        for s in (-1, 1):
            b = a + math.pi + s * math.radians(38)
            pts.append((x + size * math.cos(b), y + size * math.sin(b)))
        self.path(f'M{pts[0][0]:.1f} {pts[0][1]:.1f}L{x:.1f} {y:.1f}L{pts[1][0]:.1f} {pts[1][1]:.1f}', op=op)

    def arrow(self, x1, y1, x2, y2, op=1.0, dash=False):
        self.line(x1, y1, x2, y2, op=op, dash=dash)
        self.head(x2, y2, math.degrees(math.atan2(y2 - y1, x2 - x1)), op=op)

    def bar(self, x, y, w, h=12, op=0.55):
        """A rounded bar standing in for a line of text (never real words)."""
        op = max(op, BAR_FLOOR)
        self.add(f'<rect x="{x:g}" y="{y - h / 2:g}" width="{w:g}" height="{h:g}" rx="{h / 2:g}" fill="{WHITE}" fill-opacity="{op}"/>')

    def ink_bar(self, x, y, w, h=10, op=0.45):
        self.add(f'<rect x="{x:g}" y="{y - h / 2:g}" width="{w:g}" height="{h:g}" rx="{h / 2:g}" fill="{INK}" fill-opacity="{op}"/>')

    def window(self, x, y, w, h):
        """A window: frame, a title bar rule and a short title bar (no window-control lights)."""
        self.rect(x, y, w, h, rx=16)
        self.line(x, y + 44, x + w, y + 44, op=0.6)
        self.bar(x + 24, y + 22, 64, h=10, op=0.45)

    def prompt(self, x, y, size=10, op=0.85):
        """Where a shell prompt sits: a short square-ended bar (no chevron pictogram)."""
        self.add(f'<rect x="{x:g}" y="{y - size * 0.6:g}" width="{size * 1.4:g}" height="{size * 1.2:g}" '
                 f'rx="{size * 0.2:g}" fill="{WHITE}" fill-opacity="{max(op, BAR_FLOOR)}"/>')


# ---- The diagrams ---------------------------------------------------------------------------
# White hairline drawings of each guide's idea. One part is filled white, where the reader
# comes in; everything else is hairline, soft (a 12% white tint) or a hollow node.
def d_steps(c, P):
    """A staircase: your chat history at the bottom, a skill at the top."""
    w, gap, base = 116, 27, 430
    heights = [80, 150, 220, 290, 360]
    tops = []
    for i, h in enumerate(heights):
        x = i * (w + gap)
        last = i == len(heights) - 1
        c.rect(x, base - h, w, h, rx=14, mode='fill' if last else 'soft', op=1 if last else 0.55 + 0.15 * i)
        tops.append((x + w / 2, base - h - 34))
    for a, b in zip(tops[:-2], tops[1:-1]):
        c.link(a, b, 11, 11, dash=True, op=0.85)
    for x, y in tops[:-1]:
        c.circle(x, y, 9, mode='node')
    c.link(tops[-2], (tops[-1][0] - 26, tops[-1][1] + 10), 11, 0, op=0.85, dash=True, arrow=True)


def d_orbit(c, P):
    """One agent in the middle, reaching out to the places on its ring."""
    cx, cy, R = 344, 220, 176
    n = P.get('count', 5)
    c.circle(cx, cy, R, mode='ghost')
    for i in range(n):
        a = math.radians(-90 + i * 360 / n)
        node = (cx + R * math.cos(a), cy + R * math.sin(a))
        c.link((cx, cy), node, 74, 24, op=0.9)
        c.circle(*node, 18, mode='node')
    c.circle(cx, cy, 62, mode='fill')


def d_pages(c, P):
    """A stack of pages with an index, read first and saved back to after every chat."""
    c.rect(96, 30, 250, 340, rx=14, mode='ghost')
    c.rect(72, 54, 250, 340, rx=14, op=0.6)
    c.rect(48, 78, 250, 350, rx=14, mode='node')
    c.rect(48, 78, 250, 350, rx=14, mode='soft')
    c.rect(74, 106, 140, 40, rx=10, mode='fill')
    for i, ln in enumerate([190, 150, 176, 130, 166, 120]):
        c.bar(74, 192 + i * 38, ln, h=11, op=0.5)
    # the chat
    c.rect(470, 170, 210, 118, rx=26)
    c.path('M516 288 L502 320 L546 288')
    c.bar(500, 214, 130, h=11, op=0.6)
    c.bar(500, 244, 96, h=11, op=0.6)
    c.path('M352 118 C 410 50, 530 50, 566 158', dash=True)
    c.head(566, 160, 72)
    c.path('M632 296 C 630 390, 450 414, 352 380', dash=True)
    c.head(350, 379, 198)


def d_reels(c, P):
    """A creator's Reels, run through one extract step, written out as skills."""
    fw, fh, g = 56, 98, 14
    x0, y0 = 0, 116
    for r in range(2):
        for col in range(3):
            x, y = x0 + col * (fw + g), y0 + r * (fh + g)
            # A vertical video: a frame and its caption line (no play-button pictogram).
            c.rect(x, y, fw, fh, rx=10, mode='soft' if (r + col) % 2 else 'line', op=0.9)
            c.bar(x + 12, y + fh - 24, 32, h=8, op=0.6)
    c.arrow(214, 220, 260, 220, op=0.9)
    c.path('M272 146 L396 194 L396 246 L272 294 Z', mode='soft')
    c.arrow(406, 220, 456, 220, op=0.9)
    c.rect(490, 88, 198, 250, rx=14, mode='ghost')
    c.rect(470, 110, 198, 250, rx=14, mode='fill')
    for i, ln in enumerate([96, 140, 116, 150, 96, 128]):
        c.ink_bar(496, 148 + i * 34, ln)


def d_converge(c, P):
    """Five jobs, five repos, one project."""
    end = (530, 220)
    for i in range(5):
        cy = 44 + i * 88
        c.rect(0, cy - 26, 220, 52, rx=26, mode='soft')
        c.bar(30, cy, 70 + (i * 37) % 70, h=10, op=0.55)
        c.path(f'M226 {cy} C 340 {cy}, {end[0] - 120} {end[1]}, {end[0]} {end[1]}', op=0.85)
    c.circle(584, 220, 104, mode='fill')


def d_dotgrid(c, P):
    """Twenty-eight skills, and a question answered with its source."""
    hot = (6, 1)
    for r in range(4):
        for col in range(7):
            x, y = 16 + col * 54, 136 + r * 54
            if (col, r) == hot:
                c.circle(x, y, 17, mode='fill')
            else:
                c.circle(x, y, 13, mode='soft' if (col + r) % 3 == 0 else 'line', op=0.9)
    hx, hy = 16 + hot[0] * 54, 136 + hot[1] * 54
    c.path(f'M{hx + 26} {hy} C {hx + 56} {hy}, 382 220, 412 220', dash=True)
    c.rect(418, 110, 270, 214, rx=28, mode='soft')
    c.path('M466 324 L452 362 L502 324')
    c.bar(450, 158, 190, h=11, op=0.6)
    c.bar(450, 190, 150, h=11, op=0.6)
    c.bar(450, 222, 170, h=11, op=0.6)
    c.rect(450, 254, 120, 42, rx=21)


def d_terminal(c, P):
    """A terminal with commands going in, and the keys underneath."""
    x, y, w, h = 44, 14, 600, 300
    c.window(x, y, w, h)
    for i in range(4):
        ry = y + 92 + i * 44
        cw = 64 + (i * 29) % 56
        c.bar(x + 34, ry, cw, h=12, op=0.9)
        c.bar(x + 56 + cw, ry, 110 + (i * 53) % 120, h=12, op=0.35)
    cy = y + 92 + 4 * 44
    c.prompt(x + 34, cy)
    c.rect(x + 58, cy - 14, 16, 28, rx=2, mode='fill')
    widths = [96, 96, 190]
    kx = 344 - (sum(widths) + 20 * (len(widths) - 1)) / 2
    for kw in widths:
        c.rect(kx, 352, kw, 60, rx=12, mode='soft')
        c.line(kx + 12, 402, kx + kw - 12, 402, op=0.35)
        kx += kw + 20


def d_fan(c, P):
    """One input, one model, one answer picked from your list."""
    c.circle(54, 220, 42)
    c.circle(54, 220, 12, mode='node')
    c.arrow(104, 220, 196, 220)
    c.rect(206, 160, 120, 120, rx=28, mode='soft')
    c.circle(266, 220, 22, op=0.9)
    pick = P.get('pick', 1)
    for i in range(4):
        cy = 58 + i * 108
        chosen = i == pick
        x0 = 438
        c.path(f'M330 220 C 384 220, 384 {cy}, {x0 - 10} {cy}', op=1 if chosen else 0.45, dash=not chosen)
        if chosen:
            c.head(x0 - 10, cy, 0)
        c.rect(x0, cy - 26, 250, 52, rx=26, mode='fill' if chosen else 'line', op=1 if chosen else 0.75)


def d_focus(c, P):
    """A tangled thread straightens out into one line to the answer, your place marked."""
    c.path('M0 230 C 30 120, 120 110, 104 190 C 92 250, 20 300, 62 330 C 110 362, 170 250, 136 214 '
           'C 104 180, 160 120, 200 168 C 236 212, 196 292, 236 262 C 252 250, 258 236, 268 230',
           op=0.85)
    c.arrow(268, 230, 474, 230)
    c.circle(584, 230, 100, op=0.35)
    c.circle(584, 230, 66, op=0.7)
    c.circle(584, 230, 32, mode='fill')
    # Your place on the line: a hollow node with a plain tag above it (no flag pictogram).
    c.line(380, 218, 380, 176)
    c.rect(344, 128, 72, 48, rx=24, mode='soft')
    c.circle(380, 230, 11, mode='node')


def d_docs3(c, P):
    """Three working documents, one shared context every skill reads."""
    xs = [24, 254, 484]
    for x in xs:
        c.rect(x, 12, 180, 204, rx=14, mode='soft')
        c.bar(x + 24, 50, 70, h=12, op=0.9)
        for i, ln in enumerate([132, 104, 120, 84]):
            c.bar(x + 24, 96 + i * 28, ln, h=10, op=0.45)
    for x, ex in zip(xs, [284, 344, 404]):
        c.path(f'M{x + 90} 222 C {x + 90} 282, {ex} 262, {ex} 318', op=0.85)
        c.head(ex, 318, 90)
    c.rect(124, 330, 440, 70, rx=35, mode='fill')


def d_broadcast(c, P):
    """A question, an answer you can inspect, and the answer made public."""
    c.rect(0, 152, 156, 110, rx=28)
    c.path('M38 262 L28 296 L74 262')
    c.bar(30, 192, 92, h=11, op=0.6)
    c.bar(30, 222, 64, h=11, op=0.6)
    c.arrow(168, 208, 220, 208)
    c.rect(232, 80, 250, 256, rx=16, mode='soft')
    c.bar(258, 118, 96, h=11, op=0.6)
    base = 304
    for i, h in enumerate([48, 76, 64, 104, 140]):
        x = 260 + i * 40
        c.rect(x, base - h, 26, h, rx=5, mode='fill' if i == 4 else 'line', op=1 if i == 4 else 0.85)
    c.line(250, base + 2, 464, base + 2, op=0.6)
    ox, oy = 484, 208
    for r, op in [(62, 1), (106, 0.7), (150, 0.42)]:
        a0, a1 = math.radians(-48), math.radians(48)
        c.path(f'M{ox + r * math.cos(a0):.1f} {oy + r * math.sin(a0):.1f} '
               f'A{r} {r} 0 0 1 {ox + r * math.cos(a1):.1f} {oy + r * math.sin(a1):.1f}', op=op)


def d_ladder(c, P):
    """A seven-rung ladder: climb from the bottom, stop at the first rung that holds."""
    lx, rx = 244, 444
    c.line(lx, 6, lx, 434)
    c.line(rx, 6, rx, 434)
    hold = P.get('hold', 3)
    for i in range(7):
        n = 7 - i                    # rung number, 1 at the bottom
        y = 40 + i * 60
        if n == hold:
            c.rect(lx - 14, y - 15, rx - lx + 28, 30, rx=15, mode='fill')
        else:
            c.line(lx, y, rx, y, op=0.3 if n > hold else 1)
    y = 40 + (7 - hold) * 60
    c.arrow(lx - 150, y, lx - 34, y, op=0.85)


def d_bars(c, P):
    """Weeks of posts, and the reach climbing with them."""
    base = 410
    c.line(0, base, DW, base, op=0.6)
    heights = [56, 92, 78, 136, 178, 232, 306]
    w, g, x0 = 62, 32, 24
    pts = []
    for i, h in enumerate(heights):
        x = x0 + i * (w + g)
        c.rect(x, base - h, w, h, rx=8, mode='soft')
        pts.append((x + w / 2, base - h - 32))
    d = f'M{pts[0][0]:.1f} {pts[0][1]:.1f}'
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        mx = (x1 + x2) / 2
        d += f' C {mx:.1f} {y1:.1f}, {mx:.1f} {y2:.1f}, {x2:.1f} {y2:.1f}'
    c.path(d)
    for x, y in pts[:-1]:
        c.circle(x, y, 8, mode='node')
    lx, ly = pts[-1]
    c.circle(lx, ly, 28, op=0.5)
    c.circle(lx, ly, 15, mode='fill')


def d_pies(c, P):
    """The pie grows in every scenario. The white slice, workers' share, shrinks."""
    pies = [(92, 220, 80), (330, 220, 102), (570, 220, 122)]
    shares = P.get('shares', [0.594, 0.561, 0.452])
    for i, ((cx, cy, r), share) in enumerate(zip(pies, shares)):
        last = i == len(pies) - 1
        c.circle(cx, cy, r, mode='soft')
        a = -math.pi / 2 + share * 2 * math.pi
        ex, ey = cx + r * math.cos(a), cy + r * math.sin(a)
        large = 1 if share > 0.5 else 0
        # Only the last share is the filled part; the earlier ones are soft (tint and edge).
        c.path(f'M{cx} {cy} L{cx} {cy - r} A{r} {r} 0 {large} 1 {ex:.1f} {ey:.1f} Z',
               mode='fill' if last else 'soft')


def d_duo(c, P):
    """Two models around one spec: one plans and reviews, the other builds."""
    c.circle(110, 220, 98)
    c.circle(578, 220, 98)
    c.circle(110, 220, 30, op=0.5)
    c.circle(578, 220, 30, op=0.5)
    c.rect(294, 154, 100, 132, rx=12, mode='fill')
    for i, ln in enumerate([60, 44, 64, 50]):
        c.ink_bar(314, 186 + i * 22, ln, h=9)
    c.path('M180 148 C 250 52, 438 52, 506 142')
    c.head(506, 142, 54)
    c.path('M506 298 C 438 392, 250 392, 180 302')
    c.head(180, 302, 234)


def d_pipeline(c, P):
    """Five steps in a row, one skill each."""
    n, r, cy = 5, 44, 200
    step = (DW - 2 * 58) / (n - 1)
    for i in range(n):
        cx = 58 + i * step
        c.circle(cx, cy, r, mode='fill' if i == 0 else 'soft')
        if i < n - 1:
            c.arrow(cx + r + 10, cy, cx + step - r - 10, cy)
    c.path(f'M58 290 V306 Q58 318 70 318 H{DW - 70} Q{DW - 58} 318 {DW - 58} 306 V290', op=0.6)
    c.line(344, 318, 344, 352, op=0.6)
    c.rect(254, 352, 180, 50, rx=25, mode='soft')


def d_checklist(c, P):
    """Ten items scored yes or no. Start at the lowest number you scored no on."""
    ticked = set(P.get('ticked', [1, 2, 3, 5, 7, 8]))
    start = min(i for i in range(1, 11) if i not in ticked)
    lens = [180, 140, 200, 220, 160, 130, 190, 150, 170, 120]
    for i in range(10):
        n = i + 1
        x0 = 20 if i < 5 else 364
        y = 40 + (i % 5) * 90
        here = n == start
        # A yes holds a small quiet square, a no is empty, and the first no is filled (no ticks).
        c.rect(x0, y - 20, 40, 40, rx=9, mode='fill' if here else 'line', op=1 if here or n in ticked else 0.75)
        if n in ticked:
            c.add(f'<rect x="{x0 + 11:g}" y="{y - 9:g}" width="18" height="18" rx="4" '
                  f'fill="{WHITE}" fill-opacity="0.6"/>')
        c.bar(x0 + 62, y, lens[i], h=12, op=0.95 if here else 0.5 if n in ticked else 0.28)


def d_track(c, P):
    """A loop around a criteria file: run, check, feedback, back into the skill."""
    c.rect(130, 64, 428, 312, rx=156, op=0.85)
    # The loop is a stadium: two half circles of radius 156 round (286, 220) and (402, 220).
    # The arrowheads sit on those curves, halfway between the nodes, turned to the direction
    # of travel (clockwise), with the same small chord correction the three-step loop uses.
    for cx, a in [(402, -45), (286, 135)]:
        t = math.radians(a)
        c.head(cx + 156 * math.cos(t), 220 + 156 * math.sin(t), a + 90 - 3, size=14)
    for x, y in [(344, 64), (558, 220), (344, 376), (130, 220)]:
        c.circle(x, y, 15, mode='node')
    c.rect(244, 188, 200, 64, rx=32, mode='fill')


def d_panes(c, P):
    """Two terminals side by side, both reading the same folder."""
    for x in [0, 368]:
        c.window(x, 10, 320, 200)
        for i, ln in enumerate([170, 120, 200]):
            y = 92 + i * 36
            c.prompt(x + 26, y, size=8, op=0.8)
            c.bar(x + 50, y, ln, h=10, op=0.5)
    for x, y2 in [(160, 290), (528, 310)]:
        c.line(x, 218, x, y2 - 12, dash=True)
        c.head(x, y2 - 10, 90)
    c.path('M96 300 Q96 288 108 288 H218 Q226 288 232 296 L242 308 H580 Q592 308 592 320 V418 '
           'Q592 430 580 430 H108 Q96 430 96 418 Z', mode='soft')
    focus = P.get('focus', 1)
    widths = [130, 110, 92]
    x = 344 - (sum(widths) + 16 * (len(widths) - 1)) / 2
    for i, w in enumerate(widths):
        c.rect(x, 346, w, 46, rx=23, mode='fill' if i == focus else 'line')
        x += w + 16


def d_stepchart(c, P):
    """Rounds stepping up, the last one far above the rest."""
    base = 404
    c.line(0, base, DW, base, op=0.6)
    pts = [(110, 330), (344, 214), (578, 70)]
    c.path(f'M110 {base} V330 H344 V214 H578 V70 H688 V{base} Z', mode='fill', op=0.1)
    c.path('M20 330 H110 M110 330 H344 V214 H578 V70 H688')
    for i, (x, y) in enumerate(pts):
        last = i == len(pts) - 1
        c.line(x, y + (18 if last else 14), x, base, dash=True, op=0.45)
        if last:
            c.circle(x, y, 30, op=0.5)
            c.circle(x, y, 16, mode='fill')
        else:
            c.circle(x, y, 10, mode='node')


def d_harness(c, P):
    """The same harness, a different model slotted into it."""
    c.rect(0, 24, 470, 392, rx=20)
    c.line(0, 76, 470, 76, op=0.6)
    c.bar(26, 50, 120, h=11, op=0.6)
    for i in range(3):
        cy = 140 + i * 84
        c.rect(26, cy - 26, 166, 52, rx=26, mode='soft')
    c.rect(222, 104, 226, 290, rx=16, mode='ghost')
    c.rect(240, 122, 190, 254, rx=12, mode='fill')
    c.rect(520, 122, 168, 254, rx=12, mode='ghost')
    c.arrow(510, 249, 446, 249, op=0.75, dash=True)


def d_reel(c, P):
    """A vertical video and the tracks that build it: a card up top, the speaker's tinted
    window below with the caption over it (a tint, never a person glyph)."""
    c.rect(0, 12, 222, 396, rx=30)
    c.rect(22, 44, 178, 126, rx=12, op=0.7)
    c.bar(42, 86, 96, h=11, op=0.6)
    c.bar(42, 116, 128, h=11, op=0.42)
    c.rect(22, 194, 178, 192, rx=22, mode='soft')
    c.bar(34, 326, 154, h=12, op=0.45)
    c.rect(80, 310, 62, 32, rx=8, op=0.9)
    x0, x1 = 270, DW
    for i in range(4):
        y = 92 + i * 80
        if i == 0:
            c.rect(x0, y - 22, x1 - x0, 44, rx=8, mode='soft')
        elif i == 1:
            c.rect(x0 + 20, y - 22, 110, 44, rx=8)
            c.rect(x0 + 190, y - 22, 140, 44, rx=8)
        elif i == 2:
            for k in range(12):
                bx = x0 + 4 + k * 35
                c.rect(bx, y - 13, 26, 26, rx=6, mode='fill' if k == 6 else 'line', op=1 if k == 6 else 0.6)
        else:
            d = f'M{x0} {y}'
            for k in range(18):
                x = x0 + (k + 1) * (x1 - x0) / 18
                amp = 15 if k % 2 == 0 else -15
                d += f' Q {x - (x1 - x0) / 36:.1f} {y + amp * (0.6 + 0.4 * math.sin(k)):.1f}, {x:.1f} {y}'
            c.path(d, op=0.85)
    ph = x0 + 6 * 35 + 17
    c.line(ph, 44, ph, 352, op=0.9)
    c.path(f'M{ph - 10} 34 L{ph + 10} 34 L{ph} 48 Z', op=0.9)


def d_tiles(c, P):
    """Ten tiles, one picked to go deep on (one filled part, as the spec asks)."""
    pick = set(P.get('pick', [3]))
    s, g = 112, 32
    for i in range(10):
        r, col = divmod(i, 5)
        x, y = col * (s + g), 70 + r * (s + g)
        on = (i + 1) in pick
        c.rect(x, y, s, s, rx=16, mode='fill' if on else 'line', op=1 if on else 0.7)
        if not on:
            c.bar(x + 24, y + s / 2, 64 - (i * 11) % 30, h=10, op=0.35)


def d_stack(c, P):
    """An agent on top of the blocks it runs on."""
    x, w, h = 74, 540, 76
    for i in range(4):
        y = 18 + i * 104
        top = i == 0
        c.rect(x, y, w, h, rx=20, mode='fill' if top else 'soft')
        if not top:
            c.bar(x + 34, y + h / 2, 90 + (i * 41) % 80, h=11, op=0.55)
        if i < 3:
            c.line(344, y + h + 8, 344, y + 104 - 8, op=0.7)


def d_triangle(c, P):
    """The trade-off triangle, with your system sitting somewhere inside it."""
    a, b, d = (344, 50), (84, 400), (604, 400)
    c.path(f'M{a[0]} {a[1]} L{d[0]} {d[1]} L{b[0]} {b[1]} Z', mode='soft', op=0.6)
    for k in (0.62, 0.3):
        cx, cy = 344, 284
        pts = [(cx + (p[0] - cx) * k, cy + (p[1] - cy) * k) for p in (a, d, b)]
        c.path('M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + ' Z', op=0.3)
    p = (362, 276)
    for v in (a, b, d):
        c.link(p, v, 30, 16, dash=True, op=0.6)
    for v in (a, b, d):
        c.circle(v[0], v[1], 14, mode='node')
    c.circle(p[0], p[1], 28, op=0.6)
    c.circle(p[0], p[1], 15, mode='fill')


def d_gauge(c, P):
    """A plan-quota gauge and the status line that carries it."""
    cx, cy, ro, ri = 344, 300, 204, 156
    left = P.get('left', 0.62)
    c.path(f'M{cx - ro} {cy} A{ro} {ro} 0 0 1 {cx + ro} {cy} L{cx + ri} {cy} A{ri} {ri} 0 0 0 {cx - ri} {cy} Z', mode='soft', op=0.6)
    a = math.pi + left * math.pi
    ox, oy = cx + ro * math.cos(a), cy + ro * math.sin(a)
    ix, iy = cx + ri * math.cos(a), cy + ri * math.sin(a)
    c.path(f'M{cx - ro} {cy} A{ro} {ro} 0 0 1 {ox:.1f} {oy:.1f} L{ix:.1f} {iy:.1f} A{ri} {ri} 0 0 0 {cx - ri} {cy} Z', mode='fill')
    for k in range(5):
        t = math.pi + k * math.pi / 4
        c.line(cx + (ro + 12) * math.cos(t), cy + (ro + 12) * math.sin(t),
               cx + (ro + 28) * math.cos(t), cy + (ro + 28) * math.sin(t), op=0.7)
    c.rect(cx - 170, 350, 340, 58, rx=29)
    c.bar(cx - 140, 379, 150, h=12, op=0.6)
    c.bar(cx + 30, 379, 100, h=12, op=0.35)


def d_infinity(c, P):
    """Offline and online evaluation, each feeding the other."""
    c.path('M344 220 C 424 80, 660 80, 660 220 C 660 360, 424 360, 344 220 '
           'C 264 80, 28 80, 28 220 C 28 360, 264 360, 344 220 Z')
    c.head(530, 115, 0, size=14)
    c.head(158, 325, 180, size=14)
    c.circle(344, 220, 30, op=0.5)
    c.circle(344, 220, 16, mode='fill')


def d_toggle(c, P):
    """A switch between two models, each with its job."""
    c.rect(84, 110, 520, 220, rx=110)
    c.circle(194, 220, 84, mode='ghost')
    c.circle(494, 220, 84, mode='fill')
    c.arrow(296, 220, 390, 220, op=0.6, dash=True)


def d_org(c, P):
    """An agent team as an org tree: you at the top, one lead under you, managers, then the
    agents they run, with one dashed seat for the next hire."""
    cx = 344
    c.circle(cx, 30, 16, mode='node')
    c.line(cx, 46, cx, 82, op=0.85)
    c.rect(cx - 75, 82, 150, 64, rx=32, mode='fill')
    c.line(cx, 146, cx, 190, op=0.85)
    mx = [114, 344, 574]
    c.line(mx[0], 190, mx[-1], 190, op=0.85)
    agents = {114: [70, 158], 344: [264, 344, 424], 574: [530, 618]}
    for i, x in enumerate(mx):
        c.line(x, 190, x, 222, op=0.85)
        c.rect(x - 85, 222, 170, 60, rx=30, mode='soft')
        c.bar(x - 52, 252, 64 + (i * 23) % 40, h=10, op=0.55)
        xs = agents[x]
        c.line(x, 282, x, 326, op=0.7)
        c.line(xs[0], 326, xs[-1], 326, op=0.7)
        for ax in xs:
            ghost = (x, ax) == (344, 424)
            c.line(ax, 326, ax, 360, op=0.7, dash=ghost)
            c.circle(ax, 386, 26, mode='ghost' if ghost else 'node')


def d_timeline(c, P):
    """One month of releases on a line, in order, one picked; after a gap, a dashed stretch
    with two quieter ones that came later."""
    y = 220
    c.line(0, y, 540, y)
    heights = P.get('heights', [118, 92, 150, 72, 134, 104, 160, 86])
    pick = P.get('pick', 4)
    for i, h in enumerate(heights):
        x = 30 + i * 66
        up = i % 2 == 0
        ty = y - h if up else y + h
        r = 20 if i == pick else 14
        c.line(x, y, x, ty + (r if up else -r), op=1 if i == pick else 0.75)
        c.circle(x, ty, r, mode='fill' if i == pick else 'node')
    c.line(566, y, DW, y, dash=True, op=0.6)
    for x in (608, 668):
        c.circle(x, y, 15, mode='node', op=0.5)


def d_cycle3(c, P):
    """Three steps run on a loop, the first one (knowing what people need) filled."""
    cx, cy, R, r = 344, 236, 168, 66
    angles = [-90, 30, 150]
    pts = [(cx + R * math.cos(math.radians(a)), cy + R * math.sin(math.radians(a))) for a in angles]
    gap = math.degrees(2 * math.asin((r + 18) / (2 * R)))
    for i, a in enumerate(angles):
        a0, a1 = math.radians(a + gap), math.radians(a + 120 - gap)
        x0, y0 = cx + R * math.cos(a0), cy + R * math.sin(a0)
        x1, y1 = cx + R * math.cos(a1), cy + R * math.sin(a1)
        c.path(f'M{x0:.1f} {y0:.1f} A{R} {R} 0 0 1 {x1:.1f} {y1:.1f}', op=0.9)
        c.head(x1, y1, math.degrees(a1) + 90 - 4, size=14, op=0.9)
    for i, (x, y) in enumerate(pts):
        if i == 0:
            c.circle(x, y, r, mode='fill')
        else:
            c.circle(x, y, r, mode='soft')
            c.bar(x - 34, y - 12, 68, h=10, op=0.55)
            c.bar(x - 34, y + 14, 46, h=10, op=0.42)


DIAGRAMS = {
    'org': d_org, 'timeline': d_timeline, 'cycle3': d_cycle3,
    'steps': d_steps, 'orbit': d_orbit, 'pages': d_pages, 'reels': d_reels, 'converge': d_converge,
    'dotgrid': d_dotgrid, 'terminal': d_terminal, 'fan': d_fan, 'focus': d_focus, 'docs3': d_docs3,
    'broadcast': d_broadcast, 'ladder': d_ladder, 'bars': d_bars, 'pies': d_pies, 'duo': d_duo,
    'pipeline': d_pipeline, 'checklist': d_checklist, 'track': d_track, 'panes': d_panes,
    'stepchart': d_stepchart, 'harness': d_harness, 'reel': d_reel, 'tiles': d_tiles,
    'stack': d_stack, 'triangle': d_triangle, 'gauge': d_gauge, 'infinity': d_infinity,
    'toggle': d_toggle,
}


# ---- Lockup ---------------------------------------------------------------------------------
def lockup_parts():
    """(viewBox width, height, every path of the lockup, the Qualia symbol path alone)."""
    with open(LOCKUP, encoding='utf-8') as fh:
        svg = fh.read()
    vb = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg)
    body = re.search(r'<g fill="#FFFFFF">(.*?)</g>', svg, re.S)
    sym = re.search(r'<path transform="scale\(([\d.]+)\)" d="([^"]+)"', svg)
    if not (vb and body and sym):
        sys.exit(f'Could not read the lockup at {LOCKUP}')
    return float(vb.group(1)), float(vb.group(2)), body.group(1).strip(), sym.group(2)


# ---- One cover ------------------------------------------------------------------------------
def build(guide, conf, lockup, embed=True):
    slug = guide['slug']
    c = Cover(slug)
    kind = conf.get('diagram')
    if kind not in DIAGRAMS:
        sys.exit(f'{slug}: unknown or missing diagram "{kind}" in covers.json')
    DIAGRAMS[kind](c, conf.get('params', {}))

    title = guide['title']
    big, big_size = fit_title(title, TITLE_SIZE, TITLE_MAX_LINES)
    small, small_size = fit_title(title, SMALL_TITLE_SIZE, SMALL_TITLE_MAX_LINES)
    kicker = conf.get('kicker') or f'Free guide · {guide.get("url", "/" + slug + "/").rstrip("/") or "/"}'
    kicker = kicker.upper()

    display_family = f"'{c.p}-display', 'Inter Tight', 'Helvetica Neue', Arial, sans-serif"
    mono_family = f"'{c.p}-mono', 'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace"

    def title_text(lines, size, top, cls):
        base = top + baseline_in_line_box(TITLE_LH, DISPLAY_ASC, DISPLAY_DESC) * size
        spans = ''.join(f'<tspan x="{M:g}" y="{base + i * TITLE_LH * size:.1f}">{escape(ln)}</tspan>'
                        for i, ln in enumerate(lines))
        return (f'<text class="{cls}" font-family="{escape(display_family)}" font-size="{size:g}" '
                f'font-weight="400" letter-spacing="{TITLE_TRACK * size:.2f}" fill="{WHITE}">{spans}</text>')

    lw, lh, lpaths, sym_d = lockup
    lock_scale = LOCKUP_W / lw
    lock_h = lh * lock_scale
    sym_scale = SYMBOL_W / 250            # the symbol is drawn in a 250 unit square

    fonts_css = ''
    if embed:
        disp = subset_font('inter-tight-400.woff', title)
        mono = subset_font('geist-mono-400.woff', kicker)
        if disp and mono:
            fonts_css = (f"@font-face{{font-family:'{c.p}-display';src:url({disp}) format('woff');font-weight:400}}"
                         f"@font-face{{font-family:'{c.p}-mono';src:url({mono}) format('woff');font-weight:400}}")
    # The small form, and a hairline that never drops under 1 px on screen (.42 vw of the
    # cover's own viewport is .42 cqw). Scoped to this cover's id, so inlining several is safe.
    p = c.p
    css = (f"@import url('{GOOGLE_FONTS}');{fonts_css}"
           f"#{p} .cv-sm,#{p} .cv-ts{{display:none}}"
           f"@media (max-width:{SMALL_BREAK}px){{#{p} .cv-k,#{p} .cv-lk,#{p} .cv-tb{{display:none}}"
           f"#{p} .cv-sm,#{p} .cv-ts{{display:inline}}}}"
           f"@supports (stroke-width:max(1px,1vw)){{#{p} .cv-d [stroke]{{vector-effect:non-scaling-stroke;"
           f"stroke-width:max(1px,{STROKE / W * 100:.2f}vw)}}}}")
    stops = ''.join(f'<stop offset="{t:.4f}" stop-color="{col}"/>' for t, col in SKY_STOPS)
    label = escape(f'{title}: a free guide from Art of the Possible')
    kick_base = M + baseline_in_line_box(1.2, MONO_ASC, MONO_DESC) * KICK_SIZE
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" id="{p}" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-labelledby="{p}-title">
<title id="{p}-title">{label}</title>
<defs>
<style><![CDATA[{css}]]></style>
<linearGradient id="{p}-sky" x1="0" y1="0" x2="0" y2="1">{stops}</linearGradient>
</defs>
<rect width="{W}" height="{H}" fill="url(#{p}-sky)"/>
<text class="cv-k" x="{M:g}" y="{kick_base:.1f}" font-family="{escape(mono_family)}" font-size="{KICK_SIZE:g}" letter-spacing="{KICK_TRACK * KICK_SIZE:.2f}" fill="{WHITE}" aria-hidden="true">{escape(kicker)}</text>
{title_text(big, big_size, TITLE_TOP, 'cv-tb')}
{title_text(small, small_size, SMALL_TITLE_TOP, 'cv-ts')}
<g class="cv-d" transform="translate({DX:.2f} {DY:.2f}) scale({S:.5f})" aria-hidden="true">
{chr(10).join(c.out)}
</g>
<g class="cv-lk" transform="translate({M:g} {H - M - lock_h:.2f}) scale({lock_scale:.5f})" fill="{WHITE}" aria-hidden="true">{lpaths}</g>
<g class="cv-sm" transform="translate({M:g} {H - M - SYMBOL_W:g}) scale({sym_scale:.5f})" fill="{WHITE}" aria-hidden="true"><path d="{sym_d}"/></g>
</svg>
'''
    info = {
        'big': (big, big_size), 'small': (small, small_size), 'kicker': kicker,
        # (what, the lowest canvas y that white element reaches) for the contrast check
        'white': [('kicker', kick_base + 0.3 * KICK_SIZE)]
                 + [(f'title line {i + 1}', TITLE_TOP + (i + 1) * TITLE_LH * big_size) for i in range(len(big))]
                 + [('diagram', FIELD_Y + FIELD_H), ('lockup', H - M)],
    }
    kick_w = text_width(kicker, KICK_SIZE, MONO_W, KICK_TRACK)
    if kick_w > W - 2 * M:
        print(f'warning: {slug}: the kicker is {kick_w:.0f} wide, more than the {W - 2 * M:.0f} it has')
    return svg, info


def check_report(info):
    rows = [(contrast(_hex(WHITE), ground_at(y)), what, y) for what, y in info['white']]
    return min(rows)


def mirror():
    os.makedirs(MIRROR_DIR, exist_ok=True)
    for manifest in (MANIFEST_ALL, MANIFEST):
        if os.path.exists(manifest):
            shutil.copy2(manifest, os.path.join(MIRROR_DIR, os.path.basename(manifest)))
    for sub in ('covers', 'cover-tools'):
        src, dst = os.path.join(GUIDES_DIR, sub), os.path.join(MIRROR_DIR, sub)
        for root, dirs, files in os.walk(src):
            dirs[:] = [d for d in dirs if d != '__pycache__']
            rel = os.path.relpath(root, src)
            os.makedirs(os.path.join(dst, rel), exist_ok=True)
            for f in files:
                if f.endswith('.pyc') or f == '.DS_Store':
                    continue
                shutil.copy2(os.path.join(root, f), os.path.join(dst, rel, f))
    print(f'mirrored to {MIRROR_DIR}')


def contact_sheet(guides, path):
    big = ''.join(
        f'<figure><img src="file://{os.path.join(COVERS_DIR, g["slug"] + ".svg")}" alt="">'
        f'<figcaption>{i + 1:02d} {escape(g["slug"])}</figcaption></figure>' for i, g in enumerate(guides))
    small = ''.join(f'<img class="s" src="file://{os.path.join(COVERS_DIR, g["slug"] + ".svg")}" alt="">' for g in guides)
    html = f'''<!doctype html><meta charset="utf-8"><title>Guide covers</title>
<style>body{{margin:0;padding:24px;background:#EFEBE7;font:12px ui-monospace,Menlo,monospace;color:#39383D}}
main{{display:grid;grid-template-columns:repeat(7,1fr);gap:18px}}figure{{margin:0}}
img{{display:block;width:100%;aspect-ratio:4/5;border-radius:6px}}figcaption{{margin-top:6px}}
.strip{{display:flex;flex-wrap:wrap;gap:12px;margin-top:32px}}.strip img.s{{width:132px}}</style>
<main>{big}</main><div class="strip">{small}</div>'''
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(html)
    print(f'contact sheet: {path}')


def read_manifest(path):
    with open(path, encoding='utf-8') as fh:
        return json.load(fh)['guides']


def write_manifest(path, guides):
    # The house format of both manifests: two-space indent, ASCII escapes, no final newline.
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(json.dumps({'guides': guides}, indent=2))


def load_guides(shelf_n=None):
    """Every guide that needs a cover, in the all-guides order (newest first).

    guides-all.json is the list of record. guides.json, the shelf, should be its newest few;
    --shelf N rewrites it that way. A shelf entry that is missing from guides-all.json, or
    differs from it, is reported, and its cover is still built.
    """
    if not os.path.exists(MANIFEST_ALL):
        print('note: no guides-all.json, so the covers follow guides.json alone')
        return read_manifest(MANIFEST)
    every = read_manifest(MANIFEST_ALL)
    slugs = [g['slug'] for g in every]
    dupes = sorted({s for s in slugs if slugs.count(s) > 1})
    if dupes:
        sys.exit(f'guides-all.json lists these slugs twice: {", ".join(dupes)}')
    if shelf_n is not None:
        # A guide marked duplicate_of another is the same page under a second address: it keeps
        # its cover (its own gate shows it) but never takes a shelf place.
        shelf = [g for g in every if not g.get('duplicate_of')][:shelf_n]
        if not shelf:
            sys.exit('--shelf needs a number of at least 1, and guides-all.json needs a guide')
        write_manifest(MANIFEST, shelf)
        print(f'guides.json: the newest {len(shelf)} guides ({shelf[0]["slug"]} to {shelf[-1]["slug"]})')
    if os.path.exists(MANIFEST):
        by_slug = {g['slug']: g for g in every}
        for g in read_manifest(MANIFEST):
            if g['slug'] not in by_slug:
                print(f'warning: {g["slug"]} is on the shelf (guides.json) but not in guides-all.json')
                every.append(g)
            elif g != by_slug[g['slug']]:
                print(f'warning: {g["slug"]} differs between guides.json and guides-all.json '
                      f'(run with --shelf N to rebuild the shelf from guides-all.json)')
    return every


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--only', help='build one slug')
    ap.add_argument('--check', action='store_true', help='print the contrast report')
    ap.add_argument('--no-embed', action='store_true', help='skip the embedded font subsets')
    ap.add_argument('--shelf', type=int, metavar='N',
                    help='rewrite guides.json (the shelf) as the newest N guides in guides-all.json')
    ap.add_argument('--mirror', action='store_true', help='copy the outputs to <repo>/guides/')
    ap.add_argument('--sheet', help='write a contact sheet HTML to this path')
    args = ap.parse_args()

    guides = load_guides(args.shelf)
    with open(CONFIG, encoding='utf-8') as fh:
        config = json.load(fh)
    lockup = lockup_parts()
    os.makedirs(COVERS_DIR, exist_ok=True)
    try:
        import fontTools  # noqa: F401
        embed = not args.no_embed
    except ImportError:
        embed = False
        print('fontTools not found: writing covers without embedded font subsets (see README.md)')

    if args.only and args.only not in {g['slug'] for g in guides}:
        sys.exit(f'{args.only} is not in guides-all.json or guides.json')
    prev_kind, written = None, 0
    for g in guides:
        # Neighbours are checked in the all-guides order, which the /guides/ grid and the gate
        # strips use; the shelf is its newest few, so the ring is covered too.
        conf = config.get(g['slug'])
        if not conf:
            sys.exit(f'{g["slug"]}: add an entry to covers.json (a "diagram" and optional "params")')
        if conf['diagram'] == prev_kind:
            print(f'warning: {g["slug"]} uses the same diagram as the guide before it ({prev_kind})')
        prev_kind = conf['diagram']
        if args.only and g['slug'] != args.only:
            continue
        written += 1
        svg, info = build(g, conf, lockup, embed)
        out = os.path.join(COVERS_DIR, f'{g["slug"]}.svg')
        with open(out, 'w', encoding='utf-8') as fh:
            fh.write(svg)
        (bl, bs), (sl, ss) = info['big'], info['small']
        msg = (f'{g["slug"]:10s} {conf["diagram"]:10s} title {len(bl)} line(s) at {bs:g}px, small {len(sl)} at {ss:g}px'
               f'  {len(svg.encode()) / 1024:5.1f} KB')
        if args.check:
            r, what, y = check_report(info)
            msg += f'  worst white on bare ground {r:.2f}:1 ({what}, y{y:.0f})'
        print(msg)
    print(f'wrote {written} cover(s) for {len(guides)} guides')
    known = {g['slug'] for g in guides}
    stale = sorted(f[:-4] for f in os.listdir(COVERS_DIR) if f.endswith('.svg') and f[:-4] not in known)
    if stale:
        print(f'note: covers with no guide in either manifest (left in place): {", ".join(stale)}')
    unused = sorted(set(config) - known)
    if unused:
        print(f'note: covers.json entries with no guide: {", ".join(unused)}')
    if args.sheet:
        contact_sheet(guides, args.sheet)
    if args.mirror:
        mirror()


if __name__ == '__main__':
    main()
