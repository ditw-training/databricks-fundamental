#!/usr/bin/env python3
"""Build the static Workshop Guide: one self-contained HTML page per guide file.

For environments without the Databricks App (self-study, Free Edition). Reads
notebooks/workshops/guide/*.json (contract: apps/SPEC_workshop_guide.md, section 3),
validates each guide like the app does, writes html/<id>.html with inline CSS and
JS (no CDN, works from file://), then re-reads the output and checks its structure.

Usage (from the repo root or any directory, Python 3.9+, standard library only):
    python3 -I notebooks/workshops/guide/build_static.py
    python3 -I notebooks/workshops/guide/build_static.py --out DIR ws_delta.json
    python3 -I notebooks/workshops/guide/build_static.py --check   # verify only

Exit code 0 when every guide is valid and every page passes the structure check.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_OUT = HERE / "html"

ID_PATTERN = re.compile(r"^[a-z0-9_]+$")
BLANK_PATTERN = re.compile(r"\{\{(b\d+)\}\}")
STEP_TYPES = ("fill", "order", "match", "code")
TYPE_LABELS = {"fill": "Fill in", "order": "Order", "match": "Match", "code": "Code"}


# --------------------------------------------------------------------------- validation

def validate_guide(guide: dict, name: str) -> list[str]:
    """Same rules as apps/workshop-guide/shared/guide-schema.ts. Returns error strings."""
    errors: list[str] = []

    def err(where: str, msg: str) -> None:
        errors.append(f"{name}: {where}: {msg}")

    for key in ("id", "title", "notebook", "steps"):
        if key not in guide:
            err("guide", f"missing '{key}'")
    if errors:
        return errors
    if not ID_PATTERN.match(guide["id"]):
        err("guide", f"id '{guide['id']}' must be lowercase letters, digits, underscore")
    if not guide["steps"]:
        err("guide", "no steps")

    seen: set[str] = set()
    for i, step in enumerate(guide["steps"]):
        sid = step.get("id", f"#{i}")
        where = f"step {sid}"
        for key in ("id", "title", "type", "explain"):
            if not step.get(key):
                err(where, f"missing '{key}'")
        if not ID_PATTERN.match(str(sid)):
            err(where, "step id: lowercase letters, digits, underscore")
        if sid in seen:
            err(where, "duplicate step id")
        seen.add(sid)
        stype = step.get("type")
        if stype not in STEP_TYPES:
            err(where, f"unknown type '{stype}'")
            continue
        if step.get("optional") and stype != "code":
            err(where, "optional step must be type 'code'")
        if len(step.get("hints", [])) > 5 or len(step.get("docs", [])) > 5:
            err(where, "at most 5 hints and 5 docs")
        for doc in step.get("docs", []):
            if not doc.get("label") or not str(doc.get("url", "")).startswith(("https://", "http://")):
                err(where, f"bad doc link {doc!r}")
        check = step.get("check", "app" if stype in ("order", "match") else "notebook")
        allowed = {"fill": {"notebook"}, "code": {"notebook"}, "match": {"app"}, "order": {"notebook", "app"}}
        if check not in allowed[stype]:
            err(where, f"check '{check}' not allowed for type '{stype}'")

        if stype == "fill":
            template = step.get("template", "")
            blanks = step.get("blanks", {})
            in_template = set(BLANK_PATTERN.findall(template))
            for b in in_template - set(blanks):
                err(where, f"blank {{{{{b}}}}} has no answers")
            for b in set(blanks) - in_template:
                err(where, f"blank '{b}' is not used in template")
            for b, spec in blanks.items():
                if not re.match(r"^b\d+$", b) or not spec.get("answers"):
                    err(where, f"blank '{b}' needs id bN and at least one answer")
        elif stype == "order":
            ids = [b.get("id") for b in step.get("blocks", [])]
            solution, distractors = step.get("solution", []), step.get("distractors", [])
            if len(ids) < 2 or len(solution) < 2:
                err(where, "order needs at least 2 blocks and 2 solution ids")
            if len(set(ids)) != len(ids):
                err(where, "duplicate block ids")
            for bid in solution + distractors:
                if bid not in ids:
                    err(where, f"unknown block id '{bid}'")
            if set(solution) & set(distractors):
                err(where, "blocks both in solution and distractors")
            for bid in ids:
                if bid not in solution and bid not in distractors:
                    err(where, f"block '{bid}' is neither solution nor distractor")
        elif stype == "match":
            pairs = step.get("pairs", [])
            if len(pairs) < 2 or not all(p.get("left") and p.get("right") for p in pairs):
                err(where, "match needs at least 2 pairs with left and right")
    return errors


# --------------------------------------------------------------------------- markdown

def _inline(text: str) -> str:
    """Inline markdown subset on raw text: `code`, **bold**, *italic*, [label](url)."""
    out: list[str] = []
    for i, part in enumerate(re.split(r"(`[^`\n]+`)", text)):
        if i % 2 == 1:
            out.append(f"<code>{html.escape(part[1:-1], quote=False)}</code>")
            continue
        s = html.escape(part, quote=False)
        s = re.sub(
            r"\[([^\]\n]+)\]\((https?://[^)\s]+)\)",
            lambda m: f'<a href="{html.escape(m.group(2))}" target="_blank" rel="noopener noreferrer">{m.group(1)}</a>',
            s,
        )
        s = re.sub(r"\*\*([^*\n]+)\*\*", r"<strong>\1</strong>", s)
        s = re.sub(r"(?<![\w*])\*([^*\n]+?)\*(?![\w*])", r"<em>\1</em>", s)
        out.append(s)
    return "".join(out)


def code_block(code: str, language: str = "", copy: bool = True) -> str:
    lang = f' data-lang="{html.escape(language)}"' if language else ""
    btn = (
        '<button type="button" class="btn btn-ghost btn-copy" data-copy>Copy</button>'
        if copy
        else ""
    )
    return (
        f'<div class="codeblock"{lang}>{btn}'
        f"<pre><code>{html.escape(code.rstrip(), quote=False)}</code></pre></div>"
    )


def markdown(text: str) -> str:
    """Small markdown subset used by the guide files: paragraphs, lists, fences, inline."""
    blocks: list[str] = []
    parts = re.split(r"```([\w-]*)\n(.*?)\n?```", text, flags=re.S)
    for i in range(0, len(parts), 3):
        prose = parts[i]
        for para in re.split(r"\n\s*\n", prose):
            para = para.strip()
            if not para:
                continue
            lines = para.split("\n")
            if all(re.match(r"^\s*[-*] ", ln) for ln in lines):
                items = "".join(f"<li>{_inline(re.sub(r'^\s*[-*] ', '', ln))}</li>" for ln in lines)
                blocks.append(f"<ul>{items}</ul>")
            else:
                blocks.append("<p>" + "<br>".join(_inline(ln) for ln in lines) + "</p>")
        if i + 2 < len(parts):
            blocks.append(code_block(parts[i + 2], parts[i + 1]))
    return "".join(blocks)


def hint_html(hint: str, is_solution: bool, language: str) -> str:
    """A solution hint written as bare code (no backticks) is shown as a code block."""
    if is_solution and "`" not in hint:
        return code_block(hint, language)
    return markdown(hint)


# --------------------------------------------------------------------------- page parts

def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def seeded_shuffle(items: list, seed: str) -> list:
    """Port of seededShuffle in apps/workshop-guide/client/src/lib/exercise.ts."""
    h = 2166136261
    for ch in seed:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF

    def rand() -> float:
        nonlocal h
        h ^= (h << 13) & 0xFFFFFFFF
        h ^= h >> 17
        h ^= (h << 5) & 0xFFFFFFFF
        return (h % 1_000_000) / 1_000_000

    out = list(items)
    for i in range(len(out) - 1, 0, -1):
        j = int(rand() * (i + 1))
        out[i], out[j] = out[j], out[i]
    return out


def shuffled_not_solved(items: list, seed: str, solved) -> list:
    """Shuffle, and rotate if the shuffle happens to equal the answer."""
    out = seeded_shuffle(items, seed)
    if len(out) > 1 and solved(out):
        out = out[1:] + out[:1]
    return out


def blank_width(spec: dict) -> int:
    return spec.get("width") or max(4, *(len(a) for a in spec["answers"])) + 2


def render_fill(step: dict) -> str:
    sid = step["id"]
    blanks = step["blanks"]
    order = list(dict.fromkeys(BLANK_PATTERN.findall(step["template"])))
    pieces: list[str] = []
    last = 0
    for m in BLANK_PATTERN.finditer(step["template"]):
        pieces.append(html.escape(step["template"][last : m.start()], quote=False))
        bid = m.group(1)
        n = order.index(bid) + 1
        width = blank_width(blanks[bid])
        pieces.append(
            f'<input class="blank" type="text" id="{sid}-{bid}" data-blank="{bid}" '
            f'aria-label="Blank {n} of {len(order)}" autocomplete="off" autocapitalize="off" '
            f'autocorrect="off" spellcheck="false" style="width:{width + 1}ch">'
        )
        last = m.end()
    pieces.append(html.escape(step["template"][last:], quote=False))
    return (
        '<div class="exercise exercise-fill">'
        '<p class="ex-instr">Type the missing parts. Each blank turns green when it is right.</p>'
        f'<div class="codeblock codeblock-fill" data-lang="{esc(step.get("language", ""))}">'
        f'<pre><code>{"".join(pieces)}</code></pre></div>'
        '<div class="ex-bar"><p class="ex-status" data-status aria-live="polite"></p>'
        '<span class="ex-actions">'
        '<button type="button" class="btn" data-copy-assembled>Copy code</button>'
        '<button type="button" class="btn btn-ghost" data-reset-ex>Clear</button>'
        "</span></div></div>"
    )


def render_block_item(block: dict) -> str:
    bid = esc(block["id"])
    return (
        f'<li class="block" data-block="{bid}" draggable="true">'
        '<span class="grip" aria-hidden="true">⋮⋮</span>'
        f'<pre class="block-code"><code>{html.escape(block["code"], quote=False)}</code></pre>'
        '<span class="block-actions">'
        '<button type="button" class="btn btn-icon" data-act="add" aria-label="Add to your answer">Add</button>'
        '<button type="button" class="btn btn-icon" data-act="up" aria-label="Move up">↑</button>'
        '<button type="button" class="btn btn-icon" data-act="down" aria-label="Move down">↓</button>'
        '<button type="button" class="btn btn-icon" data-act="remove" aria-label="Remove from your answer">✕</button>'
        "</span></li>"
    )


def render_order(step: dict) -> str:
    sid = step["id"]
    blocks = shuffled_not_solved(step["blocks"], sid, lambda xs: [b["id"] for b in xs] == step["solution"])
    n_traps = len(step.get("distractors", []))
    traps = f" {n_traps} block{'s are' if n_traps != 1 else ' is'} a trap and must stay out." if n_traps else ""
    return (
        '<div class="exercise exercise-order">'
        '<p class="ex-instr">Drag blocks into <em>Your answer</em> in the right order, or use the '
        f"Add, ↑, ↓ and ✕ buttons.{traps}</p>"
        '<div class="order-grid">'
        f'<div class="order-col"><h4 class="col-title" id="{sid}-pool-t">Available blocks</h4>'
        f'<ul class="blocklist pool" data-list="pool" aria-labelledby="{sid}-pool-t">'
        + "".join(render_block_item(b) for b in blocks)
        + "</ul></div>"
        f'<div class="order-col"><h4 class="col-title" id="{sid}-ans-t">Your answer</h4>'
        f'<ol class="blocklist answer" data-list="answer" aria-labelledby="{sid}-ans-t">'
        '</ol><p class="empty-note">Drop blocks here.</p></div></div>'
        '<div class="ex-bar"><p class="ex-status" data-status aria-live="polite"></p>'
        '<span class="ex-actions">'
        '<button type="button" class="btn btn-primary" data-check-order>Check order</button>'
        '<button type="button" class="btn" data-copy-assembled>Copy code</button>'
        '<button type="button" class="btn btn-ghost" data-reset-ex>Start over</button>'
        "</span></div></div>"
    )


def render_match(step: dict) -> str:
    sid = step["id"]
    pairs = step["pairs"]
    idx = list(range(len(pairs)))
    terms = shuffled_not_solved(idx, sid + ":terms", lambda xs: xs == idx)
    slots = seeded_shuffle(idx, sid + ":slots")
    options = '<option value="">Choose…</option>' + "".join(
        f'<option value="{t}">{esc(pairs[t]["left"])}</option>' for t in terms
    )
    chips = "".join(
        f'<li class="chip" draggable="true" data-term="{t}"><code>{esc(pairs[t]["left"])}</code></li>'
        for t in terms
    )
    rows = "".join(
        f'<li class="match-row" data-slot="{s}">'
        f'<label class="match-desc" for="{sid}-slot{s}">{_inline(pairs[s]["right"])}</label>'
        f'<span class="dropzone" data-drop="{s}"><select id="{sid}-slot{s}" class="match-select">{options}</select>'
        '<span class="mark" aria-hidden="true"></span></span></li>'
        for s in slots
    )
    return (
        '<div class="exercise exercise-match">'
        '<p class="ex-instr">Drag each term onto its description, or pick it from the list next to the description.</p>'
        f'<h4 class="col-title" id="{sid}-terms-t">Terms</h4>'
        f'<ul class="chips" aria-labelledby="{sid}-terms-t">{chips}</ul>'
        f'<ol class="match-list">{rows}</ol>'
        '<div class="ex-bar"><p class="ex-status" data-status aria-live="polite"></p>'
        '<span class="ex-actions">'
        '<button type="button" class="btn btn-primary" data-check-match>Check answers</button>'
        '<button type="button" class="btn btn-ghost" data-reset-ex>Start over</button>'
        "</span></div></div>"
    )


def render_code(step: dict) -> str:
    starter = step.get("starter")
    body = (
        '<p class="ex-instr">Write the code in the notebook cell. The cell starts like this:</p>'
        + code_block(starter, step.get("language", ""))
        if starter
        else '<p class="ex-instr">Write the code in the notebook cell from scratch.</p>'
    )
    return (
        '<div class="exercise exercise-code">'
        + body
        + '<p class="ex-instr">Stuck? Open the hints one at a time below; the last one is the full solution.</p></div>'
    )


RENDERERS = {"fill": render_fill, "order": render_order, "match": render_match, "code": render_code}


def render_step(guide: dict, step: dict, number: int) -> str:
    sid, stype = step["id"], step["type"]
    check = step.get("check", "app" if stype in ("order", "match") else "notebook")
    optional = step.get("optional", False)
    badges = f'<span class="badge">{TYPE_LABELS[stype]}</span>'
    if optional:
        badges += '<span class="badge badge-opt">⭐ OPTIONAL</span>'
    hints = step.get("hints", [])
    hint_items = "".join(
        f'<li class="hint{" hint-solution" if (i == len(hints) - 1 and len(hints) > 1) else ""}" data-hint="{i}">'
        f'<span class="hint-label">{"Solution" if (i == len(hints) - 1 and len(hints) > 1) else f"Hint {i + 1}"}</span>'
        f"{hint_html(h, i == len(hints) - 1 and len(hints) > 1, step.get('language', ''))}</li>"
        for i, h in enumerate(hints)
    )
    hints_html = (
        f'<section class="hints" aria-labelledby="{sid}-hints-t">'
        f'<h4 class="sec-title" id="{sid}-hints-t">Hints <span class="muted" data-hint-count>'
        f"{len(hints)} available</span></h4>"
        f'<ol class="hint-list">{hint_items}</ol>'
        '<div class="hint-controls">'
        '<button type="button" class="btn" data-hint-next hidden>Show a hint</button>'
        '<span class="confirm" data-confirm hidden role="group" aria-label="Confirm">'
        '<span>Show the full solution? You learn more by trying once more with the hints you have.</span>'
        '<button type="button" class="btn btn-primary" data-confirm-yes>Show solution</button>'
        '<button type="button" class="btn btn-ghost" data-confirm-no>Keep trying</button>'
        "</span></div></section>"
        if hints
        else ""
    )
    docs = step.get("docs", [])
    docs_html = (
        f'<section class="docs" aria-labelledby="{sid}-docs-t"><h4 class="sec-title" id="{sid}-docs-t">Docs</h4><ul>'
        + "".join(
            f'<li><a href="{esc(d["url"])}" target="_blank" rel="noopener noreferrer">{esc(d["label"])}</a></li>'
            for d in docs
        )
        + "</ul></section>"
        if docs
        else ""
    )
    expected = (
        f'<section class="expected"><h4 class="sec-title">Expected result</h4>{markdown(step["expected"])}</section>'
        if step.get("expected")
        else ""
    )
    call = f'check("{guide["id"]}", "{sid}")'
    if check == "notebook":
        finish = (
            '<section class="finish">'
            '<h4 class="sec-title">Check it in the notebook</h4>'
            f'<p>Run the cell <code>{esc(call)}</code> under this step in <code>{esc(Path(guide["notebook"]).stem)}</code>. '
            "When it prints <strong>PASS</strong>, tick the box.</p>"
            f'<label class="done-toggle"><input type="checkbox" data-done> <span><code>{esc(call)}</code> passed in my notebook</span></label>'
            "</section>"
        )
    else:
        finish = (
            '<section class="finish"><h4 class="sec-title">Graded here</h4>'
            "<p>This step is checked on this page: it is done when all answers are right.</p></section>"
        )
    return (
        f'<section class="step" id="step-{sid}" data-step="{sid}" data-type="{stype}" data-check="{check}"'
        f' data-optional="{"true" if optional else "false"}" aria-labelledby="{sid}-title">'
        '<header class="step-head">'
        f'<span class="step-num" aria-hidden="true">{number:02d}</span>'
        f'<div><h3 id="{sid}-title" class="step-title">Step {number:02d} — {esc(step["title"])}</h3>'
        f'<div class="badges">{badges}<span class="state" data-state>Not started</span></div></div>'
        "</header>"
        f'<div class="md explain">{markdown(step["explain"])}</div>'
        f"{RENDERERS[stype](step)}{expected}{hints_html}{docs_html}{finish}"
        "</section>"
    )


def render_nav(guide: dict) -> str:
    items = []
    for n, step in enumerate(guide["steps"], 1):
        opt = ' <span class="nav-opt" title="Optional">⭐</span>' if step.get("optional") else ""
        items.append(
            f'<li><a href="#step-{step["id"]}" data-nav="{step["id"]}">'
            '<span class="dot" aria-hidden="true"></span>'
            f'<span class="nav-num">{n:02d}</span><span class="nav-title">{esc(step["title"])}</span>{opt}'
            f'<span class="sr-only" data-nav-state>, not started</span></a></li>'
        )
    return "".join(items)


def client_data(guide: dict) -> str:
    """Only what the page needs for grading; answers are in the page by design (self-study)."""
    steps = []
    for step in guide["steps"]:
        s = {
            "id": step["id"],
            "type": step["type"],
            "check": step.get("check", "app" if step["type"] in ("order", "match") else "notebook"),
            "optional": bool(step.get("optional")),
            "hints": len(step.get("hints", [])),
        }
        if step["type"] == "fill":
            s["template"] = step["template"]
            s["blanks"] = {
                k: {"answers": v["answers"], "case_sensitive": bool(v.get("case_sensitive", False))}
                for k, v in step["blanks"].items()
            }
        elif step["type"] == "order":
            s["blocks"] = [{"id": b["id"], "code": b["code"]} for b in step["blocks"]]
            s["solution"] = step["solution"]
            s["distractors"] = step.get("distractors", [])
        elif step["type"] == "match":
            s["pairs"] = step["pairs"]
        steps.append(s)
    payload = {"id": guide["id"], "steps": steps}
    # < keeps "</script>" and "<!--" out of the inline script; still valid JSON.
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


CSS = r"""
:root{
  --bg:#ffffff;--surface:#f7f7f8;--surface-2:#efeff1;--fg:#18181b;--muted:#5d5d66;
  --border:#e2e2e6;--code-bg:#f6f6f7;--code-border:#e3e3e7;
  --accent:#E30613;--accent-soft:rgba(227,6,19,.09);
  --ok:#147a3d;--ok-soft:rgba(20,122,61,.10);--bad:#b42318;--bad-soft:rgba(180,35,24,.09);
  --warn:#8a5a00;--warn-soft:rgba(176,120,0,.12);--focus:#E30613;--shadow:0 1px 2px rgba(0,0,0,.05);
  color-scheme:light dark;
}
@media (prefers-color-scheme:dark){
  :root{
    --bg:#111114;--surface:#18181c;--surface-2:#202026;--fg:#ececf0;--muted:#a2a2ad;
    --border:#2c2c33;--code-bg:#16161a;--code-border:#2e2e36;
    --accent:#ff3b47;--accent-soft:rgba(255,59,71,.13);
    --ok:#4ade80;--ok-soft:rgba(74,222,128,.12);--bad:#f87171;--bad-soft:rgba(248,113,113,.12);
    --warn:#fbbf24;--warn-soft:rgba(251,191,36,.12);--focus:#ff5a64;--shadow:none;
  }
}
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important}}
body{margin:0;background:var(--bg);color:var(--fg);
  font:15px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased}
