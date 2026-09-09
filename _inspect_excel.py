import pandas as pd
from collections import Counter
from collections import OrderedDict
import sqlite3, os

STOCK = r"database/imports/ODI/STOCK ODI 27 Aug 26.xlsx"
ZONE = r"database/imports/ODI/ZONE ODI.xlsx"

print("=" * 70)
print("PART 1: STOCK Excel POS (Level 6) code structure")
print("=" * 70)
d = pd.read_excel(STOCK)
d.columns = [str(c).strip() for c in d.columns]
l6 = d[d["Level"] == 6]
l5 = d[d["Level"] == 5]
pc = [str(x).strip() for x in l6["Unnamed: 2"].tolist()]
parents = [str(x).strip() for x in l6["Unnamed: 3"].tolist()]

print(f"Level 6 rows: {len(l6)}")
print(f"unique pos codes: {len(set(pc))}")
print(f"unique parent DSM: {len(set(parents))}")
print("sample pos codes:", list(OrderedDict.fromkeys(pc))[:15])
print("sample parent DSM:", [p for p in list(OrderedDict.fromkeys(parents))[:15] if p and p != 'nan'])

# show a duplicated-code example with its different parents
cnt = Counter(pc)
dups = {k: v for k, v in cnt.items() if v > 1 and k and k != 'nan'}
if dups:
    ex = next(iter(dups))
    print(f"\nDuplicated code example: {ex!r} x{dups[ex]}")
    print(l6[l6["Unnamed: 2"].astype(str).str.strip() == ex][
        ["Organization Name", "Unnamed: 2", "Unnamed: 3", "Unnamed: 4", "Current Balance"]
    ].to_string())

# DSM parent set from level5
dsm_codes = set(str(x).strip() for x in l5["Unnamed: 2"].tolist())
orphan = [p for p in parents if p and p != "nan" and p not in dsm_codes]
print(f"\nOrphan POS (parent DSM not in Level 5): {len(orphan)}")
print("  orphan parent codes:", Counter(orphan))

print("\n" + "=" * 70)
print("PART 2: ZONE Excel BTS structure")
print("=" * 70)
dz = pd.read_excel(ZONE)
dz.columns = [str(c).strip() for c in dz.columns]
print(f"ZONE rows: {len(dz)}")
bts_codes = dz["BTS CODE NAME"].dropna().astype(str).str.strip()
print(f"unique non-null BTS CODE NAME: {bts_codes.nunique()}")
print(f"BTS codes: {bts_codes.tolist()}")
recap = dz["BTS CODE NAME"].astype(str).str.contains("RECAP|COVERAGE|No\\.\\s*OF|BTS CODE", case=False, na=False)
print(f"rows looking like headers/recap: {recap.sum()}")
print(dz[recap][["SN", "PARTNERS", "BTS CODE NAME"]].to_string())

print("\n" + "=" * 70)
print("PART 3: Current DB state for ODI (PART-AUDI)")
print("=" * 70)
DB = "postrack.db"
print(f"DB exists: {os.path.exists(DB)} ({os.path.getsize(DB)} bytes)")
con = sqlite3.connect(DB)
con.row_factory = sqlite3.Row
cur = con.cursor()

def cnt(tbl, extra=""):
    try:
        cur.execute(f"SELECT COUNT(*) FROM {tbl} {extra}")
        return cur.fetchone()[0]
    except Exception as e:
        return f"ERR {e}"

p = cur.execute("SELECT * FROM partners WHERE code='PART-AUDI'").fetchone()
print("Partner PART-AUDI:", dict(p) if p else "NOT FOUND")
pid = p["id"] if p else None

if pid:
    print(f"\nPer-partner counts (partner_id={pid}):")
    print("  DSM  :", cnt("dsm", f"WHERE partner_id={pid}"))
    print("  POS  :", cnt("pos", f"WHERE partner_id={pid}"))
    print("  BTS  :", cnt("bts", f"WHERE partner_id={pid}"))
    print("\nDSM sample:")
    for r in cur.execute(
        "SELECT id, matricule, org_id, color_code, full_name FROM dsm WHERE partner_id=? ORDER BY id LIMIT 12",
        (pid,)):
        print("   ", dict(r))
    print("\nPOS sample (first 8 + duplicates check):")
    pos_rows = cur.execute(
        "SELECT id, code_pos, org_id, color_code, dsm_id, sim_balance FROM pos WHERE partner_id=? ORDER BY id LIMIT 8",
        (pid,)).fetchall()
    for r in pos_rows:
        print("   ", dict(r))
    # check if 'DSM4' placeholder exists
    d4 = cur.execute("SELECT id, matricule, org_id FROM dsm WHERE partner_id=? AND matricule='DSM4'", (pid,)).fetchone()
    print("\nDSM 'DSM4' placeholder present:", dict(d4) if d4 else "NO (would be created only on re-run with fixed code)")

con.close()
print("\nDONE")

