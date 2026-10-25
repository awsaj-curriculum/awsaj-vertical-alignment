"""Read standard codes out of plan or curriculum text, in whatever style the author used, and map each one to the
site's official (framework, code) rows.

Plans cite the same standard many ways: Common Core (RL.6.1, 6.NS.1, HSA-REI.C.6, A-REI.B.3, EE.6.NS.2,
EERL.7.3), Wisconsin (R.6.1, M.6.NS.A.1, M.A.REI.C.6, M.EE.6.NS.2), single-grade high school ELA (RL.10.2 for
RL.9-10.2), NGSS (MS-LS1-1, EE.HS-LS2-6), Wisconsin Science (SCI.ESS2.C.h) and Social Studies (SS.Geog1.a.m,
SS.EE.Geog1) in any letter case. find_codes() returns every code it saw with the rows it maps to; a code that looks
like a standard but maps to nothing is returned with an empty list so it can be reported, never guessed.

ELA caution: the site's ELA set is Wisconsin 2020, which renumbered Writing, Language and Speaking & Listening
(CCSS W.6.1 "Write arguments" is Wisconsin W.6.2.a; Wisconsin W.6.1 is a different standard). Only Reading has a
crosswalk (RL/RI -> R). So find_codes(text, ela="ccss") leaves W/L/SL/RF codes unmapped (family "ela_2010"),
while ela="wi" (the default) reads them as Wisconsin codes. ela_version(text) guesses which one a document uses.

Usage: from standards_codes import Codes; C = Codes(); C.find_codes(text) -> [(raw, family, [(fw, code), ...]), ...]
"""
import collections, json, re, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ELA = r"(RL|RI|RF|R|W|SL|L)\.(K|1[0-2]|[1-9]|9-10|11-12)\.(\d+)(?:\.?([a-f]))?"
MATH_K8 = r"(K|[1-8])\.(CC|OA|NBT|NF|MD|G|RP|NS|EE|F|SP)\.(?:([A-D])\.)?(\d+)(?:\.?([a-e]))?"
MATH_HS = r"(N|A|F|G|SP|S)[.-](RN|Q|CN|VM|SSE|APR|CED|REI|IF|BF|LE|TF|CO|SRT|C|GPE|GMD|MG|ID|IC|CP|MD)\.(?:([A-D])\.)?(\d+)(?:\.?([a-e]))?"
FAMILIES = [
    ("ngss", re.compile(r"\b(EE\.)?((?:K|[1-5]|MS|HS|K-2|3-5)-(?:PS|LS|ESS|ETS)\d-\d+)\b", re.I)),
    ("wisci", re.compile(r"\bSCI\.([A-Z]{2,4}\d?)(?:\.([A-Z]))?\.([A-Za-z0-9-]+)\b", re.I)),
    ("ss", re.compile(r"\bSS\.(EE\.)?([A-Za-z]+\d)(?:\.([a-z])(?:\.([A-Za-z0-9-]+))?)?\b", re.I)),
    ("ela", re.compile(r"\b(?:CCSS\.ELA-LITERACY\.)?(EE\.?)?" + ELA + r"\b", re.I)),
    ("math", re.compile(r"\b(?:CCSS\.MATH\.CONTENT\.)?(M\.)?(EE\.)?" + MATH_K8 + r"\b", re.I)),
    ("math_hs", re.compile(r"\b(?:CCSS\.MATH\.CONTENT\.)?(M\.)?(EE\.)?(?:HS)?" + MATH_HS + r"\b", re.I)),
]


