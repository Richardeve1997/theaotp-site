# Guide covers

`make_covers.py` draws one branded cover per guide. The covers show up in three places: the homepage ring, the featured strip on every email gate, and the `/guides/` grid. The script reads `../guides-all.json` (every guide, newest first) and `covers.json` here, and writes `../covers/<slug>.svg` for every guide. If `guides-all.json` is missing it falls back to `../guides.json`. A guide on the shelf that is missing from `guides-all.json` still gets its cover, with a warning.

The spec is the brand's: `assets/brand/clear-sky/DESIGN.md` section 10.6 and the "Guide cover" block in `tokens.css` (both in the content-intelligence repo). If the spec changes, change the constants at the top of `make_covers.py` and rebuild every cover.

## The two manifests

- `../guides-all.json` is the list of record: every gated guide, newest first. This script reads it. Nothing on the site shows it: Rich wants only the newest 15 shown (2026-10-03, "dont go back too far jus the last 15"), so the `/guides/` grid, the homepage ring and the gates' "Also unlocked" count all read `../guides.json`.
- `../guides.json` is the shelf: the newest 15 guides, for the homepage ring, the gate strips and the `/guides/` grid. Don't edit it by hand. `--shelf 15` rewrites it from `guides-all.json` in the same format (two-space indent, no final newline), so the two can't drift apart. Without `--shelf` the script leaves it alone and warns if an entry differs from `guides-all.json`.
- A guide with `duplicate_of` is the same page under a second address: `/review/` is `/switch/` with another title. It keeps its cover, because its own gate shows it, but `--shelf` never gives it a place on the shelf. The grid and the gate counts should skip it too; that filter belongs in `/guides/index.html` and `shelf.js`.

## What a cover is

A 4:5 SVG, 800 x 1000 user units, on `--g-signage-sky` (the deep, even sky that stays dark top to bottom). Sizes are the spec's cqw values times 8:

| Part | Spec | On the 800 canvas |
|---|---|---|
| Margin | 6 cqw | 48 |
| Kicker | Geist Mono 400 caps, 3.9 cqw, tracked .12em, reads `FREE GUIDE · /<slug>` | 31.2 px, top of line box at 48 |
| Title | Inter Tight 400, 10.6 cqw, line height .96, tracking -.04em, balanced, right inset 8 cqw | 84.8 px, top of line box at 116, up to 3 lines in 688 |
| Drawing | one white hairline drawing of the guide's idea, 88 x 50 cqw from 58 cqw down, hairline .42 cqw, one part filled white, no words, numbers or icons | field 704 x 400 at (48, 464), stroke 3.36 |
| Lockup | the supplied white lockup, 40 cqw wide, bottom left on the margin | 320 wide |

Under 200 px wide each cover switches to its small form by itself: the kicker and the lockup drop, the title moves up to 7 cqw and grows to 12.5 cqw, and the white Qualia symbol (11 cqw) takes the lockup's place. The switch is a media query inside the SVG, which the browser checks against the size the cover is drawn at. The hairline never goes under 1 px on screen (`vector-effect: non-scaling-stroke` with `max(1px, .42vw)`, inside `@supports`).

Use a cover through `<img src="/guides/covers/<slug>.svg">` or as a CSS background. Do not paste the SVG inline into a page: inside a page its media query and `vw` stroke would measure the page, not the cover.

## Add a guide

1. Add the guide to the top of `../guides-all.json` (newest first): `slug`, `title` (the guide's own name, in the casing of the page's own `<title>`, so the shelf, the cover and the gate headline match the page), `blurb` (one line on what it gives you, put through the humanizer, no em dashes), `url` (`/<slug>/`), `cover` (`/guides/covers/<slug>.svg`), `topic` (a short tag) and `date` (`YYYY-MM-DD`, the day the page first went live: `git log --diff-filter=A --format=%as -- app/public/<slug>/index.html | tail -1`).
2. Add an entry to `covers.json` with the drawing that fits the guide's idea, and its `params` if it takes any. Pick one that differs from the guides beside it in `guides-all.json`. The script checks neighbours in that order, which the grid and the gate strips use as well, and warns when two neighbours share a drawing.
3. Build, check, refresh the shelf and mirror. `--shelf 15` puts the new guide on the shelf and drops the oldest one off it:

Run it with a Python 3 that has fontTools (`pip install fonttools`; the content-intelligence venv has it):

```
cd app/public/guides/cover-tools
python3 make_covers.py --shelf 15 --check --mirror
python3 make_covers.py --sheet /tmp/sheet.html
```

4. Open the contact sheet in Chrome and look at every new cover at full size and in the 132 px strip (the sheet shows both).

`--mirror` copies both manifests, `covers/` and `cover-tools/` to `<repo>/guides/`. Vite copies `app/public` to the repo root on the next build anyway; the mirror lets the preview server show the new covers before that.

## The drawings

Each one stands for an idea, not a product. Pick by what the guide does.

