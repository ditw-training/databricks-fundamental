# Workshop Guide files

This folder holds the step-by-step guides for the two workshops:

| file | workshop | notebook |
|---|---|---|
| `ws_delta.json` | Workshop — Delta Lake | `notebooks/workshops/WORKSHOP_delta.ipynb` |
| `ws_ingestion.json` | Workshop — Ingestion | `notebooks/workshops/WORKSHOP_ingestion.ipynb` |

The JSON format is defined in `apps/SPEC_workshop_guide.md` (section 3). Two things read
these files:

- the **Workshop Guide app** (`apps/workshop-guide/`), used in the classroom, which also
  shows live `check()` results from the notebook;
- the **static edition** in `html/`, for self-study and for workspaces without the app
  (for example Databricks Free Edition).

## Static edition

`build_static.py` turns every guide into one self-contained HTML page:

```
html/
  index.html          links to both workshops
  ws_delta.html
  ws_ingestion.html
```

Each page has all CSS and JavaScript inline. It loads nothing from the internet, so it
works when opened straight from disk (`file://`), offline, or from any static web host.

### Regenerate after editing a guide

Run from the repository root (Python 3.9+, standard library only):

```
python3 -I notebooks/workshops/guide/build_static.py
```

The script:

1. validates each guide with the same rules as the app (blank ids match the template,
   every order block is either solution or distractor, optional steps are `code`, and so on);
2. writes `html/<id>.html` and `html/index.html`;
3. parses the output again and checks it: balanced tags, unique ids, every step rendered
   with the right number of blanks, blocks, pairs, hints and doc links.

It exits with a non-zero code and prints `ERROR ...` lines when something is wrong.
Other options:

```
python3 -I notebooks/workshops/guide/build_static.py --check        # verify html/ only
python3 -I notebooks/workshops/guide/build_static.py --out DIR      # write somewhere else
python3 -I notebooks/workshops/guide/build_static.py ws_delta.json  # one guide, no index
```

The files in `html/` are generated. Do not edit them by hand: change the JSON and
regenerate, then commit the JSON and the HTML together.

### How participants use it

1. Open `html/index.html` (or the workshop page directly) in a browser. Double-click
   works; no server is needed.
2. Open the workshop notebook in Databricks next to it.
3. For each step, read the explanation and solve the exercise on the page:
   - **Fill in**: type into the blanks. Each blank turns green or red as you type.
     **Copy code** copies the finished code, with `____` left in any empty blank.
   - **Order**: drag the blocks into *Your answer*, or use **Add**, **↑**, **↓** and **✕**
     (all reachable with the keyboard). Some blocks are traps and must stay out.
     **Check order** grades it, **Copy code** copies the assembled statement.
   - **Match**: drag each term onto its description, or pick it from the list next to the
     description. **Check answers** grades it.
   - **Code**: write the code in the notebook. The starter cell is shown on the page.
4. Hints open one at a time. The last hint is the full solution and asks for
   confirmation first. Doc links open Microsoft Learn in a new tab.
5. Paste the code into the notebook cell and run the `check("<workshop>", "<step>")` cell
   under it. When it prints `PASS`, tick **check() passed in my notebook** on the page.
   Match steps are graded on the page and are marked done automatically.

> **Note**
> The static edition is not connected to Databricks. It cannot read the progress table,
> so steps never turn green on their own and the trainer does not see this progress.
> Use the app in the classroom when it is available.

Progress (typed blanks, block order, matches, revealed hints, ticked steps) is saved in
the browser's local storage, per workshop and per browser. It is not shared between
browsers or computers. If the browser blocks local storage (some private windows), the
page still works and shows a note that progress is lost on close. **Reset my progress**
in the step list clears it.

The page follows the system light or dark theme and works on narrow screens.
