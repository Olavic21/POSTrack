#!/usr/bin/env python3
"""
Import personnalisé pour les fichiers Excel des partenaires ODI et MasterColor.
Gère les formats spécifiques de ces fichiers.
"""
import os
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.partner import Partner
from app.models.dsm import DSM
from app.models.pos import POS, TypePos, StatutPos
from app.models.bts import BTS


def import_odi_stock(db: Session, partner_id: int, file_path: str):
    """Import du fichier STOCK ODI avec toutes les données disponibles."""
    print(f"Import du fichier STOCK ODI: {file_path}")
    
    df = pd.read_excel(file_path)
    print(f"Colonnes trouvées: {df.columns.tolist()}")
    print(f"Nombre de lignes: {len(df)}")
    
    # Nettoyer les données
    df = df.dropna(subset=['Organization Name'])
    
    # Filtrer les DSM (Level 5) et POS (Level 6)
    dsms = df[df['Level'] == 5]
    poss = df[df['Level'] == 6]
    
    print(f"DSM trouvés: {len(dsms)}")
    print(f"POS trouvés: {len(poss)}")
    
    dsm_map = {}
    created_dsm = 0
    updated_dsm = 0
    
    # Importer les DSM avec toutes les informations
    for _, row in dsms.iterrows():
        org_id = str(row['Organization Name']).strip()
        name = str(row['Unnamed: 2']).strip() if pd.notna(row['Unnamed: 2']) else org_id
        color_code = str(row['Unnamed: 4']).strip() if pd.notna(row['Unnamed: 4']) else None
        sim_balance = row.get('                                                Current Balance                                                ')
        
        existing = db.query(DSM).filter(
            DSM.partner_id == partner_id, 
            DSM.org_id == org_id
        ).first()
        
        if existing:
            existing.full_name = name
            if color_code:
                existing.color_code = color_code
            if sim_balance is not None and not pd.isna(sim_balance):
                existing.sim_balance = float(sim_balance)
            db.add(existing)
            updated_dsm += 1
        else:
            dsm = DSM(
                partner_id=partner_id,
                matricule=f"DSM-{org_id}",
                full_name=name,
                zone="À définir",
                org_id=org_id,
                color_code=color_code,
                sim_balance=float(sim_balance) if sim_balance is not None and not pd.isna(sim_balance) else None
            )
            db.add(dsm)
            db.flush()
            dsm_map[org_id] = dsm
            created_dsm += 1
    
    # Créer un DSM par défaut pour les POS sans parent
    default_dsm = db.query(DSM).filter(
        DSM.partner_id == partner_id,
        DSM.matricule == "DSM-DEFAULT"
    ).first()
    
    if not default_dsm:
        default_dsm = DSM(
            partner_id=partner_id,
            matricule="DSM-DEFAULT",
            full_name="DSM Par Défaut",
            zone="Zone par défaut",
            org_id="DEFAULT"
        )
        db.add(default_dsm)
        db.flush()
    
    default_dsm_id = default_dsm.id
    
    # Importer les POS avec toutes les informations
    created_pos = 0
    updated_pos = 0
    
    for _, row in poss.iterrows():
        org_id = str(row['Organization Name']).strip()
        pos_code = f"POS-{org_id}"
        pos_name = str(row['Unnamed: 2']).strip() if pd.notna(row['Unnamed: 2']) else pos_code
        parent_org = str(row['Parent Organization Name']).strip() if pd.notna(row['Parent Organization Name']) else None
        color_code = str(row['Unnamed: 4']).strip() if pd.notna(row['Unnamed: 4']) else None
        sim_balance = row.get('                                                Current Balance                                                ')
        
        # Extraire l'ID du DSM parent depuis le format "ID - DSMXX_CODE"
        parent_dsm_id = None
        if parent_org:
            try:
                # Format: "622085010 - DSM57_LT4"
                parent_dsm_str = parent_org.split(' - ')[0].strip().replace('\t', '').replace('"', '')
                parent_dsm = db.query(DSM).filter(
                    DSM.partner_id == partner_id,
                    DSM.org_id == parent_dsm_str
                ).first()
                if parent_dsm:
                    parent_dsm_id = parent_dsm.id
            except (IndexError, ValueError):
                pass
        
        dsm_id = parent_dsm_id if parent_dsm_id else default_dsm_id
        
        existing = db.query(POS).filter(
            POS.partner_id == partner_id,
            POS.code_pos == pos_code
        ).first()
        
        if existing:
            if dsm_id:
                existing.dsm_id = dsm_id
            if color_code:
                existing.color_code = color_code
            if sim_balance is not None and not pd.isna(sim_balance):
                existing.sim_balance = float(sim_balance)
            existing.name = pos_name
            db.add(existing)
            updated_pos += 1
        else:
            pos = POS(
                partner_id=partner_id,
                dsm_id=dsm_id,
                code_pos=pos_code,
                name=pos_name,
                org_id=org_id,
                color_code=color_code,
                sim_balance=float(sim_balance) if sim_balance is not None and not pd.isna(sim_balance) else None,
                type_pos=TypePos.NOUVEAU,
                status=StatutPos.ACTIF,
                stock_initial=0,
                stock_actuel=0,
                date_creation=date.today(),
                date_expiration=date.today().replace(year=date.today().year + 1),
            )
            db.add(pos)
            created_pos += 1
    
    db.commit()
    print(f"Import STOCK terminé: {created_dsm} DSM créés, {updated_dsm} DSM mis à jour, {created_pos} POS créés, {updated_pos} POS mis à jour")


