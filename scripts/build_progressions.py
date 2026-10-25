"""Progression lanes: how each idea builds from grade to grade, for the Progressions page, the Gaps page and the popup.

A lane is one idea followed K-12. Its steps are the standards for that idea in each grade (in placement order), and
its links join each standard to the standard in the step before it that it most clearly builds on.
How lanes are formed (the "basis", shown on the site so users know how sure each lane is):
  anchor  ELA: the same Wisconsin anchor standard in every grade (R.K.1 ... R.11-12.1). Official structure.
  dci     Science: the same NGSS disciplinary core idea component (PS2.A Forces and Motion), using the Wisconsin
          Science codes each NGSS / AERO standard is matched to. Official structure.
  wiss    Social Studies: the same Wisconsin Social Studies standard (SS.Hist2.a) at each level; K-5 AERO
          standards join through their suggested Wisconsin matches. Official structure, with suggested matches.
  topic   Math: Common Core topics followed across domains (place value, fractions, ratios, functions...), grouped
          by cluster for this site after the Common Core progressions documents. Inferred grouping.
Links inside a lane join a standard to the most similar standards in the step before it (word overlap, up to three
when several match about as well); they are labelled inferred, and the site hides links weaker than MIN_SIM in app.js.
A link whose two standards have the same wording is marked, so the site can say the standard repeats rather than builds.
Math topics that carry on in another topic (fractions into the number system) name it in "next".
Output: site/data/progressions.json
Usage: python3 scripts/build_progressions.py (after build_site_data.py)
"""
import collections, json, math, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
G = ["K"] + [str(i) for i in range(1, 13)]
IDX = {s: json.load(open(os.path.join(ROOT, f"site/data/index_{v}.json"))) for s, v in
       [("Math", "math"), ("ELA", "ela"), ("Science", "science"), ("Social Studies", "social_studies")]}
ROWS = json.load(open(os.path.join(ROOT, "data/standards/all_standards.json")))
XW = collections.defaultdict(list)                           # (fw, code) -> crosswalk entries
TEXT = {}                                                      # "fw|code" -> full text, to spot repeated wording
for r in ROWS:
    XW[(r["framework"], r["code"])] = r["crosswalk"] or XW[(r["framework"], r["code"])]
    TEXT.setdefault(r["framework"] + "|" + r["code"], r["text"] or "")


def home(e):
    """Grades a standard is placed in, before any grades added from plans."""
    return [g for g in e["pl"] if g not in e.get("pa", [])] or e["pl"]


# ---------- text similarity for links ----------
STOP = set("a an and are as at be by for from in into is it its of on or that the their them they this to use using with "
           "students student grade text texts including e g eg such other two one more than within each about how what when".split())
def toks(t): return [w for w in re.findall(r"[a-z]+", t.lower()) if w not in STOP and len(w) > 2]


def own_text(e):
    """The full text of a standard (the index keeps only the start); a lettered part keeps only its own words, since
    every part repeats its parent's stem (L.7.1.b would otherwise match L.6.1.a as well as L.6.1.b)."""
    t = TEXT.get(e["f"] + "|" + e["c"]) or e["t"]
    m = re.search(r"\.([a-z])$", e["c"])
    if m:
        part = re.search(rf"(?:^|\s){m[1]}[.)]\s+(.+)", t)
        if part:
            t = re.split(r"\s[a-z][.)]\s", part[1])[0]
    return t


BYKEY = {e["f"] + "|" + e["c"]: e for es in IDX.values() for e in es}
_norm = lambda t: re.sub(r"[^a-z0-9]+", " ", t.lower()).strip()
same = lambda a, b: a in BYKEY and b in BYKEY and _norm(own_text(BYKEY[a])) == _norm(own_text(BYKEY[b])) != ""


class Sim:
    def __init__(self, items):
        df = collections.Counter(w for e in items for w in set(toks(own_text(e))))
        n = len(items) or 1
        self.idf = {w: math.log(n / c) + 1 for w, c in df.items()}
        self.vec = {}
        for e in items:
            tf = collections.Counter(toks(own_text(e)))
            v = {w: c * self.idf[w] for w, c in tf.items()}
            norm = math.sqrt(sum(x * x for x in v.values())) or 1
            self.vec[e["f"] + "|" + e["c"]] = {w: x / norm for w, x in v.items()}

    def __call__(self, a, b):
        va, vb = self.vec.get(a, {}), self.vec.get(b, {})
        return sum(x * vb.get(w, 0) for w, x in va.items())