code,pre,input.blank,select{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace}
a{color:inherit;text-underline-offset:2px}
a:hover{color:var(--accent)}
:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.skip{position:absolute;left:-999px;top:8px;background:var(--fg);color:var(--bg);padding:6px 12px;border-radius:6px;z-index:10}
.skip:focus{left:12px}
.accent-bar{height:3px;background:var(--accent)}
.topbar{border-bottom:1px solid var(--border);background:var(--bg)}
.topbar-inner{max-width:1180px;margin:0 auto;padding:14px 16px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.logo{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:7px;background:var(--fg);color:var(--bg);
  font-weight:700;font-size:13px;box-shadow:inset 0 -3px 0 var(--accent);flex:none}
.brand{display:flex;gap:10px;align-items:center;min-width:0;flex:1}
.brand h1{font-size:17px;line-height:1.3;margin:0;font-weight:650}
.brand .sub{font-size:12.5px;color:var(--muted)}
.overall{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--muted)}
.bar{width:140px;height:6px;border-radius:99px;background:var(--surface-2);overflow:hidden}
.bar>span{display:block;height:100%;width:0;background:var(--accent);transition:width .25s}
.layout{max-width:1180px;margin:0 auto;padding:20px 16px 64px;display:grid;grid-template-columns:250px minmax(0,1fr);gap:32px}
nav.steps-nav{position:sticky;top:12px;align-self:start;max-height:calc(100vh - 24px);overflow:auto}
.nav-title-h{font-size:11.5px;font-weight:650;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:4px 8px 8px}
.steps-nav ol{list-style:none;margin:0;padding:0}
.steps-nav a{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:7px;text-decoration:none;font-size:13.5px;color:var(--muted)}
.steps-nav a:hover{background:var(--surface);color:var(--fg)}
.steps-nav a[aria-current="true"]{background:var(--surface-2);color:var(--fg);box-shadow:inset 2px 0 0 var(--accent)}
.nav-num{font-variant-numeric:tabular-nums;font-size:12px;opacity:.8}
.nav-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nav-opt{font-size:11px}
.dot{width:10px;height:10px;border-radius:99px;border:2px solid var(--muted);opacity:.6;flex:none}
[data-status-v="progress"] .dot{border-color:var(--warn);background:var(--warn-soft);opacity:1}
[data-status-v="ready"] .dot{border-color:var(--warn);background:var(--warn);opacity:1}
[data-status-v="done"] .dot{border-color:var(--ok);background:var(--ok);opacity:1}
.nav-tools{margin:14px 8px 0;display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:var(--muted)}
main{min-width:0}
.notice{border:1px solid var(--border);border-left:3px solid var(--accent);background:var(--surface);border-radius:8px;
  padding:12px 14px;margin:0 0 18px;font-size:14px}
