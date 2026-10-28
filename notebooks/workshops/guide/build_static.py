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
LANGS = ("pl", "en")  # pages per guide: <id>.pl.html, <id>.en.html; PL is the default (app default)
I18N_DIR = HERE / "i18n"

# Page chrome per language. "{x}" placeholders are filled with str.format in Python; the "js"
# entries go to the page as JSON and are filled by fmt() / plural() in L10N_JS.
STRINGS: dict[str, dict] = {
    "en": {
        "html_lang": "en", "lang_name": "English",
        "types": TYPE_LABELS,
        "copy": "Copy", "copy_code": "Copy code", "clear": "Clear", "start_over": "Start over",
        "blank_aria": "Blank {n} of {total}",
        "fill_instr": "Type the missing parts. Each blank turns green when it is right.",
        "add": "Add", "add_aria": "Add to your answer", "up_aria": "Move up", "down_aria": "Move down",
        "remove_aria": "Remove from your answer",
        "order_instr": "Drag blocks into <em>Your answer</em> in the right order, or use the Add, ↑, ↓ and ✕ buttons.",
        "order_traps": ["{n} block is a trap and must stay out.", "{n} blocks are a trap and must stay out."],
        "available_blocks": "Available blocks", "your_answer": "Your answer", "drop_here": "Drop blocks here.",
        "check_order": "Check order",
        "choose": "Choose…", "terms": "Terms", "check_answers": "Check answers",
        "match_instr": "Drag each term onto its description, or pick it from the list next to the description.",
        "code_instr_starter": "Write the code in the notebook cell. The cell starts like this:",
        "code_instr_empty": "Write the code in the notebook cell from scratch.",
        "code_stuck": "Stuck? Open the hints one at a time below; the last one is the full solution.",
        "optional_badge": "Optional", "optional_title": "Optional", "optional_short": "opt.",
        "optional_note": "This step is optional: you can skip it; the next steps do not depend on it.",
        "solution": "Solution", "hint_n": "Hint {n}", "hints": "Hints", "hints_available": "{n} available",
        "show_hint": "Show a hint", "confirm_aria": "Confirm",
        "confirm_text": "Show the full solution? You learn more by trying once more with the hints you have.",
        "show_solution": "Show solution", "keep_trying": "Keep trying",
        "docs": "Docs", "expected": "Expected result",
        "check_nb_title": "Check it in the notebook",
        "check_nb_text": "Run the step cell in <code>{notebook}</code> (keep its last line: it saves your result), "
                         "then add a cell <code>{call}</code> under it and run it. "
                         "When it prints <strong>PASS</strong>, tick the box.",
        "check_nb_done": "<code>{call}</code> passed in my notebook",
        "graded_title": "Graded here",
        "graded_text": "This step is checked on this page: it is done when all answers are right.",
        "step": "Step", "not_started": "Not started", "nav_not_started": ", not started",
        "skip": "Skip to the steps", "nav_aria": "Steps", "steps": "Steps",
        "sub": "Workshop Guide · static edition · notebook <code>{notebook}</code>",
        "overall": "0 of {n} steps done", "overall_aria": "Required steps done",
        "reset": "Reset my progress", "lang_aria": "Language", "all_workshops": "All workshops",
        "notice": [
            "<strong>Static edition.</strong> This page works offline and saves your answers only in this browser. "
            "It is not connected to Databricks, so it cannot see your notebook and steps do not turn green on their own.",
            "Checks run in your notebook. Once per session, add a cell <code>%run ./_checks/{id}</code> after the setup "
            "cells of <code>{notebook}</code> and run it: it defines <code>check()</code>.",
            "For each step: solve the exercise here, copy the code into <code>{notebook}</code> and run the cell, then "
            "add a cell <code>check(\"{id}\", \"tNN\")</code> under it. When it prints <strong>PASS</strong>, tick the "
            "box at the bottom of the step. Match steps are graded on this page.",
        ],
        "storage_warning": "<strong>Note:</strong> this browser blocks local storage, so progress is lost when you close the page.",
        "legend": {"none": "Not started", "progress": "In progress", "ready": "Ready for check()", "done": "Done"},
        "footer": "Generated from <code>{source}</code> by <code>build_static.py</code>. "
                  "The Databricks App version of this guide shows live check results from the notebook.",
        "index_title": "Workshop Guide · static edition",
        "index_text": "Static edition for self-study. Open a workshop, solve each step on the page and run the code in "
                      "your notebook. To check a step, load the checks once with <code>%run ./_checks/&lt;workshop&gt;</code> "
                      "after the setup cells, then run <code>check(\"&lt;workshop&gt;\", \"tNN\")</code> in a new cell.",
        "index_item": "{count} · notebook <code>{notebook}</code>",
        "step_count": ["{n} step", "{n} steps"],
        "optional_count": ["{n} optional", "{n} optional"],
        "js": {
            "plural": "en",
            "copied": "Copied", "copy_failed": "Copy failed",
            "copied_announce": "Code copied to the clipboard.",
            "copy_failed_announce": "Copy failed. Select the code and copy it by hand.",
            "states": {"none": "Not started", "progress": "In progress",
                       "ready": "Ready: run check() in the notebook", "done": "Done"},
            "overall": "{n} of {total} steps done", "overall_optional": " · {n} of {total} optional",
            "show_solution": "Show the solution", "show_hint": "Show a hint", "show_next_hint": "Show the next hint",
            "hints_shown": "{n} of {total} shown",
            "fill_all": "All {total} blanks are right.", "fill_some": "{n} of {total} blanks are right.",
            "fill_all_announce": "All blanks are right.",
            "run_check_tail": " Copy the code into the notebook, run the cell, then run check() for this step.",
            "block_added": "Added “{b}” at position {n}.", "block_removed": "Removed “{b}” from your answer.",
            "block_moved": "Moved to position {n}.", "answer_empty": "Your answer is empty: add blocks first.",
            "blocks_reset": "All blocks are back in the list.",
            "order_pass": "Correct order: all {total} blocks in place.",
            "order_positions": "{n} of {total} blocks in the right place.",
            "order_extra": ["{n} block does not belong here.", "{n} blocks do not belong here."],
            "order_missing": ["{n} block is missing.", "{n} blocks are missing."],
            "match_pass": "All {total} pairs matched.", "match_some": "{n} of {total} pairs matched.",
            "term_placed": "Placed the term on: ", "step_done": "Step marked as done.",
            "reset_confirm": "Clear all progress, answers and hints for this workshop in this browser?",
        },
    },
    "pl": {
        "html_lang": "pl", "lang_name": "Polski",
        "types": {"fill": "Uzupełnij luki", "order": "Ułóż w kolejności", "match": "Połącz w pary", "code": "Napisz kod"},
        "copy": "Kopiuj", "copy_code": "Kopiuj kod", "clear": "Wyczyść", "start_over": "Wyczyść",
        "blank_aria": "Luka {n} z {total}",
        "fill_instr": "Wpisz brakujące fragmenty. Luka zmienia kolor na zielony, gdy wpis jest poprawny.",
        "add": "Dodaj", "add_aria": "Dodaj do odpowiedzi", "up_aria": "Przesuń wyżej", "down_aria": "Przesuń niżej",
        "remove_aria": "Usuń z odpowiedzi",
        "order_instr": "Przeciągnij bloki do sekcji <em>Twoja odpowiedź</em> we właściwej kolejności "
                       "albo użyj przycisków Dodaj, ↑, ↓ i ✕.",
        "order_traps": ["{n} blok to pułapka i musi zostać poza odpowiedzią.",
                        "{n} bloki to pułapki i muszą zostać poza odpowiedzią.",
                        "{n} bloków to pułapki i muszą zostać poza odpowiedzią."],
        "available_blocks": "Dostępne bloki", "your_answer": "Twoja odpowiedź", "drop_here": "Upuść bloki tutaj.",
        "check_order": "Sprawdź kolejność",
        "choose": "Wybierz…", "terms": "Pojęcia", "check_answers": "Sprawdź pary",
        "match_instr": "Przeciągnij każde pojęcie na jego opis albo wybierz je z listy obok opisu.",
        "code_instr_starter": "Napisz kod w komórce notebooka. Komórka zaczyna się tak:",
        "code_instr_empty": "Napisz kod w komórce notebooka od zera.",
        "code_stuck": "Nie wiesz, jak zacząć? Otwieraj podpowiedzi poniżej po jednej; ostatnia to pełne rozwiązanie.",
        "optional_badge": "Opcjonalny", "optional_title": "Opcjonalny", "optional_short": "opc.",
        "optional_note": "Ten krok jest opcjonalny: możesz go pominąć, kolejne kroki go nie wymagają.",
        "solution": "Rozwiązanie", "hint_n": "Podpowiedź {n}", "hints": "Podpowiedzi", "hints_available": "dostępne: {n}",
        "show_hint": "Pokaż podpowiedź", "confirm_aria": "Potwierdź",
        "confirm_text": "Pokazać pełne rozwiązanie? Więcej się nauczysz, jeśli spróbujesz jeszcze raz "
                        "z podpowiedziami, które już masz.",
        "show_solution": "Pokaż rozwiązanie", "keep_trying": "Spróbuję jeszcze",
        "docs": "Dokumentacja", "expected": "Oczekiwany wynik",
        "check_nb_title": "Sprawdź w notebooku",
        "check_nb_text": "Uruchom komórkę kroku w <code>{notebook}</code> (zostaw jej ostatnią linię: zapisuje twój wynik), "
                         "potem dodaj pod nią komórkę <code>{call}</code> i ją uruchom. "
                         "Gdy wypisze <strong>PASS</strong>, zaznacz pole.",
        "check_nb_done": "<code>{call}</code> zwraca PASS w moim notebooku",
        "graded_title": "Ocena na tej stronie",
        "graded_text": "Ten krok jest sprawdzany na tej stronie: jest zaliczony, gdy wszystkie odpowiedzi są poprawne.",
        "step": "Krok", "not_started": "Nierozpoczęty", "nav_not_started": ", nierozpoczęty",
        "skip": "Przejdź do kroków", "nav_aria": "Kroki", "steps": "Kroki",
        "sub": "Workshop Guide · wersja statyczna · notebook <code>{notebook}</code>",
        "overall": "Zaliczone kroki: 0 / {n}", "overall_aria": "Zaliczone kroki obowiązkowe",
        "reset": "Wyczyść moje postępy", "lang_aria": "Język", "all_workshops": "Wszystkie warsztaty",
        "notice": [
            "<strong>Wersja statyczna.</strong> Ta strona działa offline i zapisuje twoje odpowiedzi tylko w tej "
            "przeglądarce. Nie jest połączona z Databricks, więc nie widzi twojego notebooka, a kroki nie zmieniają "
            "koloru na zielony same.",
            "Sprawdzanie działa w notebooku. Raz na sesję dodaj komórkę <code>%run ./_checks/{id}</code> po komórkach "
            "konfiguracyjnych <code>{notebook}</code> i ją uruchom: definiuje funkcję <code>check()</code>.",
            "W każdym kroku: rozwiąż ćwiczenie tutaj, skopiuj kod do <code>{notebook}</code> i uruchom komórkę, potem "
            "dodaj pod nią komórkę <code>check(\"{id}\", \"tNN\")</code>. Gdy wypisze <strong>PASS</strong>, zaznacz "
            "pole na dole kroku. Kroki typu „Połącz w pary” są oceniane na tej stronie.",
        ],
        "storage_warning": "<strong>Uwaga:</strong> ta przeglądarka blokuje pamięć lokalną, więc postęp zniknie "
                           "po zamknięciu strony.",
        "legend": {"none": "Nierozpoczęty", "progress": "W toku", "ready": "Gotowe do check()", "done": "Zaliczony"},
        "footer": "Wygenerowano z <code>{source}</code> przez <code>build_static.py</code>. "
                  "Wersja tego przewodnika w aplikacji Databricks pokazuje wyniki sprawdzania na bieżąco.",
        "index_title": "Workshop Guide · wersja statyczna",
        "index_text": "Wersja statyczna do samodzielnej nauki. Otwórz warsztat, rozwiązuj kolejne kroki na stronie "
                      "i uruchamiaj kod w notebooku. Żeby sprawdzić krok, raz załaduj funkcje sprawdzające przez "
                      "<code>%run ./_checks/&lt;workshop&gt;</code> po komórkach konfiguracyjnych, a potem uruchom "
                      "<code>check(\"&lt;workshop&gt;\", \"tNN\")</code> w nowej komórce.",
        "index_item": "{count} · notebook <code>{notebook}</code>",
        "step_count": ["{n} krok", "{n} kroki", "{n} kroków"],
        "optional_count": ["{n} opcjonalny", "{n} opcjonalne", "{n} opcjonalnych"],
        "js": {
            "plural": "pl",
            "copied": "Skopiowano", "copy_failed": "Nie skopiowano",
            "copied_announce": "Kod skopiowany do schowka.",
            "copy_failed_announce": "Nie udało się skopiować. Zaznacz kod i skopiuj go ręcznie.",
            "states": {"none": "Nierozpoczęty", "progress": "W toku",
                       "ready": "Gotowe: uruchom check() w notebooku", "done": "Zaliczony"},
            "overall": "Zaliczone kroki: {n} / {total}", "overall_optional": " · opcjonalne: {n} / {total}",
            "show_solution": "Pokaż rozwiązanie", "show_hint": "Pokaż podpowiedź",
            "show_next_hint": "Pokaż następną podpowiedź",
            "hints_shown": "pokazane: {n} z {total}",
            "fill_all": "Wszystkie luki są poprawne ({total}).", "fill_some": "Poprawne luki: {n} z {total}.",
            "fill_all_announce": "Wszystkie luki są poprawne.",
            "run_check_tail": " Skopiuj kod do notebooka, uruchom komórkę, a potem uruchom check() dla tego kroku.",
            "block_added": "Dodano „{b}” na pozycji {n}.", "block_removed": "Usunięto „{b}” z odpowiedzi.",
            "block_moved": "Przesunięto na pozycję {n}.",
            "answer_empty": "Twoja odpowiedź jest pusta: najpierw dodaj bloki.",
            "blocks_reset": "Wszystkie bloki wróciły na listę.",
            "order_pass": "Poprawna kolejność: wszystkie bloki ({total}) są na miejscu.",
            "order_positions": "Bloki na właściwym miejscu: {n} z {total}.",
            "order_extra": ["{n} blok tu nie pasuje.", "{n} bloki tu nie pasują.", "{n} bloków tu nie pasuje."],
            "order_missing": ["Brakuje {n} bloku.", "Brakuje {n} bloków.", "Brakuje {n} bloków."],
            "match_pass": "Wszystkie pary dopasowane ({total}).", "match_some": "Dopasowane pary: {n} z {total}.",
            "term_placed": "Umieszczono pojęcie przy opisie: ", "step_done": "Krok oznaczony jako zaliczony.",
            "reset_confirm": "Wyczyścić cały postęp, odpowiedzi i podpowiedzi tego warsztatu w tej przeglądarce?",
        },
    },
}
UI: dict = STRINGS["en"]  # set per page by use_lang(); this is a one-shot build script


