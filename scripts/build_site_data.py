"""Write compact per-subject standards files for the static site (site/data/*.json).

index_<subject>.json: one entry per unique (framework, code) with the grades it is placed in.
detail_<subject>.json: full text, EE and descriptors keyed by "framework|code|grade".
Index fields from the school's documents (data/standards/plan_marks.json, built by scripts/audit/plan_marks.py):
  pn = grades whose plans cite the standard; pr = grades that name it a priority (6-12) or power (K-5) standard;
  pa = grades added to the placement because their plans cite it (high school Math and middle school Science rate the
  standards their documents cite plus their current placement).
ELA cw = the Common Core 2010 code(s) of each Wisconsin 2020 row, from DPI's official comparison
(data/standards/ela_crosswalk_2010_2020.json, built by scripts/ela_crosswalk.py). Math cw = the Common Core code(s) of
the few Wisconsin 2021 rows that were renumbered, or [] when new in Wisconsin (data/standards/math_ccss_crosswalk.json).
Usage: python3 scripts/build_site_data.py
"""
import json, collections, os
rows = json.load(open("data/standards/all_standards.json"))
XW = json.load(open("data/standards/ela_crosswalk_2010_2020.json"))["to2010"]
# Math rows Wisconsin 2021 renumbered or added: their Common Core code(s), or [] when new in Wisconsin.
_mx = json.load(open("data/standards/math_ccss_crosswalk.json"))
MXW = {**_mx["wi_to_ccss"], **_mx.get("wi_parts_to_ccss_parent", {})}
MARKS = json.load(open("data/standards/plan_marks.json"))["marks"] if os.path.exists("data/standards/plan_marks.json") else {}
# Placement from plans: which sets and grades take the standards their documents cite (same school division only).
FROM_PLANS = {"WI-CC-MATH": ["9", "10", "11", "12"], "WI-EE-MATH": ["9", "10", "11", "12"], "NGSS": ["6", "7", "8"], "WI-EE-SCI": ["6", "7", "8"]}
# Essential Elements as their own standard sets (built by scripts/build_ee_rows.py)
rows += json.load(open("data/standards/essential_elements.json"))
GORDER = ["K"] + [str(g) for g in range(1, 13)]
slug = {"Math": "math", "ELA": "ela", "Science": "science", "Social Studies": "social_studies"}
by_sub = collections.defaultdict(list)
for r in rows:
    by_sub[r["subject"]].append(r)
meta = {"subjects": [], "grades": GORDER, "built": __import__("datetime").date.today().isoformat()}
for sub, rs in by_sub.items():
    idx = {}
    detail = {}
    for r in rs:
        k = r["framework"] + "|" + r["code"]
        e = idx.setdefault(k, {"f": r["framework"], "c": r["code"], "s": r["strand"], "cl": r["cluster"],
                               "t": r["text"][:220], "ee": r["ee_code"], "pl": [], "sg": False, "band": r["grade_band"],
                               "div": [], "crs": []})
        if r["framework"] == "WI-CC-MATH" and r["code"] in MXW:
            e["cw"] = MXW[r["code"]]
        if r["framework"] == "WI-CC-ELA" and (XW.get(r["code"]) or r["crosswalk"]):
            e["cw"] = XW.get(r["code"]) or r["crosswalk"]   # Common Core 2010 code(s) behind a Wisconsin 2020 code
        if r["framework"] in ("AERO-SS", "NGSS", "AERO-SCI") and r["crosswalk"]:
            # Wisconsin matches shown in italics under the code (Social Studies: suggested matches; Science: WI-SCI)
            wi = [x.split(":", 1)[1] for x in r["crosswalk"] if x.startswith("WI-")] if r["subject"] == "Science" else r["crosswalk"]
            if wi:
                e["wi"] = wi
        if r["framework"].startswith("WI-EE-"):
            e.setdefault("lk", [])
            for x in r["crosswalk"]:
                if x not in e["lk"]:
                    e["lk"].append(x)
        if r["grade"] not in e["pl"]:
            e["pl"].append(r["grade"])
        e["sg"] = e["sg"] or r["grade_is_suggested"]
        if r["division"] not in e["div"]:
            e["div"].append(r["division"])
        if r["course"] and r["course"] not in e["crs"]:
            e["crs"].append(r["course"])
        detail[k + "|" + r["grade"]] = {k2: r[k2] for k2 in ("text", "ee_code", "ee_text", "descriptors", "descriptor_source",
                                                           "descriptor_flag", "descriptors_suggested", "crosswalk", "source",
                                                           "grade_band", "grade_is_suggested", "course", "cluster")}
    for e in idx.values():
        m = MARKS.get(e["f"] + "|" + e["c"], {})
        if m.get("plans"):
            e["pn"] = m["plans"]
        if m.get("priority"):
            e["pr"] = m["priority"]
        add = [g for g in m.get("plans", []) if g in FROM_PLANS.get(e["f"], []) and g not in e["pl"] and any(p in FROM_PLANS[e["f"]] for p in e["pl"])]
        if add:
            for g in add:                     # the popup reads the detail of a standard's first grade
                detail[f"{e['f']}|{e['c']}|{g}"] = detail[f"{e['f']}|{e['c']}|{e['pl'][0]}"]
            e["pa"] = add; e["pl"] += add; e["sg"] = True
        e["pl"].sort(key=GORDER.index)
    items = sorted(idx.values(), key=lambda e: (e["f"], GORDER.index(e["pl"][0]), e["s"], e["c"]))
    json.dump(items, open(f"site/data/index_{slug[sub]}.json", "w"), ensure_ascii=False, separators=(",", ":"))
    json.dump(detail, open(f"site/data/detail_{slug[sub]}.json", "w"), ensure_ascii=False, separators=(",", ":"))
    meta["subjects"].append({"name": sub, "slug": slug[sub], "frameworks": sorted({e["f"] for e in items}), "count": len(items)})
meta["subjects"].sort(key=lambda s: ["Math", "ELA", "Science", "Social Studies"].index(s["name"]))
meta["teams"] = json.load(open("data/teams.json"))
json.dump(meta, open("site/data/meta.json", "w"), indent=1, ensure_ascii=False)
print(json.dumps(meta["subjects"], indent=0))