def import_odi_zone(db: Session, partner_id: int, file_path: str):
    """Import du fichier ZONE ODI avec coordonnées GPS et zones de couverture."""
    print(f"Import du fichier ZONE ODI: {file_path}")
    
    df = pd.read_excel(file_path)
    print(f"Colonnes trouvées: {df.columns.tolist()}")
    print(f"Nombre de lignes: {len(df)}")
    
    created_bts = 0
    updated_bts = 0
    pos_gps_updates = 0
    
    # Dictionnaire pour stocker les coordonnées GPS par POS (si disponibles)
    pos_gps_data = {}
    
    for _, row in df.iterrows():
        # Le fichier ZONE a une colonne 'BTS CODE NAME'
        bts_code = str(row.get('BTS CODE NAME', '')).strip() if pd.notna(row.get('BTS CODE NAME')) else None
        if not bts_code or bts_code == 'nan':
            continue
            
        existing = db.query(BTS).filter(
            BTS.partner_id == partner_id,
            BTS.code_bts == bts_code
        ).first()
        
        # Extraire les coordonnées GPS si disponibles
        gps_coords = str(row.get('GPS COORDINATES', '')).strip() if pd.notna(row.get('GPS COORDINATES')) else None
        latitude = None
        longitude = None
        if gps_coords and gps_coords != 'nan':
            try:
                # Format peut être: "latitude, longitude" ou "latitude   longitude" (espaces multiples)
                # Remplacer les virgules par des espaces et nettoyer
                coords_clean = gps_coords.replace(',', ' ')
                parts = coords_clean.split()
                if len(parts) >= 2:
                    latitude = float(parts[0].strip())
                    longitude = float(parts[1].strip())
            except (ValueError, IndexError):
                pass
        
        # Extraire et parser la capacité
        capacity_str = str(row.get('CAPACITY', '')).strip() if pd.notna(row.get('CAPACITY')) else None
        capacite_max = 1000.0  # Valeur par défaut
        if capacity_str and capacity_str != 'nan':
            try:
                # Format: "2700 Channels" ou similaire
                if 'Channels' in capacity_str:
                    capacite_max = float(capacity_str.split()[0])
                else:
                    capacite_max = float(capacity_str)
            except (ValueError, IndexError):
                pass
        
        # Extraire la couverture en km²
        coverage_str = str(row.get('COVERAGE (Km²)', '')).strip() if pd.notna(row.get('COVERAGE (Km²)')) else None
        coverage_km2 = None
        if coverage_str and coverage_str != 'nan':
            try:
                # Nettoyer les valeurs mal formatées comme ".1.1" -> prendre la première valeur
                if coverage_str.startswith('.'):
                    coverage_str = '0' + coverage_str
                # Si il y a plusieurs points, prendre avant le premier point
                if coverage_str.count('.') > 1:
                    coverage_str = coverage_str.split('.')[0] + '.' + coverage_str.split('.')[1]
                coverage_km2 = float(coverage_str)
            except ValueError:
                pass
        
        # Extraire le volume de trafic
        traffic_str = str(row.get('TRAFFIC VOLUME(GB)', '')).strip() if pd.notna(row.get('TRAFFIC VOLUME(GB)')) else None
        traffic_volume_gb = None
        if traffic_str and traffic_str != 'nan':
            try:
                traffic_volume_gb = float(traffic_str)
            except ValueError:
                pass
        
        # Parser les boundary points (format JSON)
        boundary_str = str(row.get('BOUNDARIES', '')).strip() if pd.notna(row.get('BOUNDARIES')) else None
        boundary_points = None
        if boundary_str and boundary_str != 'nan':
            try:
                import json
                boundary_points = json.loads(boundary_str)
            except (json.JSONDecodeError, ValueError):
                # Si ce n'est pas du JSON, garder comme texte
                boundary_points = boundary_str
        
        # Parser le radius
        radius_str = str(row.get('RADIUS', '')).strip() if pd.notna(row.get('RADIUS')) else None
        radius_m = None
        if radius_str and radius_str != 'nan':
            try:
                radius_m = float(radius_str)
            except ValueError:
                pass
        
        if existing:
            if latitude:
                existing.latitude = latitude
            if longitude:
                existing.longitude = longitude
            if capacite_max:
                existing.capacite_max = capacite_max
            if coverage_km2:
                existing.coverage_km2 = coverage_km2
            if traffic_volume_gb:
                existing.traffic_volume_gb = traffic_volume_gb
            if boundary_points:
                existing.boundary_points = boundary_points
            if radius_m:
                existing.radius_m = radius_m
            if row.get('QUARTER'):
                existing.quarter = str(row.get('QUARTER')).strip()
            if row.get('STREET'):
                existing.street = str(row.get('STREET')).strip()
            if row.get('PROMINENT SITES'):
                existing.prominent_site = str(row.get('PROMINENT SITES')).strip()
            db.add(existing)
            updated_bts += 1
        else:
            bts = BTS(
                partner_id=partner_id,
                code_bts=bts_code,
                operateur='ODI',
                technologie='4G',
                capacite_max=capacite_max,
                latitude=latitude,
                longitude=longitude,
                zone=str(row.get('QUARTER', 'À définir')).strip() if pd.notna(row.get('QUARTER')) else 'À définir',
                quarter=str(row.get('QUARTER')).strip() if pd.notna(row.get('QUARTER')) else None,
                street=str(row.get('STREET')).strip() if pd.notna(row.get('STREET')) else None,
                prominent_site=str(row.get('PROMINENT SITES')).strip() if pd.notna(row.get('PROMINENT SITES')) else None,
                boundary_points=boundary_points,
                coverage_km2=coverage_km2,
                traffic_volume_gb=traffic_volume_gb,
                radius_m=radius_m
            )
            db.add(bts)
            created_bts += 1
    
    db.commit()
    print(f"Import ZONE terminé: {created_bts} BTS créés, {updated_bts} BTS mis à jour")