def use_lang(lang: str) -> None:
    global UI
    UI = STRINGS[lang]


def plural(n: int, forms: list[str]) -> str:
    """English: [one, other]. Polish: [one, few (2-4, not 12-14), many]."""
    if len(forms) == 2:
        return forms[0 if n == 1 else 1].format(n=n)
    if n == 1:
        i = 0
    elif 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14:
        i = 1
    else:
        i = 2
    return forms[i].format(n=n)


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


# --------------------------------------------------------------------------- translations

FENCE_PATTERN = re.compile(r"```[\w-]*\n.*?```", re.S)
INLINE_CODE_PATTERN = re.compile(r"`[^`\n]+`")


def inline_code(text: object) -> list[str]:
    """Sorted inline `code` spans outside fences: a translation may move them, never change them."""
    if not isinstance(text, str):
        return []
    return sorted(INLINE_CODE_PATTERN.findall(FENCE_PATTERN.sub("", text)))
OVERLAY_KEYS = {"id", "title", "intro", "steps"}
OVERLAY_STEP_KEYS = {"title", "explain", "expected", "hints", "pairs", "docs"}


def overlay_path(guide_id: str, lang: str) -> Path:
    return I18N_DIR / lang / f"{guide_id}.json"


def validate_overlay(guide: dict, ov: dict, name: str) -> list[str]:
    """Overlay rules (SPEC section 9): known step ids, same array lengths, code fences unchanged."""
    errors: list[str] = []

    def err(where: str, msg: str) -> None:
        errors.append(f"{name}: {where}: {msg}")

    def text_ok(where: str, value: object) -> None:
        if not isinstance(value, str) or not value.strip():
            err(where, "must be a non-empty string")

    if not isinstance(ov, dict):
        return [f"{name}: overlay must be a JSON object"]
    if ov.get("id") != guide["id"]:
        err("id", f"'{ov.get('id')}' does not match the guide id '{guide['id']}'")
    for key in sorted(set(ov) - OVERLAY_KEYS):
        err(key, "unknown key (only translatable text belongs in an overlay)")
    for key in ("title", "intro"):
        if key in ov:
            text_ok(key, ov[key])
    if "intro" in ov and isinstance(ov["intro"], str) and FENCE_PATTERN.findall(ov["intro"]) != FENCE_PATTERN.findall(guide.get("intro", "")):
        err("intro", "code fences differ from the English guide")
    for key in ("title", "intro"):
        if key in ov and inline_code(ov[key]) != inline_code(guide.get(key, "")):
            err(key, "inline `code` differs from the English guide")
    steps = ov.get("steps", {})
    if not isinstance(steps, dict):
        return errors + [f"{name}: steps: must be an object keyed by step id"]
    by_id = {s["id"]: s for s in guide["steps"]}
    for sid, st in steps.items():
        en = by_id.get(sid)
        if en is None:
            err(f"steps.{sid}", "step id not in the English guide")
            continue
        if not isinstance(st, dict):
            err(f"steps.{sid}", "must be an object")
            continue
        for key in sorted(set(st) - OVERLAY_STEP_KEYS):
            err(f"steps.{sid}.{key}", "unknown key (code is never translated)")
        for key in ("title", "explain", "expected"):
            if key in st:
                text_ok(f"steps.{sid}.{key}", st[key])
                if isinstance(st[key], str) and FENCE_PATTERN.findall(st[key]) != FENCE_PATTERN.findall(en.get(key, "")):
                    err(f"steps.{sid}.{key}", "code fences differ from the English guide")
                if inline_code(st[key]) != inline_code(en.get(key, "")):
                    err(f"steps.{sid}.{key}", "inline `code` differs from the English guide")
        if "hints" in st:
            hints = st["hints"]
            if not isinstance(hints, list) or len(hints) != len(en.get("hints", [])):
                err(f"steps.{sid}.hints", f"needs {len(en.get('hints', []))} entries like the English guide")
            else:
                for i, (h, e) in enumerate(zip(hints, en["hints"])):
                    text_ok(f"steps.{sid}.hints[{i}]", h)
                    if isinstance(h, str) and FENCE_PATTERN.findall(h) != FENCE_PATTERN.findall(e):
                        err(f"steps.{sid}.hints[{i}]", "code fence differs from the English hint (copy it byte for byte)")
                    if inline_code(h) != inline_code(e):
                        err(f"steps.{sid}.hints[{i}]", "inline `code` differs from the English hint")
        if "pairs" in st:
            pairs = st["pairs"]
            if en["type"] != "match":
                err(f"steps.{sid}.pairs", "only match steps have pairs")
            elif not isinstance(pairs, list) or len(pairs) != len(en["pairs"]):
                err(f"steps.{sid}.pairs", f"needs {len(en['pairs'])} entries like the English guide")
            else:
                for i, pair in enumerate(pairs):
                    if not isinstance(pair, dict) or set(pair) - {"left", "right"}:
                        err(f"steps.{sid}.pairs[{i}]", "only left and right")
                        continue
                    for side in ("left", "right"):
                        if side in pair:
                            text_ok(f"steps.{sid}.pairs[{i}].{side}", pair[side])
        if "docs" in st:
            docs = st["docs"]
            if not isinstance(docs, list) or len(docs) != len(en.get("docs", [])):
                err(f"steps.{sid}.docs", f"needs {len(en.get('docs', []))} entries like the English guide")
            else:
                for i, (d, e) in enumerate(zip(docs, en["docs"])):
                    if not isinstance(d, dict) or set(d) - {"label", "url"}:
                        err(f"steps.{sid}.docs[{i}]", "only label (url comes from the English guide)")
                    elif "url" in d and d["url"] != e["url"]:
                        err(f"steps.{sid}.docs[{i}].url", "differs from the English guide")
                    elif "label" in d:
                        text_ok(f"steps.{sid}.docs[{i}].label", d["label"])
    return errors


