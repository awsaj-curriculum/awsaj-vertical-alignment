"""Build the Wisconsin Essential Elements as their own standard sets (data/standards/essential_elements.json).

Each Common Core / NGSS / Wisconsin row carries its Essential Element (ee_code, ee_text). Teams can now rate the EEs
on their own, so every unique (EE code, grade) becomes a row in a separate framework:
WI-EE-MATH, WI-EE-ELA, WI-EE-SCI, WI-EE-SS. `crosswalk` lists the standards the EE is linked to, and the EE "I can"
levels (ee_*) become the row's descriptors so the site shows them as that standard's levels.
Usage: python3 scripts/build_ee_rows.py   (then python3 scripts/build_site_data.py)
"""
import collections, json

FW = {"Math": "WI-EE-MATH", "ELA": "WI-EE-ELA", "Science": "WI-EE-SCI", "Social Studies": "WI-EE-SS"}
rows = json.load(open("data/standards/all_standards.json"))
out = {}
for r in rows:
    for code in [c.strip() for c in (r.get("ee_code") or "").split(";") if c.strip()]:
        key = (FW[r["subject"]], code, r["grade"])
        e = out.get(key)
        if e is None:
            d = r.get("descriptors") or {}
            levels = {k.replace("ee_", "cc_"): v for k, v in d.items() if k.startswith("ee_") and v and not str(v).startswith("Not applicable")}
            e = out[key] = {
                "subject": r["subject"], "framework": key[0], "code": code, "grade": r["grade"],
                "grade_band": r.get("grade_band", ""), "grade_is_suggested": r.get("grade_is_suggested", False),
                "division": r["division"], "course": r.get("course", ""), "strand": r.get("strand", ""),
                "cluster": r.get("cluster", ""), "text": r.get("ee_text") or code, "ee_code": "", "ee_text": "",
                "crosswalk": [], "descriptors": levels, "descriptor_source": r.get("descriptor_source", ""),
                "descriptor_flag": "", "descriptors_suggested": None, "power_standard": None,
                "source": "Wisconsin Essential Elements (DPI), linked from " + r["framework"], "text_source": r.get("text_source", ""),
            }
        link = r["framework"] + ":" + r["code"]
        if link not in e["crosswalk"]:
            e["crosswalk"].append(link)
GORDER = ["K"] + [str(g) for g in range(1, 13)]
res = sorted(out.values(), key=lambda e: (e["framework"], GORDER.index(e["grade"]), e["code"]))
json.dump(res, open("data/standards/essential_elements.json", "w"), ensure_ascii=False, indent=0)
print(collections.Counter(e["framework"] for e in res))
