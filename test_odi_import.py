import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.core.database import SessionLocal
from app.models.partner import Partner
from app.models.pos import POS
from app.models.dsm import DSM
from app.models.bts import BTS

print("=== Vérification directe des données ODI importées ===\n")

db = SessionLocal()

try:
    # 1. Vérifier les partenaires
    print("1. Partenaires:")
    partners = db.query(Partner).all()
    print(f"   Nombre de partenaires: {len(partners)}")
    for partner in partners:
        print(f"   - {partner.code}: {partner.name}")

    # 2. Vérifier les DSM ODI
    print("\n2. DSM ODI:")
    partner_odi = db.query(Partner).filter(Partner.code == 'PART-AUDI').first()
    if partner_odi:
        dsm_list = db.query(DSM).filter(DSM.partner_id == partner_odi.id).all()
        print(f"   Nombre total de DSM ODI: {len(dsm_list)}")
        if dsm_list:
            print("   Premiers DSM ODI:")
            for dsm in dsm_list[:5]:
                print(f"     - {dsm.matricule}: {dsm.full_name} (org_id: {dsm.org_id})")
    else:
        print("   Partenaire ODI non trouvé")

    # 3. Vérifier les POS ODI
    print("\n3. POS ODI:")
    if partner_odi:
        pos_list = db.query(POS).filter(POS.partner_id == partner_odi.id).all()
        print(f"   Nombre total de POS ODI: {len(pos_list)}")
        if pos_list:
            print("   Premiers POS ODI:")
            for pos in pos_list[:5]:
                print(f"     - {pos.code_pos}: {pos.name} (org_id: {pos.org_id}, sim_balance: {pos.sim_balance})")
    else:
        print("   Partenaire ODI non trouvé")

    # 4. Vérifier les BTS ODI
    print("\n4. BTS ODI:")
    if partner_odi:
        bts_list = db.query(BTS).filter(BTS.partner_id == partner_odi.id).all()
        print(f"   Nombre total de BTS ODI: {len(bts_list)}")
        if bts_list:
            print("   Premières BTS ODI:")
            for bts in bts_list[:5]:
                coords = f"({bts.latitude}, {bts.longitude})" if bts.latitude else "Pas de coordonnées"
                print(f"     - {bts.code_bts}: {coords} (coverage: {bts.coverage_km2} km²)")
    else:
        print("   Partenaire ODI non trouvé")

    print("\n=== Vérification terminée ===")

finally:
    db.close()
