import pandas as pd
import re

# Parse ZONE ODI Excel
xl = pd.ExcelFile('database/imports/ODI/ZONE ODI.xlsx')
df = xl.parse('Feuil1')

print('=== ZONE ODI ===')
print('Total rows:', len(df))
print('Columns:', list(df.columns))
print()

# Extract GPS coordinates
gps_rows = df[df['GPS COORDINATES'].notna()]
print(f'Rows with GPS coordinates: {len(gps_rows)}')
for _, row in gps_rows.iterrows():
    sn = row['SN']
    bts_code = row['BTS CODE NAME']
    gps = row['GPS COORDINATES']
    print(f'  SN={sn} BTS={bts_code} GPS={gps}')

print()

# Also check STOCK ODI
xl2 = pd.ExcelFile('database/imports/ODI/STOCK ODI 27 Aug 26.xlsx')
df2 = xl2.parse('ORG_620481299_BalanceOverview_2')
print('=== STOCK ODI ===')
print('Columns:', list(df2.columns))
print(df2.head(3))

print()
print('=== MASTER_COLOR ===')
xl3 = pd.ExcelFile('database/imports/MASTER_COLOR/MASTER_COLOR_JUIN_2026.xlsx')
df3 = xl3.parse('Feuil1')
print('Columns:', list(df3.columns))
print(df3.head(3))