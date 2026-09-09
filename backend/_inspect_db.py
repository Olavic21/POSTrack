"""Inspection v4 : dependances FK et ordre de suppression (UTF-8 via fichier)."""
import sqlite3

conn = sqlite3.connect('postrack.db')
conn.execute("PRAGMA foreign_keys = ON")
cur = conn.cursor()

# Lister toutes les FK de la base
print('=== SCHEMA FK (tables dependant de pos / dsm / partners / bts) ===')
tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
for t in tables:
    fks = cur.execute(f"PRAGMA foreign_key_list({t})").fetchall()
    if fks:
        for f in fks:
            print(f'  {t}.{f[3]} -> {f[2]}.{f[4]}')
        print()

conn.close()

# Decrire les colonnes de chaque table cle
print('=== TABLES CLES : colonnes ===')
for t in ['pos', 'dsm', 'sims', 'sim_movements', 'primes', 'reconductions',
          'pos_performance', 'dsm_objectives', 'dsm_commissions', 'requete_entites',
          'user_pos', 'users', 'user_partners', 'bts', 'micro_zones']:
    cols = cur.execute(f"PRAGMA table_info({t})").fetchall()
    print(f'{t}: {[c[1] for c in cols]}')