def apply_overlay(guide: dict, ov: dict | None) -> dict:
    """English guide with the overlay text on top; anything missing stays English."""
    out = json.loads(json.dumps(guide))
    if not ov:
        return out
    for key in ("title", "intro"):
        if ov.get(key):
            out[key] = ov[key]
    steps = ov.get("steps", {})
    for step in out["steps"]:
        st = steps.get(step["id"]) or {}
        for key in ("title", "explain", "expected"):
            if st.get(key):
                step[key] = st[key]
        for i, h in enumerate(st.get("hints") or []):
            if h and i < len(step.get("hints", [])):
                step["hints"][i] = h
        for i, pair in enumerate(st.get("pairs") or []):
            if i < len(step.get("pairs", [])):
                step["pairs"][i] = {**step["pairs"][i], **{k: v for k, v in pair.items() if v}}
        for i, doc in enumerate(st.get("docs") or []):
            if doc.get("label") and i < len(step.get("docs", [])):
                step["docs"][i] = {**step["docs"][i], "label": doc["label"]}
    return out


def localized_guides(guide: dict) -> tuple[list[tuple[str, dict, str]], list[str], list[str]]:
    """[(lang, guide, source label)] for every page language, plus errors and warnings."""
    out, errors, warnings = [], [], []
    for lang in LANGS:
        if lang == "en":
            out.append((lang, json.loads(json.dumps(guide)), f"{guide['id']}.json"))
            continue
        path = overlay_path(guide["id"], lang)
        rel = f"i18n/{lang}/{path.name}"
        ov = None
        if not path.exists():
            warnings.append(f"{rel}: missing, the {lang} page falls back to English")
        else:
            try:
                ov = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, ValueError) as exc:
                errors.append(f"{rel}: cannot read ({exc})")
                continue
            errs = validate_overlay(guide, ov, rel)
            errors += errs
            if errs:
                continue
        source = f"{guide['id']}.json + {rel}" if ov else f"{guide['id']}.json"
        out.append((lang, apply_overlay(guide, ov), source))
    for lang, g, _ in out:
        if static_intro(g.get("intro", ""))[1] != 1:
            errors.append(f"{g['id']} ({lang}): intro must contain the app sentence once "
                          f"(pattern {STATIC_INTRO[lang][0]!r}) so the static page can rewrite it")
    return out, errors, warnings


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
        f'<button type="button" class="btn btn-ghost btn-copy" data-copy>{UI["copy"]}</button>'
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
            f'aria-label="{esc(UI["blank_aria"].format(n=n, total=len(order)))}" autocomplete="off" autocapitalize="off" '
            f'autocorrect="off" spellcheck="false" style="width:{width + 1}ch">'
        )
        last = m.end()
    pieces.append(html.escape(step["template"][last:], quote=False))
    return (
        '<div class="exercise exercise-fill">'
        f'<p class="ex-instr">{UI["fill_instr"]}</p>'
        f'<div class="codeblock codeblock-fill" data-lang="{esc(step.get("language", ""))}">'
        f'<pre><code>{"".join(pieces)}</code></pre></div>'
        '<div class="ex-bar"><p class="ex-status" data-status aria-live="polite"></p>'
        '<span class="ex-actions">'
        f'<button type="button" class="btn" data-copy-assembled>{UI["copy_code"]}</button>'
        f'<button type="button" class="btn btn-ghost" data-reset-ex>{UI["clear"]}</button>'
        "</span></div></div>"
    )