class Codes:
    def __init__(self, root=ROOT):
        rows = json.load(open(os.path.join(root, "data/standards/all_standards.json")))
        rows += json.load(open(os.path.join(root, "data/standards/essential_elements.json")))
        self.rows = rows
        self.codes = collections.defaultdict(set)            # framework -> codes
        for r in rows:
            self.codes[r["framework"]].add(r["code"])
        self.ci = {fw: {c.lower(): c for c in cs} for fw, cs in self.codes.items()}   # case-insensitive lookups
        # A parent code (W.11-12.2, SS.Inq4.h) stands for all its lettered parts on the site (W.11-12.2.a, SS.Inq4.a.h).
        self.parts = collections.defaultdict(list)
        for fw, cs in self.codes.items():
            for c in cs:
                m = re.match(r"(.+)\.[a-z]$", c)
                if m: self.parts[(fw, m.group(1).lower())].append(c)
                m = re.match(r"(SS\.[A-Za-z]+\d)\.[a-z]\.(.+)$", c)
                if m: self.parts[(fw, f"{m.group(1)}.{m.group(2)}".lower())].append(c)

        self.xw = collections.defaultdict(set)               # CCSS RL.6.1 / RI.6.1 -> Wisconsin R.6.1
        for r in rows:
            if r["framework"] == "WI-CC-ELA":
                for x in r.get("crosswalk") or []:
                    self.xw[x.split(":")[-1]].add(r["code"])
        self.math = {}                                       # "6.NS.1", "6.NS.A.1", "A.REI.3", "A.REI.B.3" -> M.x
        for c in self.codes["WI-CC-MATH"]:
            m = re.match(r"M\.([K0-9]+|N|A|F|G|SP)\.([A-Z]+)\.([A-D])\.(\d+)(?:\.([a-z]))?$", c)
            if m:
                d, dom, clu, n, sub = m.groups(); sub = sub or ""
                for k in (f"{d}.{dom}.{clu}.{n}{sub}", f"{d}.{dom}.{n}{sub}"):
                    self.math.setdefault(k, c)
        self.math_ee = {}                                    # "6.NS.2", "F.IF.1" -> M.EE.x
        for c in self.codes["WI-EE-MATH"]:
            m = re.match(r"M\.EE\.([K0-9]+|N|A|F|G|SP|S)\.([A-Z]+)\.(\d+)(?:\.([a-z]))?$", c)
            if m:
                d, dom, n, sub = m.groups(); d = "SP" if d == "S" else d
                self.math_ee.setdefault(f"{d}.{dom}.{n}{sub or ''}", c)

    def _lookup(self, fw, code):
        """Exact code (any letter case), else every lettered part of it."""
        c = self.ci[fw].get(code.lower())
        return [(fw, c)] if c else [(fw, x) for x in sorted(self.parts.get((fw, code.lower()), []))]

    def _ela(self, ee, kind, grade, num, sub):
        kind = kind.upper(); grade = grade.upper()
        if grade in ("9", "10"): grade = "9-10"           # single-grade high school codes (RL.10.2)
        if grade in ("11", "12"): grade = "11-12"
        base = f"{kind}.{grade}.{num}"
        cands = [f"{base}.{sub.lower()}", base] if sub else [base]
        if ee:
            fw, prefix = "WI-EE-ELA", "EE."
            out = []
            for b in cands:
                for w in ([b] + sorted(self.xw.get(b, []))):
                    out += self._lookup(fw, prefix + w)
                if out:
                    return out
            return []
        for b in cands:
            if b in self.xw:
                return [("WI-CC-ELA", w) for w in sorted(self.xw[b])]
            found = self._lookup("WI-CC-ELA", b)
            if found:
                return found
        return []

    def _math(self, ee, d, dom, clu, n, sub):
        d = d.upper(); dom = dom.upper(); sub = (sub or "").lower(); d = "SP" if d == "S" else d
        if ee:
            for k in (f"{d}.{dom}.{n}{sub}", f"{d}.{dom}.{n}"):
                if k in self.math_ee:
                    return [("WI-EE-MATH", self.math_ee[k])]
            return []
        keys = ([f"{d}.{dom}.{clu.upper()}.{n}{sub}"] if clu else []) + [f"{d}.{dom}.{n}{sub}", f"{d}.{dom}.{n}"]
        for k in keys:
            if k in self.math:
                return [("WI-CC-MATH", self.math[k])]
        return []

    @staticmethod
    def ela_version(text):
        """'ccss' if the text cites 2010 Reading codes (RL/RI), 'wi' if it cites Wisconsin R codes, else None."""
        old = len(re.findall(r"\b(?:EE\.?)?R[LI]\.(?:K|\d|9-10|11-12)", text))
        new = len(re.findall(r"\b(?:EE\.)?R\.(?:K|\d|9-10|11-12)\.\d", text))
        return None if not (old or new) else ("ccss" if old >= new else "wi")

    def find_codes(self, text, ela="wi"):
        out, spans = [], []
        for fam, pat in FAMILIES:
            for m in pat.finditer(text):
                if any(a <= m.start() < b for a, b in spans):
                    continue                              # already read as another family (e.g. EE.HS-LS2-6)
                g, res = m.groups(), []
                if fam == "ngss":
                    code = g[1].upper()
                    fw = "WI-EE-SCI" if g[0] else "NGSS"
                    c = self.ci[fw].get(("EE." + code if g[0] else code).lower())
                    res = [(fw, c)] if c else []
                elif fam == "wisci":
                    c = self.ci["WI-SCI"].get(m.group(0).lower())
                    res = [("WI-SCI", c)] if c else []
                elif fam == "ss":
                    res = self._lookup("WI-EE-SS" if g[0] else "WI-SS", m.group(0))
                elif fam == "ela":
                    if ela == "ccss" and g[1].upper() in ("W", "L", "SL", "RF"):
                        out.append((m.group(0), "ela_2010", [])); spans.append((m.start(), m.end())); continue
                    res = self._ela(g[0], *g[1:5])
                elif fam in ("math", "math_hs"):
                    ee = bool(g[1]) or bool(re.match(r"(?i)EE\.", m.group(0)))
                    res = self._math(ee, *g[2:7])
                out.append((m.group(0), fam, res)); spans.append((m.start(), m.end()))
        return out
