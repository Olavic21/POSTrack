import pandas as pd

# Analyser le fichier ZONE ODI
xl = pd.ExcelFile('database/imports/ODI/ZONE ODI.xlsx')
df = xl.parse('Feuil1')

print('Colonnes:', df.columns.tolist())
print('Nombre de lignes:', len(df))

# Nettoyer les données - supprimer les lignes vides
df_clean = df.dropna(subset=['SN', 'BTS CODE NAME'])
print('Nombre de lignes après nettoyage:', len(df_clean))

print('\n--- Aperçu des données nettoyées ---')
print(df_clean.head(20))

print('\n--- Analyse de la colonne POS ---')
# Regarder les valeurs de la colonne POS pour comprendre le format
pos_sample = df_clean['POS'].dropna()
print(f'Nombre de lignes avec POS: {len(pos_sample)}')
print('Échantillon de valeurs POS:')
print(pos_sample.head(20))

print('\n--- Analyse des partenaires ---')
print('Partenaires uniques:', df_clean['PARTNERS'].unique())

print('\n--- BTS avec coordonnées GPS ---')
bts_with_gps = df_clean[df_clean['GPS COORDINATES'].notna()]
print(f'Nombre de BTS avec GPS: {len(bts_with_gps)}')
print(bts_with_gps[['BTS CODE NAME', 'GPS COORDINATES', 'POS']].head(10))
