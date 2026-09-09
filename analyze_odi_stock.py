import pandas as pd

# Analyser le fichier STOCK ODI
df = pd.read_excel('database/imports/ODI/STOCK ODI 27 Aug 26.xlsx', sheet_name='ORG_620481299_BalanceOverview_2')

print('Colonnes:', df.columns.tolist())
print('\n--- Aperçu des données ---')
print(df.head(30))
print('\n--- Niveaux uniques ---')
print(df['Level'].unique())
print('\n--- Organisation Names par niveau ---')
for level in sorted(df['Level'].unique()):
    print(f'Niveau {level}:', df[df['Level']==level]['Organization Name'].unique()[:10])

print('\n--- Comptage par niveau ---')
print(df['Level'].value_counts())

print('\n--- Détail des DSM (niveau 5) ---')
dsm_data = df[df['Level'] == 5]
print(f'Nombre de DSM: {len(dsm_data)}')
print(dsm_data[['Organization Name', 'Parent Organization Name']].head(20))

print('\n--- Détail des POS (niveaux supérieurs) ---')
for level in [6, 7, 8, 9]:
    if level in df['Level'].unique():
        pos_data = df[df['Level'] == level]
        print(f'Niveau {level}: {len(pos_data)} organisations')
        print(pos_data['Organization Name'].head(10))
