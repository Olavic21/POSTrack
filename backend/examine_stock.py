import pandas as pd

df = pd.read_excel('../database/imports/ODI/STOCK ODI 27 Aug 26.xlsx')
print('Échantillon de toutes les colonnes pour quelques POS:')
pos_sample = df[df['Level'] == 6].head(5)
for col in df.columns:
    print(f'{col}: {pos_sample[col].tolist()}')