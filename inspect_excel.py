import pandas as pd
from collections import Counter

stock_path = r"C:\Users\HP\Desktop\POSTrack\database\imports\ODI\STOCK ODI 27 Aug 26.xlsx"
zone_path = r"C:\Users\HP\Desktop\POSTrack\database\imports\ODI\ZONE ODI.xlsx"

print("=== STOCK FILE ===")
dfs = pd.read_excel(stock_path, sheet_name=None)
for sh, df in dfs.items():
    df.columns = [str(c).strip() for c in df.columns]
    print(f"\nSheet '{sh}': shape={df.shape}")
    print("Columns:", list(df.columns)[:12])

# Use first sheet for analysis
df = pd.read_excel(stock_path)
df.columns = [str(c).strip() for c in df.columns]
print("\n--- Level distribution ---")
if "Level" in df.columns:
    print(df["Level"].value_counts(dropna=False))

l6 = df[df["Level"] == 6]
print(f"\nLevel 6 (POS) rows: {len(l6)}")
pos_col = "Unnamed: 2" if "Unnamed: 2" in df.columns else None
if pos_col:
    codes = l6[pos_col].dropna().astype(str).tolist()
    cnt = Counter(codes)
    dups = {k: v for k, v in cnt.items() if v > 1}
    print(f"Total POS codes: {len(codes)}, unique: {len(set(codes))}")
    print("DUPLICATE POS codes:", dups)
    if dups:
        for k in dups:
            print(f"\n  --- rows for duplicate code '{k}' ---")
            print(l6[l6[pos_col].astype(str) == k].to_string())

print("\n=== ZONE FILE ===")
dfz = pd.read_excel(zone_path)
dfz.columns = [str(c).strip() for c in dfz.columns]
print("shape:", dfz.shape)
print("Columns:", list(dfz.columns))
print(dfz.head(8).to_string())
