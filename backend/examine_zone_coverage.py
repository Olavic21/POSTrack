import pandas as pd

df = pd.read_excel('../database/imports/ODI/ZONE ODI.xlsx')
print('Examen des données de couverture dans le fichier ZONE:')
print('Colonnes disponibles:', df.columns.tolist())
print('\nLignes avec données de couverture:')
coverage_rows = df[df['COVERAGE (Km²)'].notna()]
print(f'Nombre de lignes avec couverture: {len(coverage_rows)}')
print('\nÉchantillon de données de couverture:')
for idx, row in coverage_rows.head(10).iterrows():
    print(f"BTS: {row.get('BTS CODE NAME')}, Coverage: {row.get('COVERAGE (Km²)')}, Capacity: {row.get('CAPACITY')}, Traffic: {row.get('TRAFFIC VOLUME(GB)')}")