def import_mastercolor(db: Session, partner_id: int, file_path: str):
    """Import des fichiers MasterColor avec toutes les données disponibles."""
    print(f"Import du fichier MasterColor: {file_path}")
    
    df = pd.read_excel(file_path)
    print(f"Colonnes trouvées: {df.columns.tolist()}")
    print(f"Nombre de lignes: {len(df)}")
    
    # Créer un DSM par défaut pour MasterColor
    default_dsm = db.query(DSM).filter(
        DSM.partner_id == partner_id,
        DSM.matricule == "DSM-MC-DEFAULT"
    ).first()
    
    if not default_dsm:
        default_dsm = DSM(
            partner_id=partner_id,
            matricule="DSM-MC-DEFAULT",
            full_name="DSM Master Color Par Défaut",
            zone="Zone Master Color",
            org_id="MC-DEFAULT"
        )
        db.add(default_dsm)
        db.flush()
    
    default_dsm_id = default_dsm.id
    
    created_pos = 0
    updated_pos = 0
    created_dsm = 0
    
    # Le fichier semble avoir des colonnes avec "Unnamed", examiner la première ligne pour les en-têtes
    if len(df) > 0:
        # Utiliser la première ligne comme en-têtes
        headers = df.iloc[0]
        df.columns = headers
        df = df[1:]  # Supprimer la ligne d'en-têtes
        df = df.reset_index(drop=True)
        print(f"Nouvelles colonnes après extraction: {df.columns.tolist()}")
    
    # Créer les DSM spécifiques mentionnés dans le fichier
    dsm_map = {}
    if 'Numeros DSM' in df.columns:
        unique_dsms = df['Numeros DSM'].dropna().unique()
        for dsm_number in unique_dsms:
            dsm_str = str(dsm_number).strip()
            if dsm_str and dsm_str != 'nan':
                existing_dsm = db.query(DSM).filter(
                    DSM.partner_id == partner_id,
                    DSM.org_id == dsm_str
                ).first()
                if not existing_dsm:
                    dsm = DSM(
                        partner_id=partner_id,
                        matricule=f"DSM-MC-{dsm_str}",
                        full_name=f"DSM Master Color {dsm_str}",
                        zone="Zone Master Color",
                        org_id=dsm_str
                    )
                    db.add(dsm)
                    db.flush()
                    dsm_map[dsm_str] = dsm
                    created_dsm += 1
                else:
                    dsm_map[dsm_str] = existing_dsm
    
    for _, row in df.iterrows():
        # Chercher la colonne qui contient le numéro de POS
        pos_number = None
        for col in df.columns:
            if 'POS' in str(col) or 'Numero' in str(col):
                pos_number = str(row[col]).strip() if pd.notna(row[col]) else None
                if pos_number and pos_number != 'nan':
                    break
        
        if not pos_number or pos_number == 'nan':
            continue
            
        pos_code = f"POS-MC-{pos_number}"
        
        # Extraire toutes les informations disponibles
        pos_name = str(row.get('Noms et Prenoms POS', '')).strip() if pd.notna(row.get('Noms et Prenoms POS')) else f"POS Master Color {pos_number}"
        contact = str(row.get('Autres contact', '')).strip() if pd.notna(row.get('Autres contact')) else None
        quarter = str(row.get('Quartiers ', '')).strip() if pd.notna(row.get('Quartiers ')) else None
        lieu_dit = str(row.get('Lieu Dit', '')).strip() if pd.notna(row.get('Lieu Dit')) else None
        longitude_str = str(row.get('Longitude ', '')).strip() if pd.notna(row.get('Longitude ')) else None
        latitude_str = str(row.get('Latitude', '')).strip() if pd.notna(row.get('Latitude')) else None
        dsm_number = str(row.get('Numeros DSM', '')).strip() if pd.notna(row.get('Numeros DSM')) else None
        
        # Parser les coordonnées GPS
        latitude = None
        longitude = None
        if latitude_str and latitude_str != 'nan':
            try:
                latitude = float(latitude_str.replace(',', '.'))
            except ValueError:
                pass
        if longitude_str and longitude_str != 'nan':
            try:
                longitude = float(longitude_str.replace(',', '.'))
            except ValueError:
                pass
        
        # Trouver le DSM correspondant
        dsm_id = default_dsm_id
        if dsm_number and dsm_number != 'nan' and dsm_number in dsm_map:
            dsm_id = dsm_map[dsm_number].id
        
        existing = db.query(POS).filter(
            POS.partner_id == partner_id,
            POS.code_pos == pos_code
        ).first()
        
        if not existing:
            pos = POS(
                partner_id=partner_id,
                dsm_id=dsm_id,
                code_pos=pos_code,
                name=pos_name,
                address=f"{quarter}, {lieu_dit}" if quarter and lieu_dit else (quarter or lieu_dit),
                zone=quarter,
                latitude=latitude,
                longitude=longitude,
                type_pos=TypePos.NOUVEAU,
                status=StatutPos.ACTIF,
                stock_initial=0,
                stock_actuel=0,
                date_creation=date.today(),
                date_expiration=date.today().replace(year=date.today().year + 1),
                donnees_additionnelles={
                    'contact': contact,
                    'lieu_dit': lieu_dit,
                    'quarter': quarter
                } if contact or lieu_dit or quarter else None
            )
            db.add(pos)
            created_pos += 1
        else:
            # Mettre à jour si existe déjà
            existing.name = pos_name
            if dsm_id:
                existing.dsm_id = dsm_id
            if latitude:
                existing.latitude = latitude
            if longitude:
                existing.longitude = longitude
            if quarter:
                existing.zone = quarter
                existing.address = f"{quarter}, {lieu_dit}" if lieu_dit else quarter
            db.add(existing)
            updated_pos += 1
    
    db.commit()
    print(f"Import MasterColor terminé: {created_dsm} DSM créés, {created_pos} POS créés, {updated_pos} POS mis à jour")


