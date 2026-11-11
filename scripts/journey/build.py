"""Builds site/journey.html (Part 2) from these files. Run from the repo root: python3 scripts/journey/build.py"""
import json
J = "scripts/journey/"
t = open(J + "template.html").read()
content = open(J + "helpers.js").read() + "\n" + open(J + "wt.js").read().replace("/*WT*/", json.dumps(json.load(open(J + "content.json")), ensure_ascii=False).replace("</", "<\\/"))
out = t.replace("/*CONTENT*/", content).replace("/*MOTION*/", open(J + "motion.js").read()).replace("/*LOGO*/", open(J + "logo.svg").read().strip()).replace("/*DATA*/", open(J + "data.json").read().replace("</", "<\\/"))
open("site/journey.html", "w").write(out); print(len(out))
