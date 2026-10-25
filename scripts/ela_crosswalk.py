"""Build the official Common Core (2010) to Wisconsin 2020 ELA crosswalk from DPI's comparison document.

Source: "2010 to 2020 Wisconsin's Standards for English Language Arts Comparison" (DPI, https://dpi.wi.gov/media/42256),
saved as data/source/dpi/ela_2010_2020_comparison.pdf (git-ignored). Each page shows the 2020 standard in the top row
of each column and the matching 2010 standard(s) underneath. Where a 2010 standard moved, DPI notes it on the 2010
line, for example "W.6.1 (see W.6.2a 2020) Write arguments...". Writing, Language and Speaking & Listening were
renumbered in 2020 (Common Core W.6.1 arguments is Wisconsin W.6.2.a; Common Core L.6.1 grammar is Wisconsin L.6.5).

Output: data/standards/ela_crosswalk_2010_2020.json
  {"to2010": {"W.6.2.a": ["W.6.1"], ...},   # every Wisconsin 2020 row on the site -> its Common Core 2010 code(s)
   "to2020": {"W.6.1": ["W.6.2.a"], ...}}   # every Common Core 2010 code (parent and lettered) -> Wisconsin 2020 rows
Usage: pdftotext -bbox data/source/dpi/ela_2010_2020_comparison.pdf data/source/dpi/cmp_bbox.html
       python3 scripts/ela_crosswalk.py
"""
import collections, html, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data/source/dpi/cmp_bbox.html")
OUT = os.path.join(ROOT, "data/standards/ela_crosswalk_2010_2020.json")