def lane(subject, lid, name, group, basis, members, sim, note=""):
    """members: index entries in this lane. Steps group them by their first home grade; links join each standard to
    its most similar standard in the step before (inferred)."""
    by = collections.OrderedDict()
    for e in sorted(members, key=lambda e: (G.index(home(e)[0]), e["c"])):
        by.setdefault(G.index(home(e)[0]), []).append(e)
    steps = [{"g": sorted({g for e in es for g in home(e)}, key=G.index), "k": [e["f"] + "|" + e["c"] for e in es]} for es in by.values()]
    links = []                                                 # [earlier, later, similarity, 1 if same wording]
    for a, b in zip(steps, steps[1:]):
        for k in b["k"]:
            ranked = sorted(a["k"], key=lambda x: -sim(x, k))
            top = sim(ranked[0], k)
            for x in [x for x in ranked if x == ranked[0] or sim(x, k) >= max(0.12, 0.75 * top)][:3]:
                links.append([x, k, round(sim(x, k), 2), 1 if same(x, k) else 0])
    return {"id": lid, "subject": subject, "name": name, "group": group, "basis": basis, "note": note, "steps": steps, "links": links}


lanes = []

# ---------- ELA: Wisconsin anchor standards ----------
ela = [e for e in IDX["ELA"] if e["f"] == "WI-CC-ELA"]
sim = Sim(ela)
STRAND = {"RF": "Foundational Skills", "R": "Reading", "W": "Writing", "SL": "Speaking and Listening", "L": "Language"}
groups = collections.OrderedDict()
for e in ela:
    m = re.match(r"^(RF|R|W|SL|L)\.(K|\d+|9-10|11-12)\.(\d+)", e["c"])
    if m:
        groups.setdefault((m[1], int(m[3])), []).append(e)
for (kind, num), es in sorted(groups.items(), key=lambda x: (list(STRAND).index(x[0][0]), x[0][1])):
    ref = next((e for e in es if home(e)[0] in ("6", "5", "4")), es[0])
    full = TEXT.get(ref["f"] + "|" + ref["c"]) or ref["t"]
    short = re.split(r"(?<=[a-z])[.;]\s", full)[0]
    short = short.split(": ")[0] + ("…" if ": " in short else "")   # a list follows a colon: say the name continues
    short = re.sub(r"\s+[a-z]$", "", short.strip())            # a part letter left at the end ("... (phonemes). a")
    short = short if len(short) <= 110 else short[:110].rsplit(" ", 1)[0].rstrip(" ,") + "…"
    # The name quotes one grade's standard (Grade 4-6 where there is one), so it says which grade.
    short += f" (Grade {home(ref)[0]} wording)" if home(ref)[0] != "K" else " (Kindergarten wording)"
    # Wisconsin renumbered Writing, Language and Speaking and Listening in 2020, so their anchor numbers are Wisconsin's.
    label = f"{STRAND[kind]} {num}" + (" (Wisconsin numbering)" if kind in ("W", "L", "SL") else "")
    lanes.append(lane("ELA", f"ELA-{kind}{num}", f"{label}: {short}", f"{STRAND[kind]} · {ref['cl'] or ''}".rstrip(" ·"), "anchor", es, sim))

