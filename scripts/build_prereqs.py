"""Prerequisite map: for each standard, the standards it builds on, with the kind of link and where it comes from.

Sources (shown on the site with every link):
  cm      Math: the Coherence Map (Student Achievement Partners, achievethecore.org/coherence-map), whose arrows follow
          the Common Core progressions documents. Download https://achievethecore.org/coherence-map/data.js to
          data/source/coherence_map/data.js (git-ignored). Only the standard codes of each arrow are used.
  anchor  ELA: the same Wisconsin anchor standard one grade earlier (official), from site/data/progressions.json.
  anchorp ELA: the same anchor standard, with the part (L.6.1.a ... d) matched by its own wording (not official).
  ai      ELA, Science, Social Studies: prerequisites suggested by an AI curriculum reviewer, each with a type and a
          one-line reason, kept in data/standards/prereqs_ai/*.json. Shown on the site as "suggested, check".
Types: same (the same skill at a lower level), concept (an idea it relies on), procedure (a process it extends),
prereq (a different skill needed first), build (Coherence Map arrow: builds on, type not given).
Output: site/data/prereqs.json  {"to": [["from", type, source, reason, reason by, group?], ...]} (group: the Common
Core code when one arrow reaches several parts of a split standard)   (keys are "framework|code")
Usage: python3 scripts/build_prereqs.py (after build_site_data.py and build_progressions.py)
"""
import collections, glob, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = {}


def add(to, frm, typ, src, why="", grp=""):
    """One entry per pair: [from, type, source, reason, who wrote the reason]. An official source wins; a reason the AI
    reviewer wrote keeps saying so."""
    if to == frm:
        return
    lst = out.setdefault(to, [])
    for x in lst:
        if x[0] == frm:
            if src in ("cm", "anchor", "anchorp") and x[2] == "ai":
                x[2] = src
            return
    lst.append([frm, typ, src, why, "ai" if src == "ai" and why else ""] + ([grp] if grp else []))


# ---------- Math: Coherence Map arrows ----------
math = [e for e in json.load(open(os.path.join(ROOT, "site/data/index_math.json"))) if e["f"] == "WI-CC-MATH"]


def ccss(c):
    m = re.match(r"^M\.([K0-9]+|N|A|F|G|SP)\.([A-Z]{1,4})\.([A-D])\.(\d+)(?:\.([a-z]))?$", c)
    if not m:
        return None
    d, dom, clu, n, sub = m.groups()
    tail = f"{clu}.{n}{sub or ''}"
    return f"{d}.{dom}.{tail}" if re.match(r"^[K0-9]+$", d) else f"HS{'S' if d == 'SP' else d}-{dom}.{tail}"


# Common Core code -> site row; renumbered Wisconsin rows use their crosswalk codes (index field cw, [] = new in Wisconsin).
site = {}                                                    # Common Core code -> site rows (a split standard has several)
for e in math:
    for c in (e["cw"] if "cw" in e else [ccss(e["c"])]):
        if c:
            site.setdefault(c, []).append("WI-CC-MATH|" + e["c"])
cm_path = os.path.join(ROOT, "data/source/coherence_map/data.js")
if os.path.exists(cm_path):
    s = open(cm_path, encoding="utf-8").read()
    d = json.loads(s[s.index("{"):s.rindex("}") + 1])
    D, C, S = d["domains"], d["clusters"], d["standards"]

    def code(sid):
        st = S[sid]; cl = C[st["ccmathcluster_id"]]; dm = D[cl["ccmathdomain_id"]]
        c = (f"HS{dm['ordinal']}" if dm["grade"] == "HS" else f"{dm['grade']}.{dm['ordinal']}") + f".{cl['ordinal']}.{st['ordinal']}"
        return re.sub(r"\.([a-z])$", r"\1", c)               # 1.NBT.B.2.a -> 1.NBT.B.2a, as on the site

    def to_site(c):
        """A Coherence Map code -> the site rows it names: the row itself and its lettered parts (Wisconsin keeps part a
        in the parent row, M.5.NF.B.7 = stem + a), or its parent."""
        parts = [x for k, v in site.items() if re.fullmatch(re.escape(c) + "[a-z]", k) for x in v]
        if c in site or parts:
            return site.get(c, []) + [x for x in parts if x not in site.get(c, [])]
        parent = re.sub(r"[a-z]$", "", c)
        return site[parent] if parent != c and parent in site else []

    unmapped = set()
    for e in d["edges"]:
        a, b = code(e["from"]), code(e["to"])
        fa, fb = to_site(a), to_site(b)
        if not fa: unmapped.add(a)
        if not fb: unmapped.add(b)
        # A standard split into parts on the site is one prerequisite: the parts share a group (the Common Core code),
        # and the site counts it missing only when every part is.
        for x in fa:
            for y in fb:
                add(y, x, "build", "cm", grp=a if len(fa) > 1 else "")
    print(f"Math: {len(d['edges'])} Coherence Map arrows; codes not on the site: {sorted(unmapped)}")
else:
    print("Math: data/source/coherence_map/data.js not found, Math has no prerequisite links")

# ---------- AI-suggested links (ELA, Science, Social Studies) ----------
for path in sorted(glob.glob(os.path.join(ROOT, "data/standards/prereqs_ai/*.json"))):
    data = json.load(open(path))
    for to, links in data.items():
        for frm, typ, why in links:
            add(to, frm, typ, "ai", why)
    print(f"{os.path.basename(path)}: {len(data)} standards")

# ---------- ELA: the same anchor standard in the step before (official) ----------
# When the step before has one standard the link is official. When it has several parts (L.6.1.a ... d), the part is
# matched by its own wording: an identical part stays official ("anchor"); otherwise the closest part is kept as
# "anchorp" (same anchor standard, part matched by wording) and a part with no close match (below 0.12) gets no link.
prog = json.load(open(os.path.join(ROOT, "site/data/progressions.json")))
n = collections.Counter()
for l in prog["lanes"]:
    if l["basis"] != "anchor":
        continue
    size = {k: len(st["k"]) for st in l["steps"] for k in st["k"]}
    letter = lambda k: (re.search(r"\.([a-z])$", k) or [None, ""])[1]
    best = {}
    for a, b, sm, same in l["links"]:
        rank = (same, sm, letter(a) == letter(b))
        if b not in best or rank > best[b][1]:
            best[b] = (a, rank)
    for b, (a, (same, sm, _)) in best.items():
        src = "anchor" if size[a] == 1 or same else "anchorp" if sm >= 0.12 else None
        if src:
            add(b, a, "same", src); n[src] += 1
        else:
            n["no close part"] += 1
print(f"ELA anchor links: {dict(n)}")

json.dump(out, open(os.path.join(ROOT, "site/data/prereqs.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print(f"{len(out)} standards with prerequisites, {sum(len(v) for v in out.values())} links,",
      round(os.path.getsize(os.path.join(ROOT, 'site/data/prereqs.json')) / 1024), "KB")