def render_block_item(block: dict) -> str:
    bid = esc(block["id"])
    return (
        f'<li class="block" data-block="{bid}" draggable="true">'
        '<span class="grip" aria-hidden="true">⋮⋮</span>'
        f'<pre class="block-code"><code>{html.escape(block["code"], quote=False)}</code></pre>'
        '<span class="block-actions">'
        f'<button type="button" class="btn btn-icon" data-act="add" aria-label="{UI["add_aria"]}">{UI["add"]}</button>'
        f'<button type="button" class="btn btn-icon" data-act="up" aria-label="{UI["up_aria"]}">↑</button>'
        f'<button type="button" class="btn btn-icon" data-act="down" aria-label="{UI["down_aria"]}">↓</button>'
        f'<button type="button" class="btn btn-icon" data-act="remove" aria-label="{UI["remove_aria"]}">✕</button>'
        "</span></li>"
    )


def render_order(step: dict) -> str:
    sid = step["id"]
    blocks = shuffled_not_solved(step["blocks"], sid, lambda xs: [b["id"] for b in xs] == step["solution"])
    n_traps = len(step.get("distractors", []))
    traps = " " + plural(n_traps, UI["order_traps"]) if n_traps else ""
    return (
        '<div class="exercise exercise-order">'
        f'<p class="ex-instr">{UI["order_instr"]}{traps}</p>'
        '<div class="order-grid">'
        f'<div class="order-col"><h4 class="col-title" id="{sid}-pool-t">{UI["available_blocks"]}</h4>'
        f'<ul class="blocklist pool" data-list="pool" aria-labelledby="{sid}-pool-t">'
        + "".join(render_block_item(b) for b in blocks)
        + "</ul></div>"
        f'<div class="order-col"><h4 class="col-title" id="{sid}-ans-t">{UI["your_answer"]}</h4>'
        f'<ol class="blocklist answer" data-list="answer" aria-labelledby="{sid}-ans-t">'
        f'</ol><p class="empty-note">{UI["drop_here"]}</p></div></div>'
        '<div class="ex-bar"><p class="ex-status" data-status aria-live="polite"></p>'
        '<span class="ex-actions">'
        f'<button type="button" class="btn btn-primary" data-check-order>{UI["check_order"]}</button>'
        f'<button type="button" class="btn" data-copy-assembled>{UI["copy_code"]}</button>'
        f'<button type="button" class="btn btn-ghost" data-reset-ex>{UI["start_over"]}</button>'
        "</span></div></div>"
    )