.notice p{margin:0 0 6px}.notice p:last-child{margin:0}
.intro{font-size:15.5px;margin:0 0 26px}
.intro p{margin:0 0 8px}
.legend{display:flex;flex-wrap:wrap;gap:14px;font-size:12.5px;color:var(--muted);margin:-12px 0 24px}
.legend span{display:inline-flex;align-items:center;gap:6px}
.legend .dot{display:inline-block}
.step{border:1px solid var(--border);border-radius:12px;padding:20px 22px;margin:0 0 22px;background:var(--bg);box-shadow:var(--shadow);scroll-margin-top:12px}
.step-head{display:flex;gap:14px;align-items:flex-start;margin-bottom:8px}
.step-num{flex:none;font-weight:700;font-size:13px;width:34px;height:34px;border-radius:9px;display:grid;place-items:center;
  background:var(--surface-2);color:var(--muted);font-variant-numeric:tabular-nums}
.step[data-status-v="done"] .step-num{background:var(--ok-soft);color:var(--ok)}
.step-title{font-size:18px;line-height:1.35;margin:4px 0 6px;font-weight:650}
.badges{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.badge,.state{font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:99px;border:1px solid var(--border);color:var(--muted);background:var(--surface)}
.badge-opt{color:var(--warn);border-color:transparent;background:var(--warn-soft)}
.state{border-color:transparent}
[data-status-v="progress"] .state,[data-status-v="ready"] .state{color:var(--warn);background:var(--warn-soft)}
[data-status-v="done"] .state{color:var(--ok);background:var(--ok-soft)}
.md p,.explain p{margin:0 0 10px}
.md code,.explain code,.hint code,.expected code,.finish code,.notice code,.intro code,.match-desc code{
  font-size:.88em;background:var(--surface-2);border-radius:4px;padding:1px 5px;overflow-wrap:anywhere}
.sec-title{font-size:11.5px;font-weight:650;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:20px 0 8px}
.sec-title .muted{text-transform:none;letter-spacing:0;font-weight:500;margin-left:6px}
.col-title{font-size:12.5px;font-weight:650;margin:0 0 6px;color:var(--muted)}
.exercise{margin:14px 0 4px}
.ex-instr{font-size:14px;color:var(--muted);margin:0 0 10px}
.codeblock{position:relative;border:1px solid var(--code-border);background:var(--code-bg);border-radius:8px;margin:0 0 10px}
.codeblock pre{margin:0;padding:12px 14px;overflow-x:auto;font-size:13px;line-height:1.55;tab-size:4}
.codeblock pre code{background:none;padding:0;font-size:inherit}
.codeblock .btn-copy{position:absolute;top:6px;right:6px;font-size:12px;padding:2px 9px;opacity:.85}
.codeblock[data-lang]::before{content:attr(data-lang);position:absolute;top:-9px;left:10px;font-size:10.5px;padding:0 6px;
  border-radius:4px;background:var(--bg);color:var(--muted);border:1px solid var(--code-border);text-transform:uppercase;letter-spacing:.05em}
.codeblock-fill pre{white-space:pre;line-height:2.1}
input.blank{font-size:13px;padding:1px 5px;margin:0 1px;border:1.5px dashed var(--muted);border-radius:5px;background:var(--bg);
  color:var(--fg);vertical-align:baseline;max-width:60ch}
input.blank:focus{border-style:solid;border-color:var(--focus);outline:none;box-shadow:0 0 0 3px var(--accent-soft)}
input.blank[data-state="correct"]{border:1.5px solid var(--ok);background:var(--ok-soft)}
input.blank[data-state="wrong"]{border:1.5px solid var(--bad);background:var(--bad-soft)}
.ex-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-top:8px}
.ex-status{margin:0;font-size:13.5px;min-height:1.4em;color:var(--muted)}
.ex-status[data-tone="ok"]{color:var(--ok)}.ex-status[data-tone="bad"]{color:var(--bad)}
.ex-actions{display:flex;gap:8px;flex-wrap:wrap}
.btn{font:inherit;font-size:13px;font-weight:550;padding:5px 12px;border-radius:7px;border:1px solid var(--border);
  background:var(--bg);color:var(--fg);cursor:pointer;line-height:1.4}
