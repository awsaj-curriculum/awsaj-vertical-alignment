"""Where the site's data comes from: site/data/sources.json, shown on the site's "Data sources" panel.

Lists, with counts, the documents behind every part of the site:
  standards      each standard set and the document its rows were read from (data/standards/*.json)
  documents      every curriculum document read for the "In curriculum docs" and "Priority / Power" marks
                 (data/standards/plan_marks.json sources; course names only, never file titles, so no teacher names)
  hub            the Curriculum Hub grade standards lists (power standards, K-5): codes listed and found on the site
  prereqs        the prerequisite links by source (site/data/prereqs.json)
Usage: python3 scripts/build_sources.py (after plan_marks, build_site_data and build_prereqs)
"""
import collections, datetime, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p: json.load(open(os.path.join(ROOT, p)))

# ---------- standards ----------
rows = J("data/standards/all_standards.json")
ee = J("data/standards/essential_elements.json")
ee = ee if isinstance(ee, list) else ee.get("rows", [])
std = collections.Counter()
for r in rows + [x for x in ee if isinstance(x, dict)]:
    src = re.sub(r"; printed in source as .*$", "", r.get("source") or "Not recorded")
    std[(r["framework"], src)] += 1
standards = [{"framework": f, "source": s, "rows": n} for (f, s), n in sorted(std.items())]

# ---------- curriculum documents ----------
pm = J("data/standards/plan_marks.json")
docs = []
for d in pm["sources"]["secondary"]:
    docs.append({"level": "6-12", "grade": d["grade"], "subject": d["subject"], "course": d.get("course", ""),
                 "doc": d["doc"], "codes": d["codes"], "priority": d.get("priority_codes", 0), "source": "Ma3loomat"})
hub = collections.defaultdict(lambda: {"listed": 0, "found": 0, "not_found": []})
for d in pm["sources"]["elementary"]:
    if d["doc"] == "Curriculum Hub grade standards":
        h = hub[(d["grade"], d["subject"])]; h["listed"] += 1
        if d["matched"]:
            h["found"] += 1
        else:
            h["not_found"].append(d["code"])
        continue
    name = d["doc"]
    kind = "power" if "Power" in name else "weekly plan" if "_week_" in name else "grade document"
    nice = re.sub(r"^KG_week_0?(\d+)$", r"Kindergarten weekly plan, week \1", name)
    nice = re.sub(r"^G(\d)_", r"Grade \1 ", nice).replace("_", " ")
    docs.append({"level": "K-5", "grade": d["grade"], "subject": d.get("subject", "Several"), "course": "",
                 "doc": nice, "codes": d["codes"], "priority": d["codes"] if kind == "power" else 0,
                 "source": "Curriculum Hub" if kind != "power" else "K-5 ELA Power Standards PDF", "kind": kind})
hubs = [{"grade": g, "subject": s, **v} for (g, s), v in sorted(hub.items())]

# Distinct standard-grade pairs behind the marks (a standard cited by several documents counts once per grade).
SEC = {"6", "7", "8", "9", "10", "11", "12"}
distinct = {}
for lvl, inl in (("6-12", lambda g: g in SEC), ("K-5", lambda g: g not in SEC)):
    pn = {(k, g) for k, m in pm["marks"].items() if not k.startswith("WI-EE-") for g in m.get("plans", []) if inl(g)}
    pr = {(k, g) for k, m in pm["marks"].items() if not k.startswith("WI-EE-") for g in m.get("priority", []) if inl(g)}
    distinct[lvl] = {"pairs": len(pn), "standards": len({k for k, _ in pn}), "priority_pairs": len(pr)}

# ---------- prerequisite links ----------
pre = J("site/data/prereqs.json")
links = collections.Counter(x[2] for v in pre.values() for x in v)

out = {"built": datetime.date.today().isoformat(), "standards": standards, "documents": docs, "hub": hubs,
       "prereqs": dict(links), "distinct": distinct}
json.dump(out, open(os.path.join(ROOT, "site/data/sources.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print(len(standards), "standard sources;", len(docs), "documents;", len(hubs), "Hub lists;", dict(links))