CODE = re.compile(r"^(RF|RL|RI|R|W|SL|L)\s?\.?\s?(K|1[0-2]|[1-9]|9-10|11-12)\s?\.\s?(\d+)\.?$")
WORD = re.compile(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>')


def pages():
    for chunk in open(SRC, encoding="utf-8").read().split("<page ")[1:]:
        yield [(float(a), float(b), html.unescape(w)) for a, b, _, _, w in WORD.findall(chunk)]


def lines_of(words):
    """Group words into lines (same baseline), left to right."""
    out = []
    for x, y, w in sorted(words, key=lambda t: (round(t[1]), t[0])):
        if out and abs(out[-1][0] - y) < 3:
            out[-1][1].append((x, w))
        else:
            out.append([y, [(x, w)]])
    return [(y, sorted(ws)) for y, ws in out]


def norm(kind, grade, num, sub=""):
    return f"{kind}.{grade}.{num}" + (f".{sub.lower()}" if sub else "")


SEE = re.compile(r"\(see\s+(?:standard\s+)?(?:(RF|RL|RI|R|W|SL|L)\s?\.?\s?)?(K|1[0-2]|[1-9]|9-10|11-12)\.\s?(\d+)\s?\.?\s?([a-f])?", re.I)


FAMILY = {"RL": "R", "RI": "R"}


def parse():
    """Pairs [(2020 parent code, {code, subs, see})]: each 2010 standard with the 2020 standard it sits under.

    Columns are one grade each. A 2010 code is paired with the latest 2020 code of the same strand and grade, so stacked
    standards and pages that continue a column from the page before are handled. Column state carries across pages."""
    pairs, last2020 = [], {}
    prev = {"bounds": None, "state": [], "cur2020": [], "cur2010": [], "sub": []}
    for words in pages():
        if re.search(r"Range of Reading|TEXT COMPLEXITY", " ".join(w for _, _, w in words[:12])):
            continue                                          # 2010 RL/RI.10 (text complexity) has no 2020 standard
        hx = sorted(x for (x, y, w), nxt in zip(words, words[1:] + [(0, 0, "")]) if w in ("2020", "2010") and nxt[2] == "Standard")
        heads = []
        for x in hx:                                          # one column per distinct header position
            if not heads or x - heads[-1] > 20:
                heads.append(x)
        if heads and prev["bounds"] and len(heads) == len(prev["bounds"]):
            st = prev                                         # same layout: keep each column's state
            st["bounds"] = heads
        elif heads:
            st = {"bounds": heads, "state": [None] * len(heads), "cur2020": [None] * len(heads), "cur2010": [None] * len(heads), "sub": [None] * len(heads)}
        elif prev["bounds"]:
            st = prev                                         # a page with no headers continues the previous columns
        else:
            continue
        bounds = st["bounds"]
        for y, ws in lines_of(words):
            parts = collections.defaultdict(list)
            for x, w in ws:
                i = max([k for k, b in enumerate(bounds) if x >= b - 6] or [0])
                parts[i].append((x, w))
            for i, pw in parts.items():
                text = " ".join(w for _, w in pw)
                if text.startswith("2020 Standard"):
                    st["state"][i] = "2020"; continue
                if text.startswith("2010 Standard"):
                    st["state"][i] = "2010"; st["cur2010"][i] = None; continue
                if text.startswith("For reference") or "Continued on next page" in text:
                    st["state"][i] = None; continue
                state = st["state"][i]
                if not state:
                    continue
                toks, code, rest = text.split(), None, text
                for n in (1, 2, 3):                           # "RF 1.1", "W.2. 4." are split into words
                    m = CODE.match("".join(toks[:n]))
                    if m:
                        code = norm(*m.groups()); rest = " ".join(toks[n:]); break
                # Language and Speaking & Listening pages give the 2010 code as a bare number ("3. Use knowledge of
                # language...") at the column's left edge; it takes the strand and grade of the 2020 code above it.
                bare = re.match(r"^(\d+)\.+\s?(.*)$", text)
                if not code and bare and state == "2010" and st["cur2020"][i] and pw[0][0] - bounds[i] < 8:
                    kind, grade = st["cur2020"][i].split(".")[:2]
                    code, rest = f"{kind}.{grade}.{bare.group(1)}", bare.group(2)
                if code and "Begins in grade" in rest:
                    code = None; st["cur2010"][i] = None; continue
                sub = re.match(r"^([a-f])\.\s?", text)
                if code:
                    st["sub"][i] = None
                    kind, grade = code.split(".")[:2]
                    fam = (FAMILY.get(kind, kind), grade)
                    if state == "2020":
                        st["cur2020"][i] = code; last2020[fam] = code
                    else:
                        parent = last2020.get(fam) or st["cur2020"][i]
                        e = {"code": code, "subs": {}, "see": None}
                        st["cur2010"][i] = e
                        if parent:
                            pairs.append((parent, e))
                    text = rest
                elif sub and state == "2010" and st["cur2010"][i]:
                    st["sub"][i] = sub.group(1).lower()
                    st["cur2010"][i]["subs"].setdefault(st["sub"][i], None)
                s = SEE.search(text)
                cur = st["cur2010"][i]
                if s and state == "2010" and cur:
                    k, g, n, letter = s.groups()
                    kind = (k or cur["code"].split(".")[0]).upper()
                    grade = cur["code"].split(".")[1]          # DPI sometimes copied a K code into later grades
                    if kind == "W" and grade in ("K", "1", "2") and cur["code"].endswith(".2") and (n, letter) == ("3", "b"):
                        n = "2"                               # DPI typo in K-2: informative writing is W.g.2b, as in grades 3-12
                    tgt = norm(kind, grade, n, letter or "")
                    if st["sub"][i] and not code:
                        cur["subs"][st["sub"][i]] = tgt
                    else:
                        cur["see"] = tgt
        prev = st
    return pairs


def build():
    site = [r["code"] for r in json.load(open(os.path.join(ROOT, "data/standards/all_standards.json"))) if r["framework"] == "WI-CC-ELA"]
    rows = collections.defaultdict(list)                  # 2020 parent -> site rows (lettered or not)
    for c in site:
        rows[re.sub(r"\.[a-z]$", "", c)].append(c)
    to2020 = collections.defaultdict(set)

    def targets(code):
        """A 2020 code like W.6.2a or W.6.2 -> the site rows it names."""
        m = re.match(r"^(.*\.\d+)\.([a-z])$", code)
        if m and m.group(0) in site:
            return [m.group(0)]
        return rows.get(m.group(1) if m else code, [])

    for parent, e in parse():
        if parent not in rows:
            continue
        base = targets(e["see"]) if e["see"] else rows[parent]
        for r in base:
            to2020[e["code"]].add(r)
        for letter, red in e["subs"].items():
            # A lettered part keeps its letter when the standard kept its number (RF.K.3.a is RF.K.3.a in both).
            same = f"{e['code']}.{letter}" if not e["see"] and parent == e["code"] and f"{e['code']}.{letter}" in site else None
            for r in (targets(red) if red else [same] if same else base):
                to2020[f"{e['code']}.{letter}"].add(r)
    to2010 = collections.defaultdict(set)
    for old, news in to2020.items():
        if re.search(r"\.[a-z]$", old):
            continue                                      # show parent 2010 codes only (W.6.1, not W.6.1.e)
        for n in news:
            to2010[n].add(old)
    # A moved sub-item (2010 W.6.1.e "concluding statement" -> 2020 W.6.3.a) also names its parent on the 2020 row.
    for old, news in to2020.items():
        m = re.match(r"^(.*)\.([a-z])$", old)
        if m:
            for n in news:
                if m.group(1) not in to2010[n]:
                    to2010[n].add(old)
    # A few columns in DPI's document are mislabelled or miss their code (SL.3.2, W.4.7, RF.4.3, RF.5.3). Where the
    # strand kept its numbering in 2020 (Foundational Skills, Speaking & Listening, Writing 4-9), the 2010 code is the
    # same as the 2020 one. Standards that are new in 2020 stay without a 2010 code.
    NEW = {"RF.2.2", "W.K.4", "W.1.4", "W.2.4", "W.K.9", "W.1.9", "W.2.9", "W.3.9"}
    same = []
    for c in site:
        parent = re.sub(r"\.[a-z]$", "", c)
        kind, _, num = parent.split(".")
        if c not in to2010 and parent not in NEW and (kind in ("RF", "SL") or (kind == "W" and 4 <= int(num) <= 9)):
            to2010[c].add(parent); to2020[parent].add(c); same.append(c)
    key = lambda c: [(0, int(p), "") if p.isdigit() else (1, 0, p) for p in re.split(r"[.-]", c)]
    out = {"source": "DPI, 2010 to 2020 Wisconsin's Standards for English Language Arts Comparison (https://dpi.wi.gov/media/42256)",
           "same_code_fallback": sorted(set(same)),
           "to2010": {k: sorted(v, key=key) for k, v in sorted(to2010.items())},
           "to2020": {k: sorted(v, key=key) for k, v in sorted(to2020.items())}}
    json.dump(out, open(OUT, "w"), indent=1)
    missing = [c for c in site if c not in to2010]
    print(f"{len(out['to2010'])} of {len(site)} Wisconsin 2020 rows have a 2010 code; {len(out['to2020'])} 2010 codes mapped")
    print("No 2010 code (new in 2020 or not in the comparison):", len(missing), missing[:60])


if __name__ == "__main__":
    build()