.btn:hover{background:var(--surface)}
.btn-primary{background:var(--fg);color:var(--bg);border-color:var(--fg)}
.btn-primary:hover{background:var(--fg);opacity:.88}
.btn-ghost{border-color:transparent;background:transparent;color:var(--muted)}
.btn-ghost:hover{color:var(--fg);background:var(--surface)}
.btn-icon{padding:2px 8px;min-width:30px;font-size:12.5px}
.order-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.order-col{min-width:0;position:relative}
.blocklist{list-style:none;margin:0;padding:8px;min-height:64px;border:1.5px dashed var(--border);border-radius:9px;background:var(--surface)}
.blocklist.drag-over{border-color:var(--accent);background:var(--accent-soft)}
.answer{counter-reset:pos}
.block{display:flex;align-items:flex-start;gap:8px;padding:7px 8px;margin:0 0 6px;border:1px solid var(--code-border);
  border-radius:7px;background:var(--code-bg);cursor:grab}
.block:last-child{margin-bottom:0}
.block.dragging{opacity:.45}
.answer .block::before{counter-increment:pos;content:counter(pos);font-size:11px;font-weight:700;color:var(--muted);min-width:14px;padding-top:2px}
.block[data-mark="ok"]{border-color:var(--ok)}.block[data-mark="bad"]{border-color:var(--bad);background:var(--bad-soft)}
.grip{color:var(--muted);font-size:12px;letter-spacing:-2px;padding-top:2px;user-select:none}
.block-code{margin:0;flex:1;min-width:0;font-size:12.5px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
.block-actions{display:flex;gap:4px;flex:none}
.pool [data-act="up"],.pool [data-act="down"],.pool [data-act="remove"],.answer [data-act="add"]{display:none}
.empty-note{position:absolute;left:0;right:0;top:44px;text-align:center;font-size:13px;color:var(--muted);pointer-events:none;margin:0}
.answer:not(:empty)+.empty-note{display:none}
.chips{list-style:none;margin:0 0 14px;padding:0;display:flex;flex-wrap:wrap;gap:8px}
.chip{border:1px solid var(--code-border);background:var(--code-bg);border-radius:7px;padding:4px 9px;cursor:grab;font-size:12.5px}
.chip code{background:none;padding:0;font-size:inherit}
.chip[data-used="true"]{opacity:.45}
.chip.dragging{opacity:.3}
.match-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.match-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:12px;align-items:center;padding:8px 10px;
  border:1px solid var(--border);border-radius:9px}
.match-desc{font-size:14px}
.dropzone{display:flex;align-items:center;gap:8px;border:1.5px dashed transparent;border-radius:8px;padding:2px}
.dropzone.drag-over{border-color:var(--accent);background:var(--accent-soft)}
.match-select{width:100%;font-size:12.5px;padding:6px 8px;border-radius:7px;border:1px solid var(--border);background:var(--bg);color:var(--fg)}
.mark{width:18px;flex:none;font-weight:700;text-align:center}
.match-row[data-mark="ok"]{border-color:var(--ok)}.match-row[data-mark="ok"] .mark::before{content:"✓";color:var(--ok)}
.match-row[data-mark="bad"]{border-color:var(--bad)}.match-row[data-mark="bad"] .mark::before{content:"✕";color:var(--bad)}
.expected{border-radius:8px}
.expected p{margin:0}
.hint-list{list-style:none;margin:0 0 10px;padding:0;display:flex;flex-direction:column;gap:8px}
.hint{border:1px solid var(--border);border-radius:8px;padding:9px 12px;background:var(--surface)}
.hint p{margin:0 0 6px}.hint p:last-child{margin:0}
.hint .codeblock{margin:6px 0 0}
.hint-label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:3px}
.hint-solution{border-color:var(--warn);background:var(--warn-soft)}
.hint-solution .hint-label{color:var(--warn)}
.hint-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.confirm{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:13.5px;border:1px solid var(--warn);background:var(--warn-soft);
  border-radius:8px;padding:8px 10px}