| Name | Shows | Used by | Params |
|---|---|---|---|
| `org` | an org tree: you, one filled lead, three managers, their agents, one dashed seat | team | |
| `timeline` | a month of releases on a line, one picked, two quieter ones after a gap | new | `pick`, `heights` |
| `cycle3` | three steps on a loop, the first one filled | human | |
| `steps` | a staircase, the top step filled | levelup | |
| `orbit` | a hub with spokes out to a ring of places | reach | `count` |
| `pages` | a page stack read first and saved back to after a chat | projects | |
| `reels` | short videos (frames with a caption line) through one extract step into a document | learn | |
| `converge` | five lanes into one filled circle | solo | |
| `dotgrid` | a grid of skills, one picked, answered in a bubble | pm | |
| `terminal` | a terminal window (a frame and a title rule), cursor filled, keys below | commands | |
| `fan` | input, model, one option picked from four | decision | `pick` |
| `focus` | a tangle straightened into a line to a target, your place tagged on the line | fix | |
| `docs3` | three documents feeding one shared bar | win | |
| `broadcast` | a question, an inspectable answer, sent out | cfo | |
| `ladder` | seven rungs, the one that holds filled | simplify | `hold` |
| `bars` | weekly bars and a rising line | grow | |
| `pies` | three growing pies, the white share shrinking: the last share filled, the earlier ones soft | future | `shares` |
| `duo` | two models looping round one filled spec | review | |
| `pipeline` | five steps in a row, the first filled | agentic | |
| `checklist` | ten boxes, a small square in each yes, the first no filled | ai-native | `ticked` |
| `track` | a loop round one filled file, an arrowhead on each curve | skills | |
| `panes` | two terminals reading one folder | both | `focus` |
| `stepchart` | rounds stepping up, the last far above | instinct | |
| `harness` | a frame with a different model slotted in | glm | |
| `reel` | a vertical video (a card above a tinted speaker window and caption) and its edit tracks | edit | |
| `tiles` | ten tiles, one picked | upskill | `pick` |
| `stack` | layers with the top one filled | agents | |
| `triangle` | a trade-off triangle with a point inside | top1 | |
| `gauge` | a quota gauge and a status line | tokens | `left` |
| `infinity` | a figure-eight loop, the crossing filled | 101 | |
| `toggle` | a switch thrown to the filled side | switch | |

A new idea gets a new `d_<name>` function in `make_covers.py`. Draw it in the 688 x 440 drawing box with the `Cover` primitives (`rect`, `circle`, `path`, `link`, `arrow`, `bar`, `window`), give exactly one part `mode='fill'`, and register it in `DIAGRAMS`. `mode='node'` draws a hollow node that hides the lines under it, and `mode='soft'` draws a 12% white tint with a hairline edge. Keep to plain geometry: no words, numbers, logos or pictograms, so no play buttons, ticks, flags, window lights or prompt chevrons. A yes on a checklist is a small quiet square, and a window is a frame with a title rule.

Quiet marks keep a floor of .42 opacity for lines and .4 for bars, the same floor as the Reel diagrams (DESIGN.md 10.6 sets both). They are texture, hidden from screen readers, and they fall below the 3 : 1 that graphics need: a .42 line works out at about 2.5 : 1 at the top of the field and 2.0 : 1 at its foot. That is on purpose. The full-strength hairlines, the edges of the soft shapes and the filled part carry the drawing, and they clear 3 : 1 everywhere (see Checked).

## Fonts

`fonts/` holds Latin subsets of Inter Tight 400 (v3.004) and Geist Mono 400 (v1.700), both under the SIL Open Font License (texts beside them), plus their advance widths for line breaking. Each cover embeds a subset of just the characters it uses, because a browser blocks the Google Fonts `@import` inside an SVG shown as an image (the `@import` is still there for when a cover is opened on its own). A title with a character outside the Latin subsets falls back to Helvetica Neue or Arial for that character: check it on the sheet. Without fontTools the script still runs but skips the embedded subsets.

## Rebuilds are byte-stable

The font subsets keep the bundled fonts' own `head.modified` date (`recalcTimestamp=False`), so running the script again writes identical bytes and a diff shows only covers that really changed. Check it after any change to the script: copy `../covers/` aside, run it again, and `diff -rq` the two.

## Checked

The check on 3 October 2026 ran all 31 covers in Google Chrome at 1x and 2x and read the lightest pixel behind each part. White measures 8.0 : 1 at worst behind the title and 9.7 : 1 behind the kicker. Behind the drawing the ground is 4.9 : 1 at its lightest, at the foot of the field, and behind the lockup it is 4.6 : 1. A full-strength hairline over a 12% soft tint works out at 4.0 : 1 at the field foot (computed, not measured). Graphics need 3 : 1 and small text 4.5 : 1. The same run looked at both forms by eye: the small form at 132 px, the large form at 248 px and 800 px.