def render_match(step: dict) -> str:
    sid = step["id"]
    pairs = step["pairs"]
    idx = list(range(len(pairs)))
    terms = shuffled_not_solved(idx, sid + ":terms", lambda xs: xs == idx)
    slots = seeded_shuffle(idx, sid + ":slots")
    options = f'<option value="">{UI["choose"]}</option>' + "".join(
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
        f'<p class="ex-instr">{UI["match_instr"]}</p>'
        f'<h4 class="col-title" id="{sid}-terms-t">{UI["terms"]}</h4>'
        f'<ul class="chips" aria-labelledby="{sid}-terms-t">{chips}</ul>'
        f'<ol class="match-list">{rows}</ol>'
        '<div class="ex-bar"><p class="ex-status" data-status aria-live="polite"></p>'
        '<span class="ex-actions">'
        f'<button type="button" class="btn btn-primary" data-check-match>{UI["check_answers"]}</button>'
        f'<button type="button" class="btn btn-ghost" data-reset-ex>{UI["start_over"]}</button>'
        "</span></div></div>"
    )


def render_code(step: dict) -> str:
    starter = step.get("starter")
    body = (
        f'<p class="ex-instr">{UI["code_instr_starter"]}</p>'
        + code_block(starter, step.get("language", ""))
        if starter
        else f'<p class="ex-instr">{UI["code_instr_empty"]}</p>'
    )
    return (
        '<div class="exercise exercise-code">'
        + body
        + f'<p class="ex-instr">{UI["code_stuck"]}</p></div>'
    )


# Small "i" in a circle, drawn with CSS (the page validator allows no SVG); the app shows an info icon here.
OPT_ICON = '<span class="opt-note-icon" aria-hidden="true">i</span>'

RENDERERS = {"fill": render_fill, "order": render_order, "match": render_match, "code": render_code}