.confirm[hidden],[hidden]{display:none!important}
.docs ul{margin:0;padding-left:18px}
.docs li{margin:2px 0}
.finish{border-top:1px solid var(--border);margin-top:18px;padding-top:2px}
.finish p{margin:0 0 8px;font-size:14px}
.done-toggle{display:inline-flex;gap:8px;align-items:center;font-size:14px;cursor:pointer;padding:6px 10px;border:1px solid var(--border);border-radius:8px}
.done-toggle input{width:16px;height:16px;accent-color:var(--ok)}
.step[data-status-v="done"] .done-toggle{border-color:var(--ok);background:var(--ok-soft)}
footer.foot{font-size:12.5px;color:var(--muted);margin-top:30px}
@media (max-width:900px){
  .layout{grid-template-columns:1fr;gap:12px}
  nav.steps-nav{position:static;max-height:none;border:1px solid var(--border);border-radius:10px;padding:8px}
  .steps-nav ol{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr))}
}
@media (max-width:640px){
  .order-grid{grid-template-columns:1fr}
  .match-row{grid-template-columns:1fr}
  .step{padding:16px 14px}
  .step-num{display:none}
  .bar{width:90px}
}
@media print{
  .accent-bar,nav.steps-nav,.ex-actions,.hint-controls,.btn-copy,.notice{display:none}
  .layout{display:block}.hint[hidden]{display:block!important}
}
"""

LOGIC_JS = r"""
/* Pure grading logic: port of apps/workshop-guide/client/src/lib/exercise.ts. */
var WG = (function () {
  function normalize(value, caseSensitive) {
    var collapsed = String(value).trim().replace(/\s+/g, ' ');
    return caseSensitive ? collapsed : collapsed.toLowerCase();
  }
  function isBlankCorrect(value, blank) {
    if (!String(value || '').trim()) return false;
    var typed = normalize(value, blank.case_sensitive);
    return blank.answers.some(function (a) { return normalize(a, blank.case_sensitive) === typed; });
  }
  function blankState(value, blank) {
    if (!String(value || '').trim()) return 'empty';
    return isBlankCorrect(value, blank) ? 'correct' : 'wrong';
  }
  function assembleFill(step, values) {
    return step.template.replace(/\{\{(b\d+)\}\}/g, function (_, id) {
      var v = (values[id] || '').trim();
      return v || '____';
    });
  }
  function fillProgress(step, values) {
    var ids = Object.keys(step.blanks);
    var correct = ids.filter(function (id) { return isBlankCorrect(values[id] || '', step.blanks[id]); }).length;
    return { correct: correct, total: ids.length };
  }
  function checkOrder(step, answer) {
    var total = step.solution.length;
    var pass = answer.length === total && answer.every(function (id, i) { return id === step.solution[i]; });
    var correctPositions = answer.filter(function (id, i) { return step.solution[i] === id; }).length;
    var distractorsUsed = answer.filter(function (id) { return step.distractors.indexOf(id) >= 0; }).length;
    var missing = step.solution.filter(function (id) { return answer.indexOf(id) < 0; }).length;
    var message;
    if (pass) {
      message = 'Correct order: all ' + total + ' blocks in place.';
    } else {
      var parts = [correctPositions + ' of ' + total + ' blocks in the right place.'];
      if (distractorsUsed > 0) parts.push(distractorsUsed + ' block' + (distractorsUsed > 1 ? 's do' : ' does') + ' not belong here.');
      if (missing > 0) parts.push(missing + ' block' + (missing > 1 ? 's are' : ' is') + ' missing.');
      message = parts.join(' ');
    }
    return { pass: pass, correctPositions: correctPositions, total: total, distractorsUsed: distractorsUsed, missing: missing, message: message };
  }
  function assembleOrder(step, answer) {
    var byId = {};
    step.blocks.forEach(function (b) { byId[b.id] = b.code; });
    return answer.map(function (id) { return byId[id] || ''; }).join('\n');
  }
  /* assignment: slot index (pair whose right text the slot shows) -> index of the dropped term. */
  function checkMatch(step, assignment) {
    var total = step.pairs.length, correct = 0, slotCorrect = {};
    step.pairs.forEach(function (pair, slot) {
      var term = assignment[slot];
      if (term === null || term === undefined || term === '') return;
      var t = step.pairs[Number(term)];
      var ok = !!t && (t.left === pair.left || t.right === pair.right);
      slotCorrect[slot] = ok;
      if (ok) correct += 1;
    });
    var pass = correct === total;
    return { pass: pass, correct: correct, total: total, slotCorrect: slotCorrect,
             message: pass ? 'All ' + total + ' pairs matched.' : correct + ' of ' + total + ' pairs matched.' };
  }
  return { normalize: normalize, isBlankCorrect: isBlankCorrect, blankState: blankState, assembleFill: assembleFill,
           fillProgress: fillProgress, checkOrder: checkOrder, assembleOrder: assembleOrder, checkMatch: checkMatch };
})();
"""

UI_JS = r"""
(function () {
  'use strict';
  var DATA = JSON.parse(document.getElementById('guide-data').textContent);
  var KEY = 'workshop-guide-static:' + DATA.id;
  var STEPS = {};
  DATA.steps.forEach(function (s) { STEPS[s.id] = s; });
  var live = document.getElementById('live');

  /* ---------- storage (every access in try/catch: private windows, blocked storage) ---------- */
  function emptyState() { return { v: 1, fill: {}, order: {}, match: {}, hints: {}, done: {}, solved: {}, touched: {} }; }
  var state = emptyState();
  var storageOk = true;
  try {
    var raw = window.localStorage.getItem(KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.v === 1) Object.keys(state).forEach(function (k) { if (parsed[k]) state[k] = parsed[k]; });
    }
  } catch (e) { storageOk = false; }
  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { storageOk = false; showStorageWarning(); }
  }
  function showStorageWarning() {
    var w = document.getElementById('storage-warning');
    if (w) w.hidden = storageOk;
  }

  function announce(msg) {
    if (!live) return;
    live.textContent = '';
    window.setTimeout(function () { live.textContent = msg; }, 30);
  }
  function setStatus(sec, msg, tone) {
    var el = sec.querySelector('[data-status]');
    if (!el) return;
    el.textContent = msg;
    if (tone) el.setAttribute('data-tone', tone); else el.removeAttribute('data-tone');
  }

  /* ---------- clipboard (file:// pages may lack navigator.clipboard) ---------- */
  function copyText(text, btn) {
    function done(ok) {
      if (!btn) return;
      var old = btn.getAttribute('data-label') || btn.textContent;
      btn.setAttribute('data-label', old);
      btn.textContent = ok ? 'Copied' : 'Copy failed';
      announce(ok ? 'Code copied to the clipboard.' : 'Copy failed. Select the code and copy it by hand.');
      window.setTimeout(function () { btn.textContent = old; }, 1600);
    }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      done(ok);
    }
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
        return;
      }
    } catch (e) { /* use the fallback */ }
    fallback();
  }

  /* ---------- step status ---------- */
  function stepStatus(id) {
    var s = STEPS[id];
    if (state.done[id] || (s.check === 'app' && state.solved[id])) return 'done';
    if (state.solved[id]) return 'ready';
    if (state.touched[id] || state.hints[id]) return 'progress';
    return 'none';
  }
  var LABELS = { none: 'Not started', progress: 'In progress', ready: 'Ready: run check() in the notebook', done: 'Done' };
  function refreshStep(id) {
    var st = stepStatus(id);
    var sec = document.getElementById('step-' + id);
    var link = document.querySelector('[data-nav="' + id + '"]');
    sec.setAttribute('data-status-v', st);
    sec.querySelector('[data-state]').textContent = LABELS[st];
    if (link) {
      link.setAttribute('data-status-v', st);
      link.querySelector('[data-nav-state]').textContent = ', ' + LABELS[st].toLowerCase();
    }
    var box = sec.querySelector('[data-done]');
    if (box) box.checked = !!state.done[id];
  }
  function refreshOverall() {
    var req = 0, reqDone = 0, opt = 0, optDone = 0;
    DATA.steps.forEach(function (s) {
      var d = stepStatus(s.id) === 'done';
      if (s.optional) { opt++; if (d) optDone++; } else { req++; if (d) reqDone++; }
    });
    document.getElementById('overall-text').textContent =
      reqDone + ' of ' + req + ' steps done' + (opt ? ' · ⭐ ' + optDone + ' of ' + opt + ' optional' : '');
    var bar = document.getElementById('overall-bar');
    bar.style.width = (req ? Math.round(100 * reqDone / req) : 0) + '%';
    bar.parentNode.setAttribute('aria-valuenow', String(reqDone));
  }
  function touch(id) {
    if (!state.touched[id]) { state.touched[id] = true; }
  }
  function changed(id) { save(); refreshStep(id); refreshOverall(); }

  /* ---------- hints ---------- */
  function initHints(sec, s) {
    var items = sec.querySelectorAll('[data-hint]');
    if (!items.length) return;
    var next = sec.querySelector('[data-hint-next]');
    var confirmBox = sec.querySelector('[data-confirm]');
    var count = sec.querySelector('[data-hint-count]');
    function render() {
      var shown = Math.min(state.hints[s.id] || 0, items.length);
      items.forEach(function (li, i) { li.hidden = i >= shown; });
      var nextIsSolution = shown === items.length - 1 && items.length > 1;
      next.hidden = shown >= items.length;
      next.textContent = nextIsSolution ? 'Show the solution' : (shown === 0 ? 'Show a hint' : 'Show the next hint');
      count.textContent = shown + ' of ' + items.length + ' shown';
    }
    function reveal(n) {
      state.hints[s.id] = n;
      render(); changed(s.id);
      var li = items[n - 1];
      if (li) { li.setAttribute('tabindex', '-1'); li.focus({ preventScroll: false }); }
    }
    next.addEventListener('click', function () {
      var shown = state.hints[s.id] || 0;
      if (shown === items.length - 1 && items.length > 1) {
        confirmBox.hidden = false; next.hidden = true;
        confirmBox.querySelector('[data-confirm-no]').focus();
      } else reveal(shown + 1);
    });
    confirmBox.querySelector('[data-confirm-yes]').addEventListener('click', function () {
      confirmBox.hidden = true; reveal(items.length);
    });
    confirmBox.querySelector('[data-confirm-no]').addEventListener('click', function () {
      confirmBox.hidden = true; render(); next.focus();
    });
    render();
  }

  /* ---------- fill ---------- */
  function initFill(sec, s) {
    var inputs = sec.querySelectorAll('input[data-blank]');
    var values = state.fill[s.id] || {};
    function evaluate(quiet) {
      inputs.forEach(function (inp) {
        var st = WG.blankState(inp.value, s.blanks[inp.getAttribute('data-blank')]);
        inp.setAttribute('data-state', st);
        inp.setAttribute('aria-invalid', st === 'wrong' ? 'true' : 'false');
      });
      var p = WG.fillProgress(s, values);
      var all = p.correct === p.total;
      state.solved[s.id] = all;
      if (all) setStatus(sec, 'All ' + p.total + ' blanks are right. Copy the code into the notebook and run the check cell.', 'ok');
      else setStatus(sec, p.correct + ' of ' + p.total + ' blanks are right.', null);
      if (!quiet && all) announce('All blanks are right.');
    }
    inputs.forEach(function (inp) {
      var id = inp.getAttribute('data-blank');
      if (values[id]) inp.value = values[id];
      inp.addEventListener('input', function () {
        values[id] = inp.value; state.fill[s.id] = values; touch(s.id);
        evaluate(false); changed(s.id);
      });
    });
    sec.querySelector('[data-copy-assembled]').addEventListener('click', function (ev) {
      copyText(WG.assembleFill(s, values), ev.currentTarget);
    });
    sec.querySelector('[data-reset-ex]').addEventListener('click', function () {
      values = {}; state.fill[s.id] = values;
      inputs.forEach(function (inp) { inp.value = ''; });
      evaluate(true); changed(s.id); inputs[0].focus();
    });
    evaluate(true);
  }

  /* ---------- order ---------- */
  var dragged = null;
  function initOrder(sec, s) {
    var pool = sec.querySelector('[data-list="pool"]');
    var answer = sec.querySelector('[data-list="answer"]');
    var byId = {};
    pool.querySelectorAll('[data-block]').forEach(function (li) { byId[li.getAttribute('data-block')] = li; });
    var initialPool = Object.keys(byId).map(function (k) { return byId[k]; });
    function current() {
      return Array.prototype.map.call(answer.querySelectorAll('[data-block]'), function (li) { return li.getAttribute('data-block'); });
    }
    function clearMarks() {
      sec.querySelectorAll('[data-block]').forEach(function (li) { li.removeAttribute('data-mark'); });
    }
    function persist(msg) {
      state.order[s.id] = current(); touch(s.id);
      state.solved[s.id] = false; clearMarks();
      setStatus(sec, msg || '', null);
      changed(s.id);
    }
    function blockLabel(li) {
      var t = li.querySelector('code').textContent.split('\n')[0];
      return t.length > 50 ? t.slice(0, 50) + '…' : t;
    }
    function act(li, action, btn) {
      var list = li.parentNode;
      var msg = '';
      if (action === 'add') { answer.appendChild(li); msg = 'Added “' + blockLabel(li) + '” at position ' + current().length + '.'; }
      else if (action === 'remove') { pool.appendChild(li); msg = 'Removed “' + blockLabel(li) + '” from your answer.'; }
      else if (action === 'up' && li.previousElementSibling) { list.insertBefore(li, li.previousElementSibling); }
      else if (action === 'down' && li.nextElementSibling) { list.insertBefore(li.nextElementSibling, li); }
      if (action === 'up' || action === 'down') msg = 'Moved to position ' + (Array.prototype.indexOf.call(list.children, li) + 1) + '.';
      persist('');
      announce(msg);
      var again = li.querySelector('[data-act="' + action + '"]');
      var target = (again && getComputedStyle(again).display !== 'none') ? again
        : li.querySelector(action === 'add' ? '[data-act="remove"]' : '[data-act="add"]');
      if (target) target.focus(); else if (btn) btn.focus();
    }
    sec.querySelectorAll('[data-block] [data-act]').forEach(function (btn) {
      btn.addEventListener('click', function () { act(btn.closest('[data-block]'), btn.getAttribute('data-act'), btn); });
    });
    /* drag and drop */
    Object.keys(byId).forEach(function (k) {
      var li = byId[k];
      li.addEventListener('dragstart', function (ev) {
        dragged = li; li.classList.add('dragging');
        try { ev.dataTransfer.setData('text/plain', k); ev.dataTransfer.effectAllowed = 'move'; } catch (e) { /* old browsers */ }
      });
      li.addEventListener('dragend', function () {
        li.classList.remove('dragging'); dragged = null;
        sec.querySelectorAll('.drag-over').forEach(function (el) { el.classList.remove('drag-over'); });
      });
    });
    function afterElement(list, y) {
      var items = Array.prototype.filter.call(list.querySelectorAll('[data-block]'), function (el) { return el !== dragged; });
      for (var i = 0; i < items.length; i++) {
        var r = items[i].getBoundingClientRect();
        if (y < r.top + r.height / 2) return items[i];
      }
      return null;
    }
    [pool, answer].forEach(function (list) {
      list.addEventListener('dragover', function (ev) {
        if (!dragged || !sec.contains(dragged)) return;
        ev.preventDefault(); list.classList.add('drag-over');
      });
      list.addEventListener('dragleave', function (ev) {
        if (!list.contains(ev.relatedTarget)) list.classList.remove('drag-over');
      });
      list.addEventListener('drop', function (ev) {
        if (!dragged || !sec.contains(dragged)) return;
        ev.preventDefault(); list.classList.remove('drag-over');
        var after = afterElement(list, ev.clientY);
        if (after) list.insertBefore(dragged, after); else list.appendChild(dragged);
        persist('');
      });
    });
    sec.querySelector('[data-check-order]').addEventListener('click', function () {
      var ans = current();
      if (!ans.length) { setStatus(sec, 'Your answer is empty: add blocks first.', 'bad'); return; }
      var r = WG.checkOrder(s, ans);
      touch(s.id); state.solved[s.id] = r.pass;
      answer.querySelectorAll('[data-block]').forEach(function (li, i) {
        li.setAttribute('data-mark', s.solution[i] === li.getAttribute('data-block') ? 'ok' : 'bad');
      });
      var tail = r.pass ? (s.check === 'notebook' ? ' Copy the code into the notebook and run the check cell.' : '') : '';
      setStatus(sec, r.message + tail, r.pass ? 'ok' : 'bad');
      announce(r.message);
      changed(s.id);
    });
    sec.querySelector('[data-copy-assembled]').addEventListener('click', function (ev) {
      var ans = current();
      if (!ans.length) { setStatus(sec, 'Your answer is empty: add blocks first.', 'bad'); return; }
      copyText(WG.assembleOrder(s, ans), ev.currentTarget);
    });
    sec.querySelector('[data-reset-ex]').addEventListener('click', function () {
      initialPool.forEach(function (li) { pool.appendChild(li); });
      persist('');
      announce('All blocks are back in the list.');
    });
    /* restore */
    var saved = state.order[s.id] || [];
    saved.forEach(function (id) { if (byId[id]) answer.appendChild(byId[id]); });
    if (state.solved[s.id]) {
      var r0 = WG.checkOrder(s, current());
      if (r0.pass) setStatus(sec, r0.message, 'ok'); else state.solved[s.id] = false;
    }
  }

  /* ---------- match ---------- */
  function initMatch(sec, s) {
    var selects = sec.querySelectorAll('select.match-select');
    var chips = sec.querySelectorAll('.chip');
    var saved = state.match[s.id] || {};
    function assignment() {
      var a = {};
      selects.forEach(function (sel) {
        var slot = sel.closest('[data-slot]').getAttribute('data-slot');
        a[slot] = sel.value === '' ? null : Number(sel.value);
      });
      return a;
    }
    function syncChips() {
      var used = {};
      selects.forEach(function (sel) { if (sel.value !== '') used[sel.value] = true; });
      chips.forEach(function (c) { c.setAttribute('data-used', used[c.getAttribute('data-term')] ? 'true' : 'false'); });
    }
    function clearMarks() { sec.querySelectorAll('.match-row').forEach(function (r) { r.removeAttribute('data-mark'); }); }
    function setTerm(sel, term) {
      /* a term sits in one slot only: clear it elsewhere */
      if (term !== '') selects.forEach(function (o) { if (o !== sel && o.value === term) o.value = ''; });
      sel.value = term;
      var a = assignment(), store = {};
      Object.keys(a).forEach(function (k) { if (a[k] !== null) store[k] = a[k]; });
      state.match[s.id] = store; touch(s.id);
      state.solved[s.id] = false; clearMarks(); syncChips(); setStatus(sec, '', null);
      changed(s.id);
    }
    selects.forEach(function (sel) {
      var slot = sel.closest('[data-slot]').getAttribute('data-slot');
      if (saved[slot] !== undefined && saved[slot] !== null) sel.value = String(saved[slot]);
      sel.addEventListener('change', function () { setTerm(sel, sel.value); });
    });
    var draggedTerm = null;
    chips.forEach(function (c) {
      c.addEventListener('dragstart', function (ev) {
        draggedTerm = c.getAttribute('data-term'); c.classList.add('dragging');
        try { ev.dataTransfer.setData('text/plain', draggedTerm); ev.dataTransfer.effectAllowed = 'move'; } catch (e) { /* ignore */ }
      });
      c.addEventListener('dragend', function () {
        c.classList.remove('dragging'); draggedTerm = null;
        sec.querySelectorAll('.drag-over').forEach(function (el) { el.classList.remove('drag-over'); });
      });
    });
    sec.querySelectorAll('[data-drop]').forEach(function (zone) {
      var sel = zone.querySelector('select');
      zone.addEventListener('dragover', function (ev) { if (draggedTerm === null) return; ev.preventDefault(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', function (ev) { if (!zone.contains(ev.relatedTarget)) zone.classList.remove('drag-over'); });
      zone.addEventListener('drop', function (ev) {
        if (draggedTerm === null) return;
        ev.preventDefault(); zone.classList.remove('drag-over');
        setTerm(sel, draggedTerm);
        announce('Placed the term on: ' + zone.closest('[data-slot]').querySelector('label').textContent);
      });
    });
    function grade(quiet) {
      var r = WG.checkMatch(s, assignment());
      sec.querySelectorAll('.match-row').forEach(function (row) {
        var slot = row.getAttribute('data-slot');
        if (slot in r.slotCorrect) row.setAttribute('data-mark', r.slotCorrect[slot] ? 'ok' : 'bad');
        else row.removeAttribute('data-mark');
      });
      state.solved[s.id] = r.pass;
      setStatus(sec, r.message, r.pass ? 'ok' : 'bad');
      if (!quiet) announce(r.message);
      return r;
    }
    sec.querySelector('[data-check-match]').addEventListener('click', function () { touch(s.id); grade(false); changed(s.id); });
    sec.querySelector('[data-reset-ex]').addEventListener('click', function () {
      selects.forEach(function (sel) { sel.value = ''; });
      state.match[s.id] = {}; state.solved[s.id] = false; clearMarks(); syncChips(); setStatus(sec, '', null);
      changed(s.id); selects[0].focus();
    });
    syncChips();
    if (state.solved[s.id]) grade(true);
  }

  /* ---------- nav highlight ---------- */
  function initNav() {
    var links = document.querySelectorAll('[data-nav]');
    function setCurrent(id) {
      links.forEach(function (a) { a.setAttribute('aria-current', a.getAttribute('data-nav') === id ? 'true' : 'false'); });
    }
    if ('IntersectionObserver' in window) {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) setCurrent(e.target.getAttribute('data-step')); });
      }, { rootMargin: '-15% 0px -70% 0px' });
      document.querySelectorAll('section.step').forEach(function (sec) { obs.observe(sec); });
    }
    links.forEach(function (a) { a.addEventListener('click', function () { setCurrent(a.getAttribute('data-nav')); }); });
  }

  /* ---------- wire everything ---------- */
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      copyText(btn.parentNode.querySelector('pre').textContent.replace(/\n$/, ''), btn);
    });
  });
  DATA.steps.forEach(function (s) {
    var sec = document.getElementById('step-' + s.id);
    if (s.type === 'fill') initFill(sec, s);
    else if (s.type === 'order') initOrder(sec, s);
    else if (s.type === 'match') initMatch(sec, s);
    initHints(sec, s);
    var box = sec.querySelector('[data-done]');
    if (box) box.addEventListener('change', function () {
      state.done[s.id] = box.checked; touch(s.id); changed(s.id);
      if (box.checked) announce('Step marked as done.');
    });
    refreshStep(s.id);
  });
  refreshOverall();
  initNav();
  showStorageWarning();
  document.getElementById('reset-all').addEventListener('click', function () {
    if (!window.confirm('Clear all progress, answers and hints for this workshop in this browser?')) return;
    try { window.localStorage.removeItem(KEY); } catch (e) { /* nothing to clear */ }
    window.location.reload();
  });
  document.documentElement.classList.add('js');
})();
"""


def render_page(guide: dict, source_name: str) -> str:
    notebook = Path(guide["notebook"]).stem
    n_req = sum(1 for s in guide["steps"] if not s.get("optional"))
    steps = "".join(render_step(guide, s, n) for n, s in enumerate(guide["steps"], 1))
    title = guide["title"]
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="generator" content="notebooks/workshops/guide/build_static.py">
<title>{esc(title)} · Workshop Guide</title>
<style>{CSS}</style>
</head>
<body>
<a class="skip" href="#steps">Skip to the steps</a>
<div class="accent-bar"></div>
<header class="topbar"><div class="topbar-inner">
<div class="brand"><span class="logo" aria-hidden="true">WG</span>
<div><h1>{esc(title)}</h1><div class="sub">Workshop Guide · static edition · notebook <code>{esc(notebook)}</code></div></div></div>
<div class="overall"><span id="overall-text">0 of {n_req} steps done</span>
<span class="bar" role="progressbar" aria-label="Required steps done" aria-valuemin="0" aria-valuemax="{n_req}" aria-valuenow="0"><span id="overall-bar"></span></span></div>
</div></header>
<div class="layout">
<nav class="steps-nav" aria-label="Steps">
<p class="nav-title-h">Steps</p>
<ol>{render_nav(guide)}</ol>
<div class="nav-tools"><button type="button" class="btn btn-ghost" id="reset-all">Reset my progress</button></div>
</nav>
<main id="steps">
<div class="notice" role="note">
<p><strong>Static edition.</strong> This page works offline and saves your answers only in this browser. It is not connected to Databricks, so it cannot see your notebook and steps do not turn green on their own.</p>
<p>For each step: solve the exercise here, copy the code into <code>{esc(notebook)}</code>, run its <code>check(...)</code> cell, and when it prints <strong>PASS</strong> tick the box at the bottom of the step. Match steps are graded on this page.</p>
<p id="storage-warning" hidden><strong>Note:</strong> this browser blocks local storage, so progress is lost when you close the page.</p>
</div>
<div class="intro md">{markdown(guide.get("intro", ""))}</div>
<div class="legend" aria-hidden="true"><span><span class="dot"></span>Not started</span>
<span data-status-v="progress"><span class="dot"></span>In progress</span>
<span data-status-v="ready"><span class="dot"></span>Ready for check()</span>
<span data-status-v="done"><span class="dot"></span>Done</span></div>
{steps}
<footer class="foot">Generated from <code>{esc(source_name)}</code> by <code>build_static.py</code>. The Databricks App version of this guide shows live check results from the notebook.</footer>
</main>
</div>
<div id="live" class="sr-only" aria-live="polite" aria-atomic="true"></div>
<script id="guide-data" type="application/json">{client_data(guide)}</script>
<script>{LOGIC_JS}{UI_JS}</script>
</body>
</html>
"""


