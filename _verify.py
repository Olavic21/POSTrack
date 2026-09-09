import pandas as pd
from collections import Counter

d = pd.read_excel('database/imports/ODI/STOCK ODI 27 Aug 26.xlsx')
d.columns = [str(c).strip() for c in d.columns]

l5 = d[d['Level'] == 5]
l6 = d[d['Level'] == 6]

# DSM code -> its Organization Name (col1)
dsm_org = {}
for _, r in l5.iterrows():
    code = str(r['Unnamed: 2']).strip()
    ogid = r['Organization Name']
    dsm_org[code] = ogid

# For each Level-6 row, compare its Organization Name to its parent DSM's Organization Name
l6 = l6.copy()
l6['pos_org'] = l6['Organization Name']
l6['parent_dsm_code'] = l6['Unnamed: 3'].astype(str).str.strip()
l6['parent_dsm_org'] = l6['parent_dsm_code'].map(dsm_org)

match = (l6['pos_org'].astype(str).str.strip() == l6['parent_dsm_org'].astype(str).str.strip())
# only consider rows whose parent DSM is known
known = l6['parent_dsm_org'].notna()
print("Level6 rows whose parent DSM is in Level5:", int(known.sum()))
print("  of those, Organization Name == parent DSM org_id:", int(match[known].sum()))
print("  of those, Organization Name != parent DSM org_id:", int((~match[known]).sum()))

# orphan example: POS35
ex = l6[l6['Unnamed: 2'].astype(str).str.strip() == 'POS35'].head(10)
print("\nPOS35 sample:")
print(ex[['Organization Name','Unnamed: 2','Unnamed: 3','Unnamed: 4','Current Balance','parent_dsm_org']].to_string())

# unique org_id count if we group by code
g = l6.groupby(l6['Unnamed: 2'].astype(str).str.strip())
print("\nFor duplicated codes, distinct org_ids per code (avg):", g['Organization Name'].nunique().mean())
print("Total unique (code) x (parent) combos:", l6.groupby(['Unnamed: 2','Unnamed: 3']).ngroups)

con = __import__('sqlite3').connect('postrack.db'); con.row_factory = sqlite3.Row; cur = con.cursor()
pid = cur.execute("SELECT id FROM partners WHERE code='PART-AUDI'").fetchone()[0]
print("\nDB POS color_code non-null:", cur.execute("SELECT COUNT(*) FROM pos WHERE partner_id=? AND color_code IS NOT NULL AND color_code<>''", (pid,)).fetchone()[0], "of", cur.execute("SELECT COUNT(*) FROM pos WHERE partner_id=?", (pid,)).fetchone()[0])
print("DB POS code_pos distinct prefixes:", cur.execute("SELECT DISTINCT substr(code_pos,1,8) FROM pos WHERE partner_id=? LIMIT 5", (pid,)).fetchall())
print("DB DSM color_code non-null:", cur.execute("SELECT COUNT(*) FROM dsm WHERE partner_id=? AND color_code IS NOT NULL AND color_code<>''", (pid,)).fetchone()[0])
# how many POS in DB per DSM (to see if random)
print("DSM id -> POS count (top 5):", cur.execute("SELECT dsm_id, COUNT(*) c FROM pos WHERE partner_id=? GROUP BY dsm_id ORDER BY c DESC LIMIT 5", (pid,)).fetchall())
print("DSM id -> POS count distribution (min,max):", cur.execute("SELECT MIN(c), MAX(c) FROM (SELECT dsm_id, COUNT(*) c FROM pos WHERE partner_id=? GROUP BY dsm_id)", (pid,)).fetchone())
print("expected DSM org range; are POS dsm_id uniformly spread? (random would be ~uniform)")

