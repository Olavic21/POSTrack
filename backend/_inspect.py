"""Inspection v2 : contenu detaille des fichiers Excel (UTF-8)."""
import io
import sys
import pandas as pd

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

print('=== MASTER_COLOR JUIN (header=None, 15 premieres lignes) ===')
xl = pd.ExcelFile('../database/imports/MASTER_COLOR/MASTER_COLOR_JUIN_2026.xlsx')
print('SHEETS:', xl.sheet_names)
df = xl.parse(xl.sheet_names[0], header=None)
print('Shape:', df.shape)
for i in range(min(15, len(df))):
    print(f'L{i}:', [str(v)[:30] for v in df.iloc[i].tolist()])

print()
print('=== MASTER_COLOR JUILLET (header=None, 15 premieres lignes) ===')
xl2 = pd.ExcelFile('../database/imports/MASTER_COLOR/MASTER_COLOR_JUILLET_2026.xlsx')
print('SHEETS:', xl2.sheet_names)
df2 = xl2.parse(xl2.sheet_names[0], header=None)
print('Shape:', df2.shape)
for i in range(min(15, len(df2))):
    print(f'L{i}:', [str(v)[:30] for v in df2.iloc[i].tolist()])

print()
print('=== STOCK ODI ===')
df3 = pd.read_excel('../database/imports/ODI/STOCK ODI 27 Aug 26.xlsx',
                    sheet_name='ORG_620481299_BalanceOverview_2')
print('Columns:', list(df3.columns))
print('Level counts:', df3['Level'].value_counts().to_dict())
lv5 = df3[df3['Level'] == 5]
print('Level 5 (DSM) count:', len(lv5))
for i in range(min(8, len(lv5))):
    print(f'DSM row {i}:', [str(v)[:40] for v in lv5.iloc[i].tolist()])
lv6 = df3[df3['Level'] == 6]
print('Level 6 (POS) count:', len(lv6))
for i in range(min(8, len(lv6))):
    print(f'POS row {i}:', [str(v)[:40] for v in lv6.iloc[i].tolist()])
# Noms des organisations level 5 (matricules)
print()
print('Level5 col Unnamed: 2 uniques:', lv5['Unnamed: 2'].dropna().unique()[:30].tolist())
print('Level5 Unnamed: 4 uniques:', lv5['Unnamed: 4'].dropna().unique().tolist())

