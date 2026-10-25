"""Which standards the school's own documents put in each grade's plans, and which they name as priority standards.

Grades 6-12 (Ma3loomat Secondary Curriculum, data/source/ma3loomat/, see audit_secondary.py):
  - In plans: cited anywhere in the course's storyboards, curriculum maps, scope & sequence or pacing guides.
  - Priority: listed in a Curriculum Map's "Grade Level Priority Standards" table or a "Unit Priority Standards"
    section, or in a Scope & Sequence titled "Priority Standard".
Grades K-5 (Curriculum Hub, data/source/hub/):
  - Power (the elementary name for priority standards): ELA from "K-5 ELA Power Standards" (the Focus Standards PDF,
    Common Core 2010 codes, ela_power_codes.json); Math, Science and Social Studies from each grade page's Standards list.
  - In plans: codes cited in grade overviews and plans (plans/*.txt exports and plans/*.codes.json).
Codes are read with scripts/standards_codes.py. Common Core 2010 ELA codes go through DPI's official crosswalk.
Wisconsin Science codes count for the NGSS / AERO standards they match, and Wisconsin Social Studies codes for the
AERO standards they match (K-5), because those are the sets the site shows. An Essential Element linked to a
priority standard is priority in that grade too (it is the alternate version of that standard).

Output: data/standards/plan_marks.json
  {"built": ..., "marks": {"WI-CC-MATH|M.6.NS.B.2": {"plans": ["6"], "priority": ["6"]}, ...}, "sources": {...}}
Read only: nothing is written to Drive. The source files are git-ignored; only the codes reach the output.
Usage: python3 scripts/audit/plan_marks.py
"""
import collections, csv, datetime, glob, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from standards_codes import Codes  # noqa: E402

C = Codes(ROOT)
OUT = os.path.join(ROOT, "data/standards/plan_marks.json")
MA = os.path.join(ROOT, "data/source/ma3loomat")
HUB = os.path.join(ROOT, "data/source/hub")
marks = collections.defaultdict(lambda: {"plans": set(), "priority": set()})
sources = collections.defaultdict(list)

# Cross-set matches: a Wisconsin Science code -> NGSS / AERO-SCI rows; a Wisconsin SS code -> AERO-SS rows.
via = collections.defaultdict(set)
for r in C.rows:
    for x in r.get("crosswalk") or []:
        if r["framework"] in ("NGSS", "AERO-SCI") and x.startswith("WI-SCI:"):
            via[("WI-SCI", x.split(":", 1)[1])].add((r["framework"], r["code"]))
        if r["framework"] == "AERO-SS":
            via[("WI-SS", x.split(":", 1)[-1])].add((r["framework"], r["code"]))
AERO_SCI = C.codes["AERO-SCI"]
K5 = {"K", "1", "2", "3", "4", "5"}
G = ["K"] + [str(i) for i in range(1, 13)]


def expand(res, grade):
    """Add the rows the site shows for a matched code: NGSS codes are AERO-SCI codes in K-5; WI codes via crosswalk."""
    out = set(res)
    for fw, c in res:
        if fw == "NGSS" and c in AERO_SCI:
            out.add(("AERO-SCI", c))
        if fw in ("WI-SCI", "WI-SS"):
            out |= {k for k in via[(fw, c)] if k[0] != "AERO-SS" or grade in K5}
    return out


def mark(text, grade, kind, ela=None):
    ela = ela or C.ela_version(text) or "wi"
    n = 0
    for raw, fam, res in C.find_codes(text, ela=ela):
        for k in expand(res, grade):
            marks[k][kind].add(grade); n += 1
    return n


# ---------- Grades 6-12: Ma3loomat documents ----------
def priority_regions(text, label):
    if label.startswith("Scope") and re.search(r"(?i)priority standard", text[:400]):
        return [text]
    if not label.startswith("Curriculum Map"):
        return []
    out = []
    for m in re.finditer(r"Priority Standards", text):        # the body table, not the table of contents
        if C.find_codes(text[m.end():m.end() + 1500]):
            end = text.find("Unit Description", m.end())
            out.append(text[m.start():end if end > 0 else len(text)]); break
    for m in re.finditer(r"Unit Priority Standards", text):
        nxt = re.search(r"Essential Element|Performance Indicator|Learning Target|Unit Vocabulary", text[m.end():])
        out.append(text[m.end():m.end() + (nxt.start() if nxt else 3000)])
    return out


