import pandas as pd

PATH = r"C:/Users/HP/Desktop/POSTrack/database/imports/ODI/STOCK ODI 27 Aug 26.xlsx"

# 1) sheets
xl = pd.ExcelFile(PATH)
print("SHEETS:", xl.sheet_names)

df = xl.parse(0)
df.columns = [str(c).strip() for c in df.columns]
print("Level value counts:\n", df["Level"].value_counts(dropna=False))

# 2) all level-5 codes
l5 = df[df["Level"] == 5]
print("\nAll level-5 Unnamed:2 codes:")
print([str(s).strip() for s in l5["Unnamed: 2"].dropna()])

# 3) search entire df for 'DSM4' in any column
mask = df.astype(str).apply(lambda c: c.str.strip().eq("DSM4")).any(axis=1)
print("\nRows anywhere with a cell == 'DSM4':", mask.sum())
print(mask[mask].index.tolist()[:20])

# 4) orphaned POS parent chain
l6 = df[df["Level"] == 6]
o = l6[l6["Unnamed: 3"].astype(str).str.strip() == "DSM4"]
print("\nOrphaned POS (parent DSM4) sample Parent Organization Name values:")
print(o["Unnamed: 6"].head(10).tolist())
print("Their color codes (Unnamed:4):", sorted(set(str(c).strip() for c in o["Unnamed: 4"].dropna())))


print("=== All Level-4 rows ===")
l4 = df[df["Level"] == 4]
print(l4[["Level", "Organization Name", "Unnamed: 2", "Unnamed: 3", "Unnamed: 4", "Current Balance"]].to_string())

print("\n=== Any row where Unnamed:2 (code) == 'DSM4' ? ===")
hit = df[ df["Unnamed: 2"].astype(str).str.strip() == "DSM4" ]
print(hit[["Level","Organization Name","Unnamed: 2","Unnamed: 3","Unnamed: 4"]].to_string())

print("\n=== Rows where Unnamed:3 (parent) == 'DSM4' (these are the orphaned POS) ===")
h2 = df[ df["Unnamed: 3"].astype(str).str.strip() == "DSM4" ]
print("count:", len(h2))
print(h2[["Level","Organization Name","Unnamed: 2","Unnamed: 3","Unnamed: 4","Current Balance"]].head(10).to_string())

print("\n=== First 25 rows of file (raw) ===")
print(df.head(25).to_string())