# ---------- Math: Common Core topics ----------
TOPICS = [
    ("count", "Counting and cardinality", ["K.CC", "1.NBT.A"]),
    ("place", "Place value", ["K.NBT.A", "1.NBT.B", "2.NBT.A", "3.NBT.A.1", "4.NBT.A", "5.NBT.A"]),
    ("addsub", "Addition and subtraction", ["K.OA.A", "1.OA", "2.OA.A", "2.OA.B", "1.NBT.C", "2.NBT.B", "2.MD.B", "3.NBT.A.2", "4.NBT.B.4"]),
    ("muldiv", "Multiplication and division", ["2.OA.C", "3.OA", "3.NBT.A.3", "4.OA.A", "4.OA.B", "4.OA.D", "4.NBT.B.5", "4.NBT.B.6", "5.NBT.B.5", "5.NBT.B.6", "6.NS.B.2", "6.NS.B.4"]),
    ("decimals", "Decimals", ["4.NF.C", "5.NBT.B.7", "6.NS.B.3"]),
    ("fractions", "Fractions", ["1.G.A.3", "2.G.A.3", "3.G.A.2", "3.NF", "4.NF.A", "4.NF.B", "5.NF", "6.NS.A"]),
    ("ratio", "Ratios and proportional relationships", ["6.RP", "7.RP", "7.G.A.1", "8.EE.B"]),
    ("numsys", "The number system (negative, rational and real numbers)", ["6.NS.C", "7.NS", "8.NS", "N.RN", "N.CN"]),
    ("expr", "Expressions", ["5.OA.A", "6.EE.A", "7.EE.A", "8.EE.A", "A.SSE", "A.APR"]),
    ("eq", "Equations and inequalities", ["6.EE.B", "7.EE.B", "8.EE.C", "A.CED", "A.REI"]),
    ("func", "Patterns and functions", ["3.OA.D.9", "4.OA.C", "5.OA.B", "6.EE.C", "8.F", "F.IF", "F.BF", "F.LE", "F.TF"]),
    ("meas", "Measurement: length, time, money and units", ["K.MD.A", "1.MD.A", "1.MD.B", "2.MD.A", "2.MD.C", "3.MD.A", "4.MD.A.1", "4.MD.A.2", "5.MD.A", "N.Q"]),
    ("area", "Area, perimeter and volume", ["3.MD.C", "3.MD.D", "4.MD.A.3", "5.MD.C", "6.G.A.1", "6.G.A.2", "6.G.A.4", "7.G.B.4", "7.G.B.6", "8.G.C", "G.GMD.A", "G.GMD.C", "G.C.B"]),
    ("data", "Data and statistics", ["K.MD.B", "1.MD.C", "2.MD.D", "3.MD.B", "4.MD.B", "5.MD.B", "6.SP", "7.SP.A", "7.SP.B", "8.SP", "SP.ID", "SP.IC"]),
    ("prob", "Probability", ["7.SP.C", "SP.CP", "SP.MD"]),
    ("shapes", "Shapes and their attributes", ["K.G", "1.G.A.1", "1.G.A.2", "2.G.A.1", "2.G.A.2", "3.G.A.1", "4.G.A.2", "4.G.A.3", "5.G.B", "7.G.A.2", "7.G.A.3", "G.GMD.B"]),
    ("angles", "Lines, angles and transformations", ["4.MD.C", "4.G.A.1", "7.G.B.5", "8.G.A", "G.CO", "G.SRT", "G.C.A"]),
    ("coord", "Coordinate plane and the Pythagorean theorem", ["5.G.A", "6.NS.C.6.b", "6.NS.C.8", "6.G.A.3", "8.G.B", "G.GPE"]),
    ("vectors", "Vectors and matrices", ["N.VM"]),
]
math_rows = [e for e in IDX["Math"] if e["f"] == "WI-CC-MATH"]
sim = Sim(math_rows)
members = collections.defaultdict(list); unassigned = []
for e in math_rows:
    key = re.sub(r"^M\.", "", e["c"])
    best = max(((len(p), tid) for tid, _, ps in TOPICS for p in ps if re.match(re.escape(p) + r"(\.|$)", key)), default=None)
    (members[best[1]].append(e) if best else unassigned.append(e["c"]))
# Where a topic carries on under another name in later grades (Common Core progressions documents).
NEXT = {"count": ["place"], "place": ["decimals", "addsub"], "addsub": ["muldiv"], "muldiv": ["fractions", "expr"], "decimals": ["numsys"],
        "fractions": ["ratio", "numsys"], "ratio": ["func"], "numsys": ["expr"], "expr": ["eq"], "eq": ["func"], "meas": ["area"],
        "data": ["prob"], "shapes": ["angles"], "coord": ["angles"]}
for tid, name, _ in TOPICS:
    lanes.append(lane("Math", f"Math-{tid}", name, "Common Core topics", "topic", members[tid], sim,
                      "Grouped by cluster for this site, following the Common Core progressions documents."))
    lanes[-1]["next"] = [f"Math-{x}" for x in NEXT.get(tid, [])]

# ---------- Science: NGSS disciplinary core idea components ----------
sci = [e for e in IDX["Science"] if (e["f"] == "AERO-SCI") or (e["f"] == "NGSS" and any(g not in "K12345" or len(g) > 1 for g in home(e)))]
sim = Sim(sci)
NAMES = {}
for e in IDX["Science"]:
    for comp, nm in re.findall(r"\b((?:PS|LS|ESS|ETS)\d\.[A-D]) ([^,()]+)", e.get("cl") or ""):
        NAMES.setdefault(comp, nm.strip())