for d in json.load(open(os.path.join(MA, "catalog.json"))):
    if not d.get("text_file"):
        continue
    text = open(os.path.join(ROOT, d["text_file"]), encoding="utf-8", errors="ignore").read()
    ela = (C.ela_version(text) or "wi") if d["subject"] == "ELA" else "wi"
    n = mark(text, d["grade"], "plans", ela)
    p = sum(mark(seg, d["grade"], "priority", ela) for seg in priority_regions(text, d["label"]))
    sources["secondary"].append({"grade": d["grade"], "subject": d["subject"], "course": d["course"], "doc": d["label"], "codes": n, "priority_codes": p})

# ---------- Grades K-5: Curriculum Hub ----------
power = json.load(open(os.path.join(HUB, "ela_power_codes.json")))
for g in "K12345":
    n = mark(", ".join(power[g]), g, "priority", ela="ccss")
    sources["elementary"].append({"grade": g, "subject": "ELA", "doc": "K-5 ELA Power Standards", "codes": n})


def aero_ss(token):
    """AERO Social Studies list items: 1.2.a, 3.2.a/b, 6.2.a-c, 3.5.f-h -> AERO-SS codes."""
    m = re.match(r"^(\d)\.(\d)\.([a-z])(?:([/-])([a-z]))?$", token.strip())
    if not m:
        return []
    a, b, x, sep, y = m.groups()
    letters = [x] + ([y] if sep == "/" else [chr(c) for c in range(ord(x) + 1, ord(y) + 1)] if sep else [])
    return [("AERO-SS", f"{a}.{b}.{l}") for l in letters if f"{a}.{b}.{l}" in C.codes["AERO-SS"]]


for g, tab in zip("K12345", ["KG", "G1", "G2", "G3", "G4", "G5"]):
    rows = list(csv.reader(open(os.path.join(HUB, f"{tab}.csv"), encoding="utf-8")))
    on = False
    for r in rows:
        if r and re.search(r"LINKS\s+\[.*standards\]", r[0]):
            on = True; continue
        if on and r and re.match(r"\s*(LINKS|PAGE INFO|INFO PANELS)", r[0]):
            on = False
        if not on or len(r) < 2 or r[0] not in ("Mathematics", "Science", "Social Studies"):
            continue
        code = r[1].split(" — ")[0].strip()
        found = aero_ss(code) if r[0] == "Social Studies" else {k for _, _, res in C.find_codes(code) for k in res}
        for k in expand(found, g):
            marks[k]["priority"].add(g)
        sources["elementary"].append({"grade": g, "subject": r[0], "doc": "Curriculum Hub grade standards", "code": code, "matched": len(found)})

for path in sorted(glob.glob(os.path.join(HUB, "plans", "*.txt"))):
    name = os.path.basename(path)[:-4]
    g = name.split("_")[0].replace("G", "").replace("KG", "K") or "K"
    n = mark(open(path, encoding="utf-8-sig").read(), g, "plans")
    sources["elementary"].append({"grade": g, "doc": name, "codes": n})