def render_index(guides: list[tuple[dict, str]]) -> str:
    items = "".join(
        f'<li><a href="{esc(fname)}"><strong>{esc(g["title"])}</strong></a>'
        f'<span>{len(g["steps"])} steps · notebook <code>{esc(Path(g["notebook"]).stem)}</code></span></li>'
        for g, fname in guides
    )
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Workshop Guide · static edition</title>
<style>{CSS}
.index{{max-width:640px;margin:40px auto;padding:0 16px}}
.index ul{{list-style:none;padding:0;display:flex;flex-direction:column;gap:10px}}
.index li{{border:1px solid var(--border);border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:2px}}
.index li a{{text-decoration:none;font-size:16px}}
.index li span{{font-size:13px;color:var(--muted)}}
</style>
</head>
<body>
<div class="accent-bar"></div>
<main class="index">
<h1>Workshop Guide</h1>
<p>Static edition for self-study. Open a workshop, solve each step on the page, then run the matching <code>check(...)</code> cell in your notebook.</p>
<ul>{items}</ul>
</main>
</body>
</html>
"""


# --------------------------------------------------------------------------- output check

VOID = {"meta", "link", "br", "hr", "img", "input", "source", "wbr", "col", "area", "base", "embed", "track"}
ALLOWED = VOID | {
    "html", "head", "body", "title", "style", "script", "a", "div", "span", "header", "nav", "main", "footer",
    "section", "h1", "h3", "h4", "p", "ol", "ul", "li", "pre", "code", "strong", "em", "button", "label",
    "select", "option",
}


class StructureCheck(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[str] = []
        self.errors: list[str] = []
        self.ids: dict[str, int] = {}
        self.count: dict[str, int] = {}
        self.steps: dict[str, dict] = {}
        self.current: str | None = None
        self.script_json: list[str] = []
        self._in_data = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag not in ALLOWED:
            self.errors.append(f"unexpected tag <{tag}> at {self.getpos()}")
        if "id" in a:
            self.ids[a["id"]] = self.ids.get(a["id"], 0) + 1
        if tag == "section" and "data-step" in a:
            self.current = a["data-step"]
            self.steps[self.current] = {"depth": len(self.stack), "type": a.get("data-type"), "inputs": 0, "blocks": 0,
                                        "rows": 0, "selects": 0, "chips": 0, "hints": 0, "docs": [], "done": 0,
                                        "title": False}
        st = self.steps.get(self.current) if self.current else None
        if st is not None:
            if tag == "input" and "data-blank" in a:
                st["inputs"] += 1
            if "data-block" in a:
                st["blocks"] += 1
            if "data-slot" in a:
                st["rows"] += 1
            if tag == "select":
                st["selects"] += 1
            if "data-term" in a:
                st["chips"] += 1
            if "data-hint" in a:
                st["hints"] += 1
            if "data-done" in a:
                st["done"] += 1
            if tag == "a" and "href" in a:
                st["docs"].append(a["href"])
            if tag == "h3" and a.get("id") == f"{self.current}-title":
                st["title"] = True
        if tag == "script" and a.get("id") == "guide-data":
            self._in_data = True
        if tag not in VOID:
            self.stack.append(tag)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID and self.stack and self.stack[-1] == tag:
            self.stack.pop()

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if not self.stack or self.stack[-1] != tag:
            self.errors.append(f"unbalanced </{tag}> at {self.getpos()}, open: {self.stack[-3:]}")
            if tag in self.stack:
                while self.stack and self.stack.pop() != tag:
                    pass
            return
        self.stack.pop()
        if tag == "section" and self.current and len(self.stack) == self.steps[self.current]["depth"]:
            self.current = None
        if tag == "script":
            self._in_data = False

    def handle_data(self, data):
        if self._in_data:
            self.script_json.append(data)


def check_page(path: Path, guide: dict) -> list[str]:
    p = StructureCheck()
    p.feed(path.read_text(encoding="utf-8"))
    p.close()
    errors = [f"{path.name}: {e}" for e in p.errors]
    if p.stack:
        errors.append(f"{path.name}: unclosed tags {p.stack}")
    errors += [f"{path.name}: duplicate id '{i}'" for i, n in p.ids.items() if n > 1]
    try:
        data = json.loads("".join(p.script_json))
        if [s["id"] for s in data["steps"]] != [s["id"] for s in guide["steps"]]:
            errors.append(f"{path.name}: embedded data steps differ from the guide")
    except (ValueError, KeyError) as exc:
        errors.append(f"{path.name}: embedded guide data is not valid JSON ({exc})")
    for step in guide["steps"]:
        sid, stype = step["id"], step["type"]
        st = p.steps.get(sid)
        if st is None:
            errors.append(f"{path.name}: step {sid} not rendered")
            continue

        def need(what: str, got: int, want: int) -> None:
            if got != want:
                errors.append(f"{path.name}: step {sid}: {what} {got}, expected {want}")

        if not st["title"]:
            errors.append(f"{path.name}: step {sid}: title missing")
        need("hints", st["hints"], len(step.get("hints", [])))
        if stype == "fill":
            need("blank inputs", st["inputs"], len(step["blanks"]))
        if stype == "order":
            need("blocks", st["blocks"], len(step["blocks"]))
        if stype == "match":
            need("match rows", st["rows"], len(step["pairs"]))
            need("selects", st["selects"], len(step["pairs"]))
            need("terms", st["chips"], len(step["pairs"]))
        check = step.get("check", "app" if stype in ("order", "match") else "notebook")
        need("done toggles", st["done"], 1 if check == "notebook" else 0)
        for doc in step.get("docs", []):
            if doc["url"] not in st["docs"]:
                errors.append(f"{path.name}: step {sid}: doc link {doc['url']} missing")
    if set(p.steps) - {s["id"] for s in guide["steps"]}:
        errors.append(f"{path.name}: extra step sections {sorted(set(p.steps) - {s['id'] for s in guide['steps']})}")
    return errors


def check_index(path: Path) -> list[str]:
    p = StructureCheck()
    p.feed(path.read_text(encoding="utf-8"))
    p.close()
    errors = [f"{path.name}: {e}" for e in p.errors]
    if p.stack:
        errors.append(f"{path.name}: unclosed tags {p.stack}")
    return errors


# --------------------------------------------------------------------------- main

def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("guides", nargs="*", help="guide JSON files (default: all *.json next to this script)")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT, help="output directory (default: guide/html)")
    ap.add_argument("--check", action="store_true", help="only verify existing pages, do not write")
    args = ap.parse_args(argv)

    paths = [Path(g) if Path(g).is_absolute() or Path(g).exists() else HERE / g for g in args.guides]
    if not paths:
        paths = sorted(HERE.glob("*.json"))
    if not paths:
        print("No guide files found.", file=sys.stderr)
        return 1

    errors: list[str] = []
    guides: list[tuple[dict, Path]] = []
    for path in paths:
        try:
            guide = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            errors.append(f"{path.name}: cannot read ({exc})")
            continue
        errs = validate_guide(guide, path.name)
        errors += errs
        if not errs:
            guides.append((guide, path))
    if errors:
        print("\n".join(f"ERROR {e}" for e in errors), file=sys.stderr)
        return 1

    out: Path = args.out
    if not args.check:
        out.mkdir(parents=True, exist_ok=True)
        for guide, path in guides:
            (out / f"{guide['id']}.html").write_text(render_page(guide, path.name), encoding="utf-8")
        if not args.guides:
            index = [(g, f"{g['id']}.html") for g, _ in guides]
            (out / "index.html").write_text(render_index(index), encoding="utf-8")

    for guide, _ in guides:
        page = out / f"{guide['id']}.html"
        if not page.exists():
            errors.append(f"{page}: missing (run without --check)")
            continue
        errors += check_page(page, guide)
    if (out / "index.html").exists():
        errors += check_index(out / "index.html")

    if errors:
        print("\n".join(f"ERROR {e}" for e in errors), file=sys.stderr)
        return 1
    for guide, _ in guides:
        page = out / f"{guide['id']}.html"
        types = {}
        for s in guide["steps"]:
            types[s["type"]] = types.get(s["type"], 0) + 1
        mix = ", ".join(f"{k} {v}" for k, v in sorted(types.items()))
        print(f"OK  {page.relative_to(out.parent) if out.parent in page.parents else page}"
              f"  ({len(guide['steps'])} steps: {mix}; {page.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
