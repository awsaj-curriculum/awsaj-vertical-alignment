"""Write data/standards/all_standards.json: the four subject files in one list, with the cleanup rules applied.

Run after any subject build (math, ela, science, social_studies), before scripts/build_ee_rows.py.
Usage: python3 scripts/build_all_standards.py
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cleanup_rules  # noqa: E402

rows = []
for s in ["math", "ela", "science", "social_studies"]:
    rows += json.load(open(f"data/standards/{s}.json"))
rows = cleanup_rules.apply_main(rows)
json.dump(rows, open("data/standards/all_standards.json", "w"), ensure_ascii=False)
print("rows", len(rows))