def norm_token(t):
    """Elementary plans write codes loosely ("RL5.3", "EE 5.RF.3d", "1 PS4 - 3", "W5.3a-b", "L.2.1-2", "1.NBT.A").
    Return codes find_codes() can read, "AERO:" Social Studies codes, or "CLUSTER:" math clusters. Domain-only codes
    (3.MD) are too broad to stand for a standard and are dropped."""
    t = re.sub(r"[\u2010-\u2015\u2212]", "-", t).strip()
    m = re.match(r"^(K|[1-5]|MS|HS)\s*-?\s*(PS|LS|ESS|ETS)(\d)\s*-\s*(\d+)$", t, re.I)
    if m:                                                     # NGSS engineering is banded: K-ETS1-2 is K-2-ETS1-2
        band = {"K": "K-2", "1": "K-2", "2": "K-2", "3": "3-5", "4": "3-5", "5": "3-5"}.get(m[1].upper()) if m[2].upper() == "ETS" else None
        return [f"{band or m[1].upper()}-{m[2].upper()}{m[3]}-{m[4]}"]
    m = re.match(r"^(\d)\.(\d)\.?([a-z])$", t)
    if m:
        return [f"AERO:{m[1]}.{m[2]}.{m[3]}"]
    m = re.match(r"^(?:CCSS\.MATH\.CONTENT\.)?(K|\d)\.([A-Z]{1,3})\.([A-D])$", t, re.I)
    if m:
        return [f"CLUSTER:M.{m[1].upper()}.{m[2].upper()}.{m[3].upper()}."]
    t2 = re.sub(r"^EE[\s.]*", "EE.", t, flags=re.I)
    m = re.match(r"^(EE\.)?(K|\d)\.(RF|RL|RI|W|SL|L|R)\.?(\d+)\.?([a-z])?$", t2, re.I)      # EE.5.RF.3a: grade first
    if m:
        t2 = f"{m[1] or ''}{m[3]}.{m[2]}.{m[4]}" + (f".{m[5]}" if m[5] else "")
    m = re.match(r"^(EE\.)?(RF|RL|RI|W|SL|L|R)\s*\.?\s*(K|\d{1,2})\.(\d+)(?:-(\d+))?\.?([a-z])?(?:-([a-z]))?$", t2, re.I)
    if m:
        ee, kind, g, n, n2, a, b = m.groups()
        nums = range(int(n), int(n2) + 1) if n2 else [int(n)]
        letters = [chr(c) for c in range(ord(a.lower()), ord(b.lower()) + 1)] if a and b else [a.lower()] if a else [""]
        return [f"{'EE.' if ee else ''}{kind.upper()}.{g.upper()}.{x}" + (f".{l}" if l else "") for x in nums for l in letters]
    return [t]


for path in sorted(glob.glob(os.path.join(HUB, "plans", "*.codes.json"))):
    d = json.load(open(path))
    if not d.get("read_ok") or not d.get("codes"):
        continue
    toks = [x for t in d["codes"] for x in norm_token(t)]
    found = set()
    for t in toks:
        if t.startswith("AERO:"):
            found |= {("AERO-SS", t[5:])} if t[5:] in C.codes["AERO-SS"] else set()
        elif t.startswith("CLUSTER:"):
            found |= {("WI-CC-MATH", c) for c in C.codes["WI-CC-MATH"] if c.startswith(t[8:])}
    for k in expand(found, d["grade"]):
        marks[k]["plans"].add(d["grade"])
    text = " ; ".join(t for t in toks if not t.startswith(("AERO:", "CLUSTER:")))
    n = mark(text, d["grade"], "plans") + len(found)
    sources["elementary"].append({"grade": d["grade"], "doc": d["name"], "codes": n})

# ---------- Essential Elements linked to a priority standard ----------
def in_band(band, g):
    m = re.match(r"^(K|\d+)-(\d+)$", band or "")
    return bool(m) and G.index(m.group(1)) <= G.index(g) <= G.index(m.group(2))


for r in C.rows:
    if r["framework"].startswith("WI-EE-"):
        for x in r.get("crosswalk") or []:
            fw, _, code = x.partition(":")
            for g in list(marks.get((fw, code), {}).get("priority", ())):
                if g == r["grade"] or in_band(r.get("grade_band"), g):
                    marks[(r["framework"], r["code"])]["priority"].add(g)

out = {"built": datetime.date.today().isoformat(),
       "about": "In plans and priority (6-12) / power (K-5) standards per grade, from the school's curriculum documents. Built by scripts/audit/plan_marks.py.",
       "marks": {f"{fw}|{c}": {k: sorted(v, key=G.index) for k, v in m.items() if v}
                 for (fw, c), m in sorted(marks.items()) if c in C.codes[fw]},
       "sources": sources}
json.dump(out, open(OUT, "w"), indent=0, ensure_ascii=False)
cnt = collections.Counter()
for k, m in out["marks"].items():
    fw = k.split("|")[0]
    for kind, gs in m.items():
        for g in gs:
            cnt[(fw, "K-5" if g in K5 else "6-12", kind)] += 1
for k in sorted(cnt):
    print(k, cnt[k])
