"""Standards cleanup rules (Tim, Nov 2026). Applied by every build and load step so a rebuild cannot bring them back.

Used by: scripts/build_all_standards.py (subject files -> all_standards.json), scripts/build_ee_rows.py,
scripts/build_site_data.py, scripts/load_supabase.py, and the subject builds (ELA, Math, Science, Social Studies).
The live database was cleaned the same way (supabase/cleanup/2026-11_remove_and_fix.sql, migration 007).

Removed (with their ratings):
  1. Wisconsin Essential Elements for Social Studies in K-5 (6-12 stay).
  2. Wisconsin Essential Elements for Science in Grade 5 (6-12 stay); Grade 5 Science rows lose the link.
  3. Ten AERO Social Studies placements that came only from the school report-card sheet, not from AERO.
  4. ELA Essential Element placeholders "(Begins in grade 3)" (K-2 W.4).
  5. Essential Element placeholders with no content ("Not applicable", "N/A", "Not applicable. See ...").
  Every link to an Essential Element that holds no real standard is cleared on the rows that stay.
Fixed:
  6a. Two AERO Social Studies texts.  6b. Grade 2 ELA texts that began "I can ".
  6c. Fourteen ELA texts (and ten linked texts) that lost their first letter in the school-sheet parser.
  6d. M.2.NBT.A.1 full text.  6e. Five Essential Element codes.
"""
import re

K5 = ("K", "1", "2", "3", "4", "5")
PLACEHOLDER = re.compile(r"^\W*(n/?a|not applicable)\b", re.I)


def is_placeholder(t):
    """True when a text holds no real standard: blank, "Not applicable", "N/A", "(Begins in grade 3)"."""
    t = (t or "").strip()
    return t == "" or bool(PLACEHOLDER.match(t)) or "(begins in grade 3)" in t.lower()


# 3. AERO Social Studies placements from the school report-card sheet only (AERO places these elsewhere).
AERO_SS_EXTRA = {("1", "3.2.b"), ("1", "5.2.b"), ("1", "6.2.b"), ("2", "4.2.c"), ("5", "1.5.c"), ("5", "3.5.c"),
                 ("5", "4.5.c"), ("5", "6.5.c"), ("5", "7.5.c"), ("5", "8.5.c")}

# 6a. AERO Social Studies wording (also in social_studies/build_ss_master.py AERO_TEXT_FIX).
TEXT_FIX = {
    ("AERO-SS", "4", "3.5.d"): ("Describe ways physical and human-made features have changed over time.",
                                "Describe ways that the earth’s physical and human-made features have changed over time."),
    ("AERO-SS", "K", "4.2.a"): ("Identify regional folk heroes, stories, or songs that have contributed to the development of a history.",
                                "Identify regional folk heroes, stories, or songs that have contributed to the development of a region’s cultural history."),
}
# 6d. M.2.NBT.A.1: the school sheet held only part b. Full text from the school's Curriculum Hub Grade 2 list
# (data/source/hub/G2.csv), the same wording as Common Core 2.NBT.A.1.
NBT_2_A_1 = ('Understand that the three digits of a three-digit number represent amounts of hundreds, tens, and ones; '
             'e.g., 706 equals 7 hundreds, 0 tens, and 6 ones. Understand the following as special cases: a. 100 can be '
             'thought of as a bundle of ten tens — called a "hundred." b. The numbers 100, 200, 300, 400, 500, 600, 700, '
             '800, 900 refer to one, two, three, four, five, six, seven, eight, or nine hundreds (and 0 tens and 0 ones).')

# 6c. First letter lost (the parser read "W.3.4. with ..." as part ".w"); fixed in ela/parse_school_sheets.py, kept
# here for the saved parser output.
LOST_LETTER = {"ith ": "W", "se ": "U", "hen ": "W", "ecognize ": "R"}
LOST_TEXT = {("WI-CC-ELA", "3", c) for c in ("R.3.9", "W.3.4", "W.3.5", "W.3.6")}
LOST_EE_TEXT = {("WI-CC-ELA", g, c) for g, c in [("2", "R.2.1"), ("2", "L.2.4"), ("3", "RF.3.3.a"), ("3", "R.3.5"),
                ("3", "W.3.1"), ("3", "W.3.4"), ("3", "W.3.5"), ("3", "W.3.6"), ("3", "W.3.9"), ("3", "L.3.4.a")]}

