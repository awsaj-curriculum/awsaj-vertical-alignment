"""Recheck the progressions (site/data/progressions.json) and the prerequisite map (site/data/prereqs.json) against
the standards the school actually uses: Math and ELA = Wisconsin (CCSS) in every grade; Science = AERO K-5, NGSS 6-12;
Social Studies = AERO K-5, Wisconsin 6-12. Essential Elements follow their linked standard and are not in lanes.
Reports: any step or link that uses another set, every in-use standard missing from a lane, steps with no link into
them, and lanes that cover only K-5 or only 6-12 (expected for some, e.g. ELA Foundational Skills, Math counting).
Usage: python3 scripts/check_progressions.py (after build_progressions.py and build_prereqs.py)
"""
import collections, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "site/data")
idx = {}
for s in ["math", "ela", "science", "social_studies"]:
    for r in json.load(open(os.path.join(D, f"index_{s}.json"))):
        idx[r["f"] + "|" + r["c"]] = r
K5 = ["K", "1", "2", "3", "4", "5"]
USED = {"Math": lambda f, g: f == "WI-CC-MATH", "ELA": lambda f, g: f == "WI-CC-ELA",
        "Science": lambda f, g: (f == "AERO-SCI" and g in K5) or (f == "NGSS" and g not in K5),
        "Social Studies": lambda f, g: (f == "AERO-SS" and g in K5) or (f == "WI-SS" and g not in K5)}
SUBJ = {"WI-CC-MATH": "Math", "WI-CC-ELA": "ELA", "AERO-SCI": "Science", "NGSS": "Science", "AERO-SS": "Social Studies", "WI-SS": "Social Studies"}
P = json.load(open(os.path.join(D, "progressions.json")))
problems, inlane, span, partial = [], set(), collections.Counter(), collections.defaultdict(list)
for l in P["lanes"]:
    S, gs = l["subject"], set()
    for i, st in enumerate(l["steps"]):
        for k in st["k"]:
            r = idx.get(k)
            if not r:
                problems.append(f"{l['id']}: {k} is not on the site"); continue
            inlane.add(k)
            for g in st["g"]:
                gs.add(g)
                if not USED[S](r["f"], g):
                    problems.append(f"{l['id']}: {k} in Grade {g} is not a set the school uses there")
        if i and not any(b in st["k"] for _, b, _, _ in l["links"]):
            problems.append(f"{l['id']}: step {st['g']} has no link from the step before")
    for a, b, _, _ in l["links"]:
        if a not in idx or b not in idx:
            problems.append(f"{l['id']}: link {a} -> {b} uses a standard not on the site")
    kind = "K-12" if any(g in K5 for g in gs) and any(g not in K5 for g in gs) else "K-5 only" if any(g in K5 for g in gs) else "6-12 only"
    span[(S, kind)] += 1
    if kind != "K-12":
        partial[(S, kind)].append(l["name"][:60])
for k, r in idx.items():
    if r["f"] in SUBJ and any(USED[SUBJ[r["f"]]](r["f"], g) for g in r["pl"]) and k not in inlane:
        problems.append(f"{k} is used by the school but in no progression")
pre = json.load(open(os.path.join(D, "prereqs.json")))
nlinks = 0
for to, arr in pre.items():
    for x in [to] + [a[0] for a in arr]:
        r = idx.get(x)
        if not r or r["f"] not in SUBJ or not any(USED[SUBJ[r["f"]]](r["f"], g) for g in r["pl"]):
            problems.append(f"prerequisite map: {x} is not a standard the school uses")
    nlinks += len(arr)
print(f"{len(P['lanes'])} progressions, {len(inlane)} standards in them; {nlinks} prerequisite links checked")
for k, v in sorted(span.items()):
    print(f"  {k[0]}: {v} {k[1]}")
for k, v in sorted(partial.items()):
    print(f"  {k[0]} {k[1]}: " + "; ".join(v))
print("PROBLEMS:", len(problems))
for p in problems[:50]:
    print("  " + p)
sys.exit(1 if problems else 0)