def main():
    db = SessionLocal()
    try:
        # Import ODI complet
        odi_partner = db.query(Partner).filter(Partner.code == "PART-ODI").first()
        if odi_partner:
            print(f"\n=== Import ODI ===")
            print(f"Partenaire: {odi_partner.code} - {odi_partner.name}")
            
            zone_file = Path(__file__).parent.parent.parent / "database" / "imports" / "ODI" / "ZONE ODI.xlsx"
            stock_file = Path(__file__).parent.parent.parent / "database" / "imports" / "ODI" / "STOCK ODI 27 Aug 26.xlsx"
            
            if zone_file.exists():
                import_odi_zone(db, odi_partner.id, str(zone_file))
            
            if stock_file.exists():
                import_odi_stock(db, odi_partner.id, str(stock_file))
        
        # Import MasterColor
        mc_partner = db.query(Partner).filter(Partner.code == "PART-MC").first()
        if mc_partner:
            print(f"\n=== Import MasterColor ===")
            print(f"Partenaire: {mc_partner.code} - {mc_partner.name}")
            
            mc_files = [
                Path(__file__).parent.parent.parent / "database" / "imports" / "MASTER_COLOR" / "MASTER_COLOR_JUILLET_2026.xlsx"
            ]
            
            for mc_file in mc_files:
                if mc_file.exists():
                    import_mastercolor(db, mc_partner.id, str(mc_file))
        
        print("\n=== Import terminé avec succès ===")
        
    except Exception as exc:
        db.rollback()
        print(f"\nERREUR: {exc}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()