# 6e. Essential Element codes.
EE_RENAME = {"EE..W.3.7": "EE.W.3.7", "EE.4.OA.5": "M.EE.4.OA.5", "M.EE5.MD.5.a": "M.EE.5.MD.5.a",
             "M.EE.1.NBT.1a": "M.EE.1.NBT.1.a", "M.EE.1.NBT.1b": "M.EE.1.NBT.1.b"}
EE_TEXT = {
    ("WI-EE-MATH", "M.EE.1.NBT.1.a"): "Know the count sequence and understand numbers and quantities. a. Count by ones to 30.",
    ("WI-EE-MATH", "M.EE.1.NBT.1.b"): "Know the count sequence and understand numbers and quantities. b. Count up to 10 objects "
                                      "and represent the quantity with the corresponding numeral.",
}


def restore_letter(t):
    for stem, letter in LOST_LETTER.items():
        if t.startswith(stem):
            return letter + t
    return t


def fix_ee_text(t):
    # "EE..W.3.7 . with guidance ..." -> "With guidance ..."
    m = re.match(r"^EE\.+[A-Z]{1,2}\.\d+\.\d+\s*\.\s*(\w)", t or "")
    return (m.group(1).upper() + t[m.end():]) if m else t


def drop_ee_link(r):
    r["ee_code"], r["ee_text"] = "", ""
    for k in ("descriptors", "descriptors_suggested"):
        d = r.get(k)
        if isinstance(d, dict) and "ee_at_target" in d and (k == "descriptors" or is_placeholder(d["ee_at_target"])):
            d.pop("ee_at_target")


def ee_removed(subject, grade):
    """1, 2: Essential Elements not used in K-5 Social Studies or K-5 Science."""
    return grade in K5 and subject in ("Social Studies", "Science")


def apply_main(rows):
    """Clean the main standard sets (CCSS, NGSS, AERO, Wisconsin). Returns a new list."""
    out = []
    for r in rows:
        fw, g, c = r["framework"], r["grade"], r["code"]
        if fw == "AERO-SS" and (g, c) in AERO_SS_EXTRA:
            continue
        r = dict(r)
        old_new = TEXT_FIX.get((fw, g, c))
        if old_new and r["text"] == old_new[0]:
            r["text"] = old_new[1]
        if fw == "WI-CC-ELA" and r["text"].startswith("I can "):
            r["text"] = r["text"][6].upper() + r["text"][7:]
        if (fw, g, c) in LOST_TEXT:
            r["text"] = restore_letter(r["text"])
        if (fw, g, c) in LOST_EE_TEXT:
            r["ee_text"] = restore_letter(r.get("ee_text") or "")
        if fw == "WI-CC-MATH" and g == "2" and c == "M.2.NBT.A.1" and r["text"].startswith("b The numbers"):
            r["text"] = NBT_2_A_1
        if r.get("ee_code"):
            r["ee_code"] = "; ".join(EE_RENAME.get(x.strip(), x.strip()) for x in r["ee_code"].split(";") if x.strip())
            r["ee_text"] = fix_ee_text(r.get("ee_text") or "")
        if r.get("ee_code") or r.get("ee_text"):
            # 2: Science K-5 does not use Essential Elements (Social Studies K-5 Wisconsin rows keep theirs: hidden in K-5,
            # and build_ee_rows does not make K-5 Social Studies EE rows).
            if (r["subject"] == "Science" and g in K5 and fw != "WI-SCI") or is_placeholder(r.get("ee_text")):
                drop_ee_link(r)
        out.append(r)
    return out


def apply_ee(rows):
    """Clean the Essential Element rows (WI-EE-*). Returns a new list."""
    out = []
    for r in rows:
        if ee_removed(r["subject"], r["grade"]) or is_placeholder(r.get("text")) or (r.get("text") or "") == r["code"]:
            continue
        r = dict(r)
        r["code"] = EE_RENAME.get(r["code"], r["code"])
        r["text"] = EE_TEXT.get((r["framework"], r["code"]), fix_ee_text(restore_letter(r["text"])))
        out.append(r)
    return out


def apply(rows):
    """Both kinds in one list."""
    ee = [r for r in rows if r["framework"].startswith("WI-EE-")]
    return apply_main([r for r in rows if not r["framework"].startswith("WI-EE-")]) + apply_ee(ee)
