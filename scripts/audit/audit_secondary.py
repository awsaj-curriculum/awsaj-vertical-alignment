"""Audit: do the standards the website asks Grades 6-12 to rate match the standards their curriculum documents use?

Source: the Ma3loomat "Secondary Curriculum" page (storyboards, curriculum maps, scope & sequence, pacing guides for
every Grade 6-12 course), downloaded as text into data/source/ma3loomat/ (git-ignored, never committed).
Inputs : data/source/ma3loomat/catalog.json  [{grade, subject, course, label, id, text_file|null, note}]
Output : outputs/secondary_audit.json and outputs/secondary_audit.md (git-ignored)

For each course it reports: which code styles the documents use, the cited standards that are on the site for that
grade, cited standards the site places in another grade, codes that are not on the site at all, and the site's
standards for that grade that no document cites. Read only: nothing is written to Drive or the database.
Usage: python3 scripts/audit/audit_secondary.py
"""
import collections, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from standards_codes import Codes  # noqa: E402

C = Codes(ROOT)
CAT = json.load(open(os.path.join(ROOT, "data/source/ma3loomat/catalog.json")))
SITE_SETS = {"ELA": ["WI-CC-ELA", "WI-EE-ELA"], "Math": ["WI-CC-MATH", "WI-EE-MATH"],
             "Science": ["NGSS", "WI-EE-SCI"], "Social Studies": ["WI-SS", "WI-EE-SS"]}
SLUG = {"ELA": "ela", "Math": "math", "Science": "science", "Social Studies": "social_studies"}
IDX = {s: json.load(open(os.path.join(ROOT, f"site/data/index_{v}.json"))) for s, v in SLUG.items()}
PLACED = {s: {(e["f"], e["c"]): e["pl"] for e in rows} for s, rows in IDX.items()}   # where the site suggests each


def checklist(subject, g):
    return {(e["f"], e["c"]) for e in IDX[subject] if e["f"] in SITE_SETS[subject] and g in e["pl"]}


courses = collections.OrderedDict()
for d in CAT:
    courses.setdefault((d["grade"], d["subject"], d["course"]), []).append(d)

report = []
for (g, subject, course), docs in courses.items():
    cited, raw_unmapped, ela_2010, styles, versions = collections.Counter(), collections.Counter(), collections.Counter(), collections.Counter(), collections.Counter()
    read, missing = [], []
    for d in docs:
        if not d.get("text_file"):
            missing.append(f"{d['label']} ({d.get('note') or 'could not be opened'})"); continue
        text = open(os.path.join(ROOT, d["text_file"]), encoding="utf-8", errors="ignore").read()
        read.append(d["label"])
        v = C.ela_version(text) if subject == "ELA" else None
        if v: versions[v] += 1
        for raw, fam, res in C.find_codes(text, ela=v or "wi"):
            styles[fam] += 1
            if fam == "ela_2010":
                ela_2010[raw.upper()] += 1
            elif not res:
                raw_unmapped[raw] += 1
            for k in res:
                cited[k] += 1
    want = checklist(subject, g)
    on_site = {k for k in cited if k in want}
    other_grade = {k: PLACED[subject].get(k) for k in cited if k not in want and k[0] in SITE_SETS[subject] + ["WI-SCI"]}
    not_cited = sorted(want - set(cited), key=lambda k: (k[0], k[1]))
    report.append({
        "grade": g, "subject": subject, "course": course, "docs_read": read, "docs_missing": missing,
        "ela_version": dict(versions), "code_styles": dict(styles),
        "site_checklist": len(want), "site_checklist_cited": len(on_site),
        "cited_on_site": sorted(f"{f}|{c}" for f, c in on_site),
        "cited_other_grade": sorted(f"{f}|{c}|placed {','.join(pl or ['not shown'])}" for (f, c), pl in other_grade.items()),
        "not_on_site": sorted(raw_unmapped, key=lambda x: (-raw_unmapped[x], x)),
        "ela_2010_unmapped": sorted(ela_2010, key=lambda x: (-ela_2010[x], x)),
        "site_not_cited": [f"{f}|{c}" for f, c in not_cited],
    })

os.makedirs(os.path.join(ROOT, "outputs"), exist_ok=True)
json.dump(report, open(os.path.join(ROOT, "outputs/secondary_audit.json"), "w"), indent=1)
L = ["# Secondary curriculum vs website audit", ""]
for r in report:
    L += [f"## Grade {r['grade']} {r['course']} ({r['subject']})",
          f"- Documents read: {', '.join(r['docs_read']) or 'none'}" + (f"; missing: {'; '.join(r['docs_missing'])}" if r['docs_missing'] else ""),
          f"- Code styles: {r['code_styles']}" + (f"; ELA version: {r['ela_version']}" if r['ela_version'] else ""),
          f"- Site asks Grade {r['grade']} to rate {r['site_checklist']} standards; documents cite {r['site_checklist_cited']} of them",
          f"- Cited but placed in another grade on the site ({len(r['cited_other_grade'])}): {', '.join(r['cited_other_grade'][:40])}",
          f"- Cited codes not on the site ({len(r['not_on_site'])}): {', '.join(r['not_on_site'][:40])}",
          f"- 2010 ELA Writing/Language/SL codes, no crosswalk yet ({len(r['ela_2010_unmapped'])}): {', '.join(r['ela_2010_unmapped'][:40])}",
          f"- On the site for this grade but not in any document ({len(r['site_not_cited'])}): {', '.join(x.split('|')[1] for x in r['site_not_cited'][:60])}", ""]
open(os.path.join(ROOT, "outputs/secondary_audit.md"), "w").write("\n".join(L))
print("\n".join(L))