NAMES["PS4.C"] = "Information Technologies and Instrumentation"   # the source cluster text is cut short
comp_members = collections.defaultdict(list)
for e in sci:
    comps = {m.group(1) for x in XW[(e["f"], e["c"])] for m in [re.match(r"WI-SCI:SCI\.((?:PS|LS|ESS|ETS)\d\.[A-D])\.", x)] if m}
    if not comps:
        m = re.search(r"(PS|LS|ESS|ETS)(\d)", e["c"]); comps = {f"{m[1]}{m[2]}"} if m else set()
    for c in comps:
        comp_members[c].append(e)
DISC = {"PS": "Physical Science", "LS": "Life Science", "ESS": "Earth and Space Science", "ETS": "Engineering"}
for comp in sorted(comp_members, key=lambda c: (list(DISC).index(re.match(r"[A-Z]+", c).group(0)), c)):
    lanes.append(lane("Science", f"Science-{comp}", f"{comp} {NAMES.get(comp, '')}".strip(), DISC[re.match(r"[A-Z]+", comp).group(0)], "dci", comp_members[comp], sim))

# ---------- Social Studies: Wisconsin standards, with AERO in K-5 ----------
ss = [e for e in IDX["Social Studies"] if e["f"] == "AERO-SS" or (e["f"] == "WI-SS" and any(g not in ("K", "1", "2", "3", "4", "5") for g in home(e)))]
sim = Sim(ss)
key_members = collections.defaultdict(list); key_name = {}; key_group = {}
for e in ss:
    codes = [x.split(":")[-1] for x in XW[(e["f"], e["c"])]] if e["f"] == "AERO-SS" else [e["c"]]
    for c in codes:
        m = re.match(r"^(SS\.[A-Za-z]+\d)\.([a-z])", c)
        if m:
            key_members[f"{m[1]}.{m[2]}"].append(e)
            if e["f"] == "WI-SS":
                # cluster is "SS.Geog1: <standard> | Geog1.a: Tools of geography"; keep the short title after the last "|"
                key_name.setdefault(f"{m[1]}.{m[2]}", re.sub(r"^[A-Za-z]+\d\.[a-z]:\s*", "", (e["cl"] or "").split("|")[-1].strip())); key_group.setdefault(f"{m[1]}.{m[2]}", e["s"])
for k in sorted(key_members):
    if len({G.index(home(e)[0]) for e in key_members[k]}) < 2 and not any(e["f"] == "WI-SS" for e in key_members[k]):
        continue
    lanes.append(lane("Social Studies", f"SS-{k}", f"{k[3:]} {key_name.get(k, '')}".strip(), key_group.get(k, "Social Studies"), "wiss", key_members[k], sim,
                      "K-5 AERO standards join through their suggested Wisconsin matches."))

lanes = [l for l in lanes if l["steps"]]
out = {"built": __import__("datetime").date.today().isoformat(),
       "basis": {"anchor": "Official: the same Wisconsin anchor standard in each grade.",
                 "dci": "Official: the same NGSS disciplinary core idea, through the Wisconsin Science codes each standard is matched to.",
                 "wiss": "Official Wisconsin Social Studies standard; K-5 AERO standards join through suggested matches.",
                 "topic": "Inferred: Common Core topics followed across domains, grouped by cluster for this site."},
       "lanes": lanes}
json.dump(out, open(os.path.join(ROOT, "site/data/progressions.json"), "w"), ensure_ascii=False, separators=(",", ":"))
cnt = collections.Counter(l["subject"] for l in lanes)
inlane = collections.Counter()
for l in lanes:
    for s in l["steps"]:
        for k in s["k"]:
            inlane[(l["subject"], k)] += 1
K5 = ("K", "1", "2", "3", "4", "5")
for subj, fws in [("ELA", ["WI-CC-ELA"]), ("Math", ["WI-CC-MATH"]), ("Science", ["AERO-SCI", "NGSS"]), ("Social Studies", ["AERO-SS", "WI-SS"])]:
    # the sets the site shows: NGSS and Wisconsin Social Studies only in 6-12
    tot = [e for e in IDX[subj] if e["f"] in fws and (e["f"] not in ("NGSS", "WI-SS") or any(g not in K5 for g in home(e)))]
    print(f"{subj}: {cnt[subj]} lanes; {sum(1 for e in tot if (subj, e['f'] + '|' + e['c']) in inlane)} of {len(tot)} standards in a lane")
print("math not in a topic:", unassigned)
print("size KB", round(os.path.getsize(os.path.join(ROOT, "site/data/progressions.json")) / 1024))
