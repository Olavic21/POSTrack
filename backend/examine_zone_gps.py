import pandas as pd

df = pd.read_excel('../database/imports/ODI/ZONE ODI.xlsx')
print('Examen des coordonnées GPS dans le fichier ZONE:')
print('Colonnes disponibles:', df.columns.tolist())
print('\nLignes avec coordonnées GPS:')
gps_rows = df[df['GPS COORDINATES'].notna()]
print(f'Nombre de lignes avec GPS: {len(gps_rows)}')
print('\nÉchantillon de coordonnées GPS:')
for idx, row in gps_rows.head(10).iterrows():
    print(f"BTS: {row.get('BTS CODE NAME')}, GPS: {row.get('GPS COORDINATES')}")