import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

import pandas as pd
import re
import random
from datetime import date, datetime
from app.core.database import SessionLocal, Base, engine
from app.models.partner import Partner
from app.models.pos import POS
from app.models.dsm import DSM
from app.models.bts import BTS
from sqlalchemy import select

# Créer les tables si elles n'existent pas
Base.metadata.create_all(bind=engine)

# Initialiser la session DB
db = SessionLocal()

try:
    # 1. Récupérer ou créer le partenaire ODI
    partner_odi = db.query(Partner).filter(Partner.code == 'PART-AUDI').first()
    if not partner_odi:
        print("Partenaire ODI non trouvé, création en cours...")
        partner_odi = Partner(
            code='PART-AUDI',
            name='ODI',
            address='Douala, Cameroun',
            is_active=True,
            responsable_name='Responsable ODI',
            responsable_contact='contact@odi.cm',
            commercial_name='Commercial ODI',
            commercial_contact='commercial@odi.cm',
            master_sim_number='SIM-ODI',
            contract_start_date=date.today(),
        )
        db.add(partner_odi)
        db.commit()
        db.refresh(partner_odi)
        print(f"Partenaire ODI créé: {partner_odi.code} - {partner_odi.name}")
    
    print(f"Partenaire ODI trouvé: {partner_odi.code} - {partner_odi.name}")
    
    # 2. Importer les DSM depuis le fichier STOCK ODI
    print("\n=== Import des DSM depuis STOCK ODI ===")
    stock_file = 'database/imports/ODI/STOCK ODI 27 Aug 26.xlsx'
    df_stock = pd.read_excel(stock_file, sheet_name='ORG_620481299_BalanceOverview_2')
    
    # Filtrer les DSM (niveau 5)
    dsm_rows = df_stock[df_stock['Level'] == 5]
    print(f"Nombre de DSM trouvés: {len(dsm_rows)}")
    
    dsm_imported = 0
    dsm_updated = 0
    
    for _, row in dsm_rows.iterrows():
        org_id = str(row['Organization Name']).strip()
        dsm_name = str(row['Unnamed: 2']).strip() if pd.notna(row['Unnamed: 2']) else f"DSM {org_id}"
        
        # Vérifier si le DSM existe déjà
        existing_dsm = db.query(DSM).filter(
            DSM.partner_id == partner_odi.id,
            DSM.org_id == org_id
        ).first()
        
        if existing_dsm:
            # Mettre à jour le DSM existant
            existing_dsm.full_name = dsm_name
            existing_dsm.matricule = f"DSM-{org_id}"
            dsm_updated += 1
        else:
            # Créer un nouveau DSM
            dsm = DSM(
                matricule=f"DSM-{org_id}",
                full_name=dsm_name,
                partner_id=partner_odi.id,
                zone=f"Zone DSM {org_id}",
                org_id=org_id,
            )
            db.add(dsm)
            dsm_imported += 1
    
    db.commit()
    print(f"DSM importés: {dsm_imported}")
    print(f"DSM mis à jour: {dsm_updated}")
    
    # 3. Importer les BTS depuis le fichier ZONE ODI
    print("\n=== Import des BTS depuis ZONE ODI ===")
    zone_file = 'database/imports/ODI/ZONE ODI.xlsx'
    xl_zone = pd.ExcelFile(zone_file)
    df_zone = xl_zone.parse('Feuil1')
    
    # Nettoyer les données - supprimer les lignes vides
    df_zone_clean = df_zone.dropna(subset=['SN', 'BTS CODE NAME'])
    print(f"Nombre de BTS trouvés: {len(df_zone_clean)}")
    
    bts_imported = 0
    bts_updated = 0
    
    for _, row in df_zone_clean.iterrows():
        bts_code = str(row['BTS CODE NAME']).strip()
        gps = row['GPS COORDINATES']
        
        # Parser les coordonnées GPS
        lat = None
        lng = None
        if pd.notna(gps):
            # Parser "4.026472   9.802718" ou "4.026010, 9.734670"
            gps_str = str(gps).replace(',', ' ')
            gps_match = re.match(r'[\s]*([\d.]+)[\s]+([\d.]+)', gps_str)
            if gps_match:
                lat = float(gps_match.group(1))
                lng = float(gps_match.group(2))
        
        # Extraire les autres champs
        coverage = None
        if pd.notna(row['COVERAGE (Km²)']):
            try:
                coverage = float(str(row['COVERAGE (Km²)']).strip())
            except (ValueError, TypeError):
                pass
        
        traffic = None
        if pd.notna(row['TRAFFIC VOLUME(GB)']):
            try:
                traffic = float(str(row['TRAFFIC VOLUME(GB)']).strip())
            except (ValueError, TypeError):
                pass
        
        radius = None
        if pd.notna(row['RADIUS']):
            try:
                radius = float(str(row['RADIUS']).strip())
            except (ValueError, TypeError):
                pass
        
        capacity = None
        if pd.notna(row['CAPACITY']):
            try:
                cap_str = str(row['CAPACITY']).strip()
                # Extraire le nombre de "Channels"
                cap_match = re.search(r'([\d.]+)', cap_str)
                if cap_match:
                    capacity = float(cap_match.group(1))
            except (ValueError, TypeError):
                pass
        
        # Vérifier si la BTS existe déjà
        existing_bts = db.query(BTS).filter(
            BTS.partner_id == partner_odi.id,
            BTS.code_bts == bts_code
        ).first()
        
        if existing_bts:
            # Mettre à jour la BTS existante
            if lat is not None:
                existing_bts.latitude = lat
            if lng is not None:
                existing_bts.longitude = lng
            if coverage is not None:
                existing_bts.coverage_km2 = coverage
            if traffic is not None:
                existing_bts.traffic_volume_gb = traffic
            if radius is not None:
                existing_bts.radius_m = radius
            if capacity is not None:
                existing_bts.capacite_max = capacity
            if pd.notna(row['PROMINENT SITES']):
                existing_bts.prominent_site = str(row['PROMINENT SITES']).strip()
            if pd.notna(row['QUARTER']):
                existing_bts.quarter = str(row['QUARTER']).strip()
            if pd.notna(row['STREET']):
                existing_bts.street = str(row['STREET']).strip()
            if pd.notna(row['BOUNDARIES']):
                existing_bts.boundary_points = str(row['BOUNDARIES']).strip()
            bts_updated += 1
        else:
            # Créer une nouvelle BTS
            bts = BTS(
                partner_id=partner_odi.id,
                code_bts=bts_code,
                operateur='Orange',
                technologie='4G',
                capacite_max=capacity,
                latitude=lat,
                longitude=lng,
                zone=str(row['QUARTER']).strip() if pd.notna(row['QUARTER']) else f'Zone {bts_code}',
                coverage_km2=coverage,
                traffic_volume_gb=traffic,
                boundary_points=str(row['BOUNDARIES']).strip() if pd.notna(row['BOUNDARIES']) else None,
                prominent_site=str(row['PROMINENT SITES']).strip() if pd.notna(row['PROMINENT SITES']) else None,
                quarter=str(row['QUARTER']).strip() if pd.notna(row['QUARTER']) else None,
                street=str(row['STREET']).strip() if pd.notna(row['STREET']) else None,
                radius_m=radius,
            )
            db.add(bts)
            bts_imported += 1
    
    db.commit()
    print(f"BTS importés: {bts_imported}")
    print(f"BTS mis à jour: {bts_updated}")
    
    # 4. Importer les POS depuis le fichier STOCK ODI
    print("\n=== Import des POS depuis STOCK ODI ===")
    
    # Filtrer les POS (niveau 6)
    pos_rows = df_stock[df_stock['Level'] == 6]
    print(f"Nombre de POS trouvés: {len(pos_rows)}")
    
    # Créer un mapping des DSM pour assigner les POS
    dsm_mapping = {}
    all_dsm = db.query(DSM).filter(DSM.partner_id == partner_odi.id).all()
    for dsm in all_dsm:
        if dsm.org_id:
            dsm_mapping[dsm.org_id] = dsm
    
    pos_imported = 0
    pos_updated = 0
    
    for _, row in pos_rows.iterrows():
        org_id = str(row['Organization Name']).strip()
        
        # Assigner un DSM aléatoirement pour l'instant
        # La structure exacte des relations parent-enfant n'est pas claire dans le fichier
        dsm_id = random.choice(all_dsm).id if all_dsm else None
        
        # Vérifier si le POS existe déjà
        existing_pos = db.query(POS).filter(
            POS.partner_id == partner_odi.id,
            POS.org_id == org_id
        ).first()
        
        # Extraire le solde SIM si disponible
        sim_balance = None
        balance_col = '                                                Current Balance                                                '
        if balance_col in row and pd.notna(row[balance_col]):
            try:
                sim_balance = float(str(row[balance_col]).strip())
            except (ValueError, TypeError):
                pass
        
        if existing_pos:
            # Mettre à jour le POS existant
            existing_pos.org_id = org_id
            existing_pos.dsm_id = dsm_id
            if sim_balance is not None:
                existing_pos.sim_balance = sim_balance
            pos_updated += 1
        else:
            # Créer un nouveau POS
            pos = POS(
                partner_id=partner_odi.id,
                dsm_id=dsm_id,
                code_pos=f"ODI-POS-{org_id}",
                name=f"POS ODI {org_id}",
                address=f"Adresse POS {org_id}",
                zone=f"Zone ODI {org_id}",
                latitude=None,  # Pas de coordonnées GPS dans ce fichier
                longitude=None,
                type_pos='NOUVEAU',
                status='ACTIF',
                holder_user_id=None,
                stock_initial=0,
                stock_actuel=0,
                sim_balance=sim_balance,
                org_id=org_id,
                color_code=None,
                donnees_additionnelles={'import_source': 'STOCK ODI 27 Aug 26.xlsx'},
                date_creation=date.today(),
                date_expiration=date(date.today().year + 1, 6, 1),
                created_at=datetime.now(),
            )
            db.add(pos)
            pos_imported += 1
    
    db.commit()
    print(f"POS importés: {pos_imported}")
    print(f"POS mis à jour: {pos_updated}")
    
    # 5. Résumé final
    print("\n=== Résumé de l'import ODI ===")
    total_dsm = db.query(DSM).filter(DSM.partner_id == partner_odi.id).count()
    total_pos = db.query(POS).filter(POS.partner_id == partner_odi.id).count()
    total_bts = db.query(BTS).filter(BTS.partner_id == partner_odi.id).count()
    
    print(f"Partenaire: {partner_odi.code} - {partner_odi.name}")
    print(f"DSM total: {total_dsm}")
    print(f"POS total: {total_pos}")
    print(f"BTS total: {total_bts}")
    
    print("\nImport terminé avec succès!")

except Exception as e:
    print(f"ERREUR lors de l'import: {e}")
    db.rollback()
    raise
finally:
    db.close()