def render_step(guide: dict, step: dict, number: int) -> str:
    sid, stype = step["id"], step["type"]
    check = step.get("check", "app" if stype in ("order", "match") else "notebook")
    optional = step.get("optional", False)
    badges = f'<span class="badge">{UI["types"][stype]}</span>'
    if optional:
        badges += f'<span class="badge badge-opt">{UI["optional_badge"]}</span>'
    hints = step.get("hints", [])
    hint_items = "".join(
        f'<li class="hint{" hint-solution" if (i == len(hints) - 1 and len(hints) > 1) else ""}" data-hint="{i}">'
        f'<span class="hint-label">{UI["solution"] if (i == len(hints) - 1 and len(hints) > 1) else UI["hint_n"].format(n=i + 1)}</span>'
        f"{hint_html(h, i == len(hints) - 1 and len(hints) > 1, step.get('language', ''))}</li>"
        for i, h in enumerate(hints)
    )
    hints_html = (
        f'<section class="hints" aria-labelledby="{sid}-hints-t">'
        f'<h4 class="sec-title" id="{sid}-hints-t">{UI["hints"]} <span class="muted" data-hint-count>'
        f'{UI["hints_available"].format(n=len(hints))}</span></h4>'
        f'<ol class="hint-list">{hint_items}</ol>'
        '<div class="hint-controls">'
        f'<button type="button" class="btn" data-hint-next hidden>{UI["show_hint"]}</button>'
        f'<span class="confirm" data-confirm hidden role="group" aria-label="{UI["confirm_aria"]}">'
        f'<span>{UI["confirm_text"]}</span>'
        f'<button type="button" class="btn btn-primary" data-confirm-yes>{UI["show_solution"]}</button>'
        f'<button type="button" class="btn btn-ghost" data-confirm-no>{UI["keep_trying"]}</button>'
        "</span></div></section>"
        if hints
        else ""
    )
    docs = step.get("docs", [])
    docs_html = (
        f'<section class="docs" aria-labelledby="{sid}-docs-t"><h4 class="sec-title" id="{sid}-docs-t">{UI["docs"]}</h4><ul>'
        + "".join(
            f'<li><a href="{esc(d["url"])}" target="_blank" rel="noopener noreferrer">{esc(d["label"])}</a></li>'
            for d in docs
        )
        + "</ul></section>"
        if docs
        else ""
    )
    expected = (
        f'<section class="expected"><h4 class="sec-title">{UI["expected"]}</h4>{markdown(step["expected"])}</section>'
        if step.get("expected")
        else ""
    )
    opt_note = (
        f'<p class="opt-note">{OPT_ICON}<span>{UI["optional_note"]}</span></p>' if optional else ""
    )
    call = f'check("{guide["id"]}", "{sid}")'
    if check == "notebook":
        finish = (
            '<section class="finish">'
            f'<h4 class="sec-title">{UI["check_nb_title"]}</h4>'
            f'<p>{UI["check_nb_text"].format(notebook=esc(Path(guide["notebook"]).stem), call=esc(call))}</p>'
            '<label class="done-toggle"><input type="checkbox" data-done> '
            f'<span>{UI["check_nb_done"].format(call=esc(call))}</span></label>'
            "</section>"
        )
    else:
        finish = (
            f'<section class="finish"><h4 class="sec-title">{UI["graded_title"]}</h4>'
            f'<p>{UI["graded_text"]}</p></section>'
        )
    return (
        f'<section class="step" id="step-{sid}" data-step="{sid}" data-type="{stype}" data-check="{check}"'
        f' data-optional="{"true" if optional else "false"}" aria-labelledby="{sid}-title">'
        '<header class="step-head">'
        f'<span class="step-num" aria-hidden="true">{number:02d}</span>'
        f'<div><h3 id="{sid}-title" class="step-title">{UI["step"]} {number:02d} — {esc(step["title"])}</h3>'
        f'<div class="badges">{badges}<span class="state" data-state>{UI["not_started"]}</span></div></div>'
        "</header>"
        f'<div class="md explain">{markdown(step["explain"])}</div>'
        f"{opt_note}{RENDERERS[stype](step)}{expected}{hints_html}{docs_html}{finish}"
        "</section>"
    )


def render_nav(guide: dict) -> str:
    items = []
    for n, step in enumerate(guide["steps"], 1):
        opt = f' <span class="nav-opt" title="{UI["optional_title"]}">{UI["optional_short"]}</span>' if step.get("optional") else ""
        items.append(
            f'<li><a href="#step-{step["id"]}" data-nav="{step["id"]}">'
            '<span class="dot" aria-hidden="true"></span>'
            f'<span class="nav-num">{n:02d}</span><span class="nav-title">{esc(step["title"])}</span>{opt}'
            f'<span class="sr-only" data-nav-state>{UI["nav_not_started"]}</span></a></li>'
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
    return json_script({"id": guide["id"], "steps": steps})


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
.langs{display:flex;align-items:center;gap:4px;font-size:13px}
.langs a{padding:3px 8px;border:1px solid var(--border);border-radius:6px;text-decoration:none;color:var(--muted)}
.langs a[aria-current=page]{color:var(--fg);font-weight:650;border-color:var(--fg)}
.langs a.langs-index{border-color:transparent;margin-left:4px}
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
.nav-opt{font-size:11px;opacity:.8}
.opt-note{display:flex;gap:8px;align-items:flex-start;margin:0 0 14px;padding:2px 0 2px 12px;border-left:3px solid var(--border);color:var(--muted);font-size:14px}
.opt-note-icon{flex:none;width:16px;height:16px;margin-top:2px;border:1.5px solid currentColor;border-radius:99px;font:600 10px/13px system-ui,sans-serif;text-align:center;font-style:normal}
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
      message = fmt(L.order_pass, { total: total });
    } else {
      var parts = [fmt(L.order_positions, { n: correctPositions, total: total })];
      if (distractorsUsed > 0) parts.push(fmt(plural(distractorsUsed, L.order_extra), { n: distractorsUsed }));
      if (missing > 0) parts.push(fmt(plural(missing, L.order_missing), { n: missing }));
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
             message: fmt(pass ? L.match_pass : L.match_some, { n: correct, total: total }) };
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
      btn.textContent = ok ? L.copied : L.copy_failed;
      announce(ok ? L.copied_announce : L.copy_failed_announce);
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
  var LABELS = L.states;
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
      fmt(L.overall, { n: reqDone, total: req }) + (opt ? fmt(L.overall_optional, { n: optDone, total: opt }) : '');
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
      next.textContent = nextIsSolution ? L.show_solution : (shown === 0 ? L.show_hint : L.show_next_hint);
      count.textContent = fmt(L.hints_shown, { n: shown, total: items.length });
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
      if (all) setStatus(sec, fmt(L.fill_all, { total: p.total }) + L.run_check_tail, 'ok');
      else setStatus(sec, fmt(L.fill_some, { n: p.correct, total: p.total }), null);
      if (!quiet && all) announce(L.fill_all_announce);
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
      if (action === 'add') { answer.appendChild(li); msg = fmt(L.block_added, { b: blockLabel(li), n: current().length }); }
      else if (action === 'remove') { pool.appendChild(li); msg = fmt(L.block_removed, { b: blockLabel(li) }); }
      else if (action === 'up' && li.previousElementSibling) { list.insertBefore(li, li.previousElementSibling); }
      else if (action === 'down' && li.nextElementSibling) { list.insertBefore(li.nextElementSibling, li); }
      if (action === 'up' || action === 'down') msg = fmt(L.block_moved, { n: Array.prototype.indexOf.call(list.children, li) + 1 });
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
      if (!ans.length) { setStatus(sec, L.answer_empty, 'bad'); return; }
      var r = WG.checkOrder(s, ans);
      touch(s.id); state.solved[s.id] = r.pass;
      answer.querySelectorAll('[data-block]').forEach(function (li, i) {
        li.setAttribute('data-mark', s.solution[i] === li.getAttribute('data-block') ? 'ok' : 'bad');
      });
      var tail = r.pass ? (s.check === 'notebook' ? L.run_check_tail : '') : '';
      setStatus(sec, r.message + tail, r.pass ? 'ok' : 'bad');
      announce(r.message);
      changed(s.id);
    });
    sec.querySelector('[data-copy-assembled]').addEventListener('click', function (ev) {
      var ans = current();
      if (!ans.length) { setStatus(sec, L.answer_empty, 'bad'); return; }
      copyText(WG.assembleOrder(s, ans), ev.currentTarget);
    });
    sec.querySelector('[data-reset-ex]').addEventListener('click', function () {
      initialPool.forEach(function (li) { pool.appendChild(li); });
      persist('');
      announce(L.blocks_reset);
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
        announce(L.term_placed + zone.closest('[data-slot]').querySelector('label').textContent);
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
      if (box.checked) announce(L.step_done);
    });
    refreshStep(s.id);
  });
  refreshOverall();
  initNav();
  showStorageWarning();
  document.getElementById('reset-all').addEventListener('click', function () {
    if (!window.confirm(L.reset_confirm)) return;
    try { window.localStorage.removeItem(KEY); } catch (e) { /* nothing to clear */ }
    window.location.reload();
  });
  document.documentElement.classList.add('js');
})();
"""


L10N_JS = r"""
/* Page language: strings from #guide-l10n (build_static.py STRINGS[lang]["js"]). */
var L = JSON.parse(document.getElementById('guide-l10n').textContent);
function fmt(s, v) {
  return String(s).replace(/\{(\w+)\}/g, function (m, k) { return v[k] !== undefined ? String(v[k]) : m; });
}
/* English forms: [one, other]; Polish forms: [one, few (2-4, not 12-14), many]. */
function plural(n, forms) {
  if (forms.length === 2) return forms[n === 1 ? 0 : 1];
  if (n === 1) return forms[0];
  var d = n % 10, h = n % 100;
  return forms[(d >= 2 && d <= 4 && !(h >= 12 && h <= 14)) ? 1 : 2];
}
"""

# The guide intro says "click **Check** here" (the app); the static page has no Check button.
STATIC_INTRO = {
    "en": (r"then click \*\*Check\*\* here: [^.]*\.",
           "then run `check(...)` for it in a new cell (see the note above)."),
    "pl": (r"potem kliknij tutaj \*\*Sprawdź\*\*: [^.]*\.",
           "potem uruchom w nowej komórce `check(...)` dla tego kroku (zobacz uwagę powyżej)."),
}


def static_intro(text: str) -> tuple[str, int]:
    """Rewrites the app sentence of the intro in either language. Returns (text, replacements)."""
    total = 0
    for pattern, repl in STATIC_INTRO.values():
        text, n = re.subn(pattern, repl, text)
        total += n
    return text, total


def page_name(guide_id: str, lang: str) -> str:
    return f"{guide_id}.{lang}.html"


def json_script(value: object) -> str:
    # < keeps "</script>" and "<!--" out of the inline script; still valid JSON.
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


def render_langs(guide_id: str, lang: str) -> str:
    links = "".join(
        f'<a href="{esc(page_name(guide_id, code))}" lang="{code}" hreflang="{code}"'
        f'{" aria-current=" + chr(34) + "page" + chr(34) if code == lang else ""}'
        f' title="{esc(STRINGS[code]["lang_name"])}">{code.upper()}</a>'
        for code in LANGS
    )
    return (
        f'<nav class="langs" aria-label="{UI["lang_aria"]}">{links}'
        f'<a href="index.html" class="langs-index">{UI["all_workshops"]}</a></nav>'
    )


def render_page(guide: dict, source_name: str, lang: str = "en") -> str:
    use_lang(lang)
    notebook = Path(guide["notebook"]).stem
    n_req = sum(1 for s in guide["steps"] if not s.get("optional"))
    steps = "".join(render_step(guide, s, n) for n, s in enumerate(guide["steps"], 1))
    title = guide["title"]
    intro, _ = static_intro(guide.get("intro", ""))
    gid = esc(guide["id"])
    notice = "".join(f"<p>{p.format(id=gid, notebook=esc(notebook))}</p>" for p in UI["notice"])
    legend = UI["legend"]
    return f"""<!doctype html>
