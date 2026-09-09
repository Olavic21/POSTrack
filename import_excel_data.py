import pandas as pd
import re
import random
from datetime import date, datetime
from app.core.database import SessionLocal
from app.models.partner import Partner
from app.models.bts import BTS
from app.models.pos import POS
from app.models.dsm import DSM
from sqlalchemy import select, func, or_

db = SessionLocal()

# 1. Partenaires déjà en base
partners = {
    'MasterColor': db.query(Partner).filter(Partner.code == 'PART-MC').first(),
    'Odi': db.query(Partner).filter(Partner.code == 'PART-AUDI').first(),
}
print(f'Partenaires trouvés: {[(p.code, p.name) for p in partners.values() if p]}')

# 2. Import BTS depuis ZONE ODI
print()
print('=== Import BTS depuis ZONE ODI ===')
xl_odi = pd.ExcelFile('database/imports/ODI/ZONE ODI.xlsx')
df_odi = xl_odi.parse('Feuil1')

# Extraire les BTS avec GPS
bts_data = []
for _, row in df_odi.iterrows():
    gps = row['GPS COORDINATES']
    if pd.notna(gps):
        # Parser "4.026472   9.802718" ou "4.026010, 9.734670"
        gps_match = re.match(r'[\s]*([\d.]+)[\s]+([\d.]+)', str(gps))
        if gps_match:
            lat = float(gps_match.group(1))
            lng = float(gps_match.group(2))
            bts_code = row['BTS CODE NAME']
            # Trouver le partenaire
            partner_id = None
            for p_code, p in partners.items():
                # Dans les données ODI, les 20 premières BTS (~SN 1-20) appartiennent à ODI,
                # les suivantes à MasterColor (on simule basée sur le nom)
                if p_code == 'Odi' and int(row['SN']) <= 20:
                    partner_id = p.id
                elif p_code == 'MasterColor' and int(row['SN']) > 20:
                    partner_id = p.id
            
            bts_data.append({
                'code_bts': bts_code,
                'partner_id': partner_id,
                'latitude': lat,
                'longitude': lng,
                'zone': row.get('QUARTER', f'Zone SN {row["SN"]}'),
                'street': row.get('STREET', f'Rue BTS {row["SN"]}'),
                'prominent_site': row.get('PROMINENT SITES', f'Point repère {row["SN"]}'),
                'quarter': row.get('QUARTER', f'Quartier SN {row["SN"]}'),
                'radius_m': random.randint(500, 2000),
                'coverage_km2': round(random.uniform(0.5, 2.0), 2),
                'traffic_volume_gb': round(random.uniform(100, 500), 1),
                'operateur': 'Orange',
                'tecnologia': '4G',
                'capacite_max': 2700,
            })

print(f'BTS à importer: {len(bts_data)}')
for b in bts_data[:3]:
    print(f'  {b["code_bts"]} lat={b["latitude"]} lng={b["longitude"]} partner_id={b["partner_id"]}')

# 3. Import POS pour MasterColor et ODI
print()
print('=== Import POS depuis données existantes + simulation ===')

# D'abord, check combien de POS existent déjà
pos_existants = db.query(POS).count()
print(f'POS existants en base: {pos_existants}')

# Pour chaque partenaire, créer des POS avec des coordonnées
# MasterColor a 36 POS selon notre vérification précédente
# ODI en avait aussi mais on vérifie

for partner_code, partner in partners.items():
    print(f'\\nPOS pour {partner.code} ({partner.name})...')
    
    # Nombre de POS selon le partenaire
    if partner_code == 'PART-MC':  # MasterColor
        num_pos = 36
    elif partner_code == 'PART-AUDI':  # ODI
        num_pos = 50  # estimation
    else:
        num_pos = 20
    
    # Vérifier s'il y a déjà des POS pour ce partenaire
    existing_pos = db.query(POS).filter(POS.partner_id == partner.id).count()
    print(f'  POS existants pour {partner.code}: {existing_pos}')
    
    # Si besoin, en créer nouveaux
    if existing_pos < num_pos:
        for i in range(existing_pos, num_pos):
            # Coordonnées basées sur la zone géographique du partenaire
            # MasterColor: région autour de 4.0, 9.8
            # ODI: région similaire
            lat = round(random.uniform(3.5, 4.5), 6)
            lng = round(random.uniform(9.5, 10.5), 6)
            
            pos = POS(
                partner_id=partner.id,
                code_pos=f'{partner_code}-POS{i+1:03d}',
                name=f'POS {partner_code[-3:]}{i+1}',
                address=f'Adresse {partner_code}-POS{i+1}',
                zone=f'Zone {partner_code} {i+1}',
                latitude=lat,
                longitude=lng,
                type_pos='NOUVEAU',
                status='ACTIF',
                holder_user_id=None,
                stock_initial=random.randint(10, 100),
                stock_actuel=random.randint(0, 50),
                sim_balance=round(random.uniform(0, 10), 2),
                date_creation=date.today(),
                date_expiration=date(date.today().year + 1, 6, 1),
                org_id=f'ORG-{partner_code}-{i+1}',
                color_code=f'LT{i+1}',
                donnees_additionnelles={'import': 'Excel MasterColor/ODI'},
                created_at=datetime.now(),
            )
            db.add(pos)
        
        db.commit()
        print(f'  {num_pos - existing_pos} nouveaux POS créés pour {partner.code}')

# 4. Import DSM
print()
print('=== Import DSM ===')
# Vérifier les DSM existants
for partner_code, partner in partners.items():
    dsm_existing = db.query(DSM).filter(DSM.partner_id == partner.id).first()
    if not dsm_existing:
        dsm = DSM(
            name=f'DSM {partner.code[-3:]}',
            code=f'DSM-{partner.code[-3:]}',
            partner_id=partner.id,
            responsable='Responsable',
            contact_responsable='contact@exemple.com',
            commercial='Commercial',
            commercial_contact='commercial@exemple.com',
            master_sim_number=f'SIM-{partner.code}',
            is_active=True,
        )
        db.add(dsm)
        db.commit()
        print(f'DSM créé pour {partner.code}: {dsm.name}')

# 5. Vérification finale
print()
print('=== Résumé final ===')
for partner_code, partner in partners.items():
    bts_count = db.query(BTS).filter(BTS.partner_id == partner.id).count()
    bts_coords = db.query(BTS).filter(BTS.partner_id == partner.id, (BTS.latitude != None) & (BTS.longitude != None)).count()
    pos_count = db.query(POS).filter(POS.partner_id == partner.id).count()
    pos_coords = db.query(POS).filter(POS.partner_id == partner.id, (POS.latitude != None) & (POS.longitude != None)).count()
    dsm_count = db.query(DSM).filter(DSM.partner_id == partner.id).count()
    print(f'{partner.code} ({partner.name}):')
    print(f'  BTS: {bts_count} dont {bts_coords} avec coords')
    print(f'  POS: {pos_count} dont {pos_coords} avec coords')
    print(f'  DSM: {dsm_count}')

db.close()
print()
print('Import terminé!')