<html lang="{UI["html_lang"]}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="generator" content="notebooks/workshops/guide/build_static.py">
<title>{esc(title)} · Workshop Guide</title>
<style>{CSS}</style>
</head>
<body>
<a class="skip" href="#steps">{UI["skip"]}</a>
<div class="accent-bar"></div>
<header class="topbar"><div class="topbar-inner">
<div class="brand"><span class="logo" aria-hidden="true">WG</span>
<div><h1>{esc(title)}</h1><div class="sub">{UI["sub"].format(notebook=esc(notebook))}</div></div></div>
{render_langs(guide["id"], lang)}
<div class="overall"><span id="overall-text">{UI["overall"].format(n=n_req)}</span>
<span class="bar" role="progressbar" aria-label="{UI["overall_aria"]}" aria-valuemin="0" aria-valuemax="{n_req}" aria-valuenow="0"><span id="overall-bar"></span></span></div>
</div></header>
<div class="layout">
<nav class="steps-nav" aria-label="{UI["nav_aria"]}">
<p class="nav-title-h">{UI["steps"]}</p>
<ol>{render_nav(guide)}</ol>
<div class="nav-tools"><button type="button" class="btn btn-ghost" id="reset-all">{UI["reset"]}</button></div>
</nav>
<main id="steps">
<div class="notice" role="note">
{notice}
<p id="storage-warning" hidden>{UI["storage_warning"]}</p>
</div>
<div class="intro md">{markdown(intro)}</div>
<div class="legend" aria-hidden="true"><span><span class="dot"></span>{legend["none"]}</span>
<span data-status-v="progress"><span class="dot"></span>{legend["progress"]}</span>
<span data-status-v="ready"><span class="dot"></span>{legend["ready"]}</span>
<span data-status-v="done"><span class="dot"></span>{legend["done"]}</span></div>
{steps}
<footer class="foot">{UI["footer"].format(source=esc(source_name))}</footer>
</main>
</div>
<div id="live" class="sr-only" aria-live="polite" aria-atomic="true"></div>
<script id="guide-data" type="application/json">{client_data(guide)}</script>
<script id="guide-l10n" type="application/json">{json_script(UI["js"])}</script>
<script>{L10N_JS}{LOGIC_JS}{UI_JS}</script>
</body>
</html>
"""


def step_count(s: dict, guide: dict) -> str:
    """'8 steps + 4 optional' / '8 kroków + 4 opcjonalne', the same format as the app's picker."""
    opt = sum(1 for st in guide["steps"] if st.get("optional"))
    text = plural(len(guide["steps"]) - opt, s["step_count"])
    return text + (f" + {plural(opt, s['optional_count'])}" if opt else "")


def render_index(pages: dict[str, list[tuple[dict, str]]]) -> str:
    """pages: lang -> [(localized guide, file name)] in workshop order. Polish first, then English."""
    sections = []
    for lang in LANGS:
        s = STRINGS[lang]
        items = "".join(
            f'<li><a href="{esc(fname)}"><strong>{esc(g["title"])}</strong></a>'
            f'<span>{s["index_item"].format(count=step_count(s, g), notebook=esc(Path(g["notebook"]).stem))}</span></li>'
            for g, fname in pages.get(lang, [])
        )
        sections.append(
            f'<section lang="{lang}" aria-labelledby="idx-{lang}"><h2 id="idx-{lang}">{s["lang_name"]}</h2>'
            f'<p>{s["index_text"]}</p><ul>{items}</ul></section>'
        )
    return f"""<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="generator" content="notebooks/workshops/guide/build_static.py">
<title>Workshop Guide</title>
<style>{CSS}
.index{{max-width:640px;margin:40px auto;padding:0 16px}}
.index h2{{font-size:15px;margin:28px 0 4px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}}
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
{"".join(sections)}
</main>
</body>
</html>
"""


# --------------------------------------------------------------------------- output check

VOID = {"meta", "link", "br", "hr", "img", "input", "source", "wbr", "col", "area", "base", "embed", "track"}
ALLOWED = VOID | {
    "html", "head", "body", "title", "style", "script", "a", "div", "span", "header", "nav", "main", "footer",
    "section", "h1", "h2", "h3", "h4", "p", "ol", "ul", "li", "pre", "code", "strong", "em", "button", "label",
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


def check_page(path: Path, guide: dict, lang: str = "en") -> list[str]:
    text = path.read_text(encoding="utf-8")
    p = StructureCheck()
    p.feed(text)
    p.close()
    errors = [f"{path.name}: {e}" for e in p.errors]
    if f'<html lang="{STRINGS[lang]["html_lang"]}">' not in text:
        errors.append(f"{path.name}: html lang is not {lang}")
    for code in LANGS:
        if f'href="{page_name(guide["id"], code)}"' not in text:
            errors.append(f"{path.name}: language link to {page_name(guide['id'], code)} missing")
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


def check_index(path: Path, pages: list[str]) -> list[str]:
    text = path.read_text(encoding="utf-8")
    p = StructureCheck()
    p.feed(text)
    p.close()
    errors = [f"{path.name}: {e}" for e in p.errors]
    errors += [f"{path.name}: no link to {name}" for name in pages if f'href="{name}"' not in text]
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
    warnings: list[str] = []
    guides: list[tuple[dict, list[tuple[str, dict, str]]]] = []
    for path in paths:
        try:
            guide = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            errors.append(f"{path.name}: cannot read ({exc})")
            continue
        errs = validate_guide(guide, path.name)
        errors += errs
        if errs:
            continue
        pages, errs, warns = localized_guides(guide)
        errors += errs
        warnings += warns
        if not errs:
            guides.append((guide, pages))
    for w in warnings:
        print(f"WARN  {w}", file=sys.stderr)
    if errors:
        print("\n".join(f"ERROR {e}" for e in errors), file=sys.stderr)
        return 1

    guides.sort(key=lambda gp: (gp[0].get("number", 99), gp[0]["id"]))
    out: Path = args.out
    if not args.check:
        out.mkdir(parents=True, exist_ok=True)
        for _, pages in guides:
            for lang, g, source in pages:
                (out / page_name(g["id"], lang)).write_text(render_page(g, source, lang), encoding="utf-8")
        if not args.guides:
            index = {lang: [] for lang in LANGS}
            for _, pages in guides:
                for lang, g, _ in pages:
                    index[lang].append((g, page_name(g["id"], lang)))
            (out / "index.html").write_text(render_index(index), encoding="utf-8")
            for guide, _ in guides:  # single-language pages from before the PL/EN split
                legacy = out / f"{guide['id']}.html"
                if legacy.exists():
                    legacy.unlink()
                    print(f"removed old {legacy.name}")

    expected_pages: list[str] = []
    for _, pages in guides:
        for lang, g, _ in pages:
            page = out / page_name(g["id"], lang)
            expected_pages.append(page.name)
            if not page.exists():
                errors.append(f"{page}: missing (run without --check)")
                continue
            errors += check_page(page, g, lang)
            if page.read_text(encoding="utf-8") != render_page(g, _source(pages, lang), lang):
                errors.append(f"{page.name}: out of date (run build_static.py without --check)")
    if not args.guides:
        if (out / "index.html").exists():
            errors += check_index(out / "index.html", expected_pages)
        else:
            errors.append(f"{out / 'index.html'}: missing (run without --check)")
        extra = sorted(p.name for p in out.glob("*.html") if p.name != "index.html" and p.name not in expected_pages)
        errors += [f"{name}: stale page, no guide renders it (run without --check)" for name in extra]

    if errors:
        print("\n".join(f"ERROR {e}" for e in errors), file=sys.stderr)
        return 1
    for guide, pages in guides:
        types = {}
        for s in guide["steps"]:
            types[s["type"]] = types.get(s["type"], 0) + 1
        mix = ", ".join(f"{k} {v}" for k, v in sorted(types.items()))
        for lang, g, _ in pages:
            page = out / page_name(g["id"], lang)
            print(f"OK  {page.relative_to(out.parent) if out.parent in page.parents else page}"
                  f"  ({len(g['steps'])} steps: {mix}; {page.stat().st_size // 1024} KB)")
    return 0


def _source(pages: list[tuple[str, dict, str]], lang: str) -> str:
    return next(source for code, _, source in pages if code == lang)



if __name__ == "__main__":
    sys.exit(main())
