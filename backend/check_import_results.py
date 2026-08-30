from app.core.database import SessionLocal
from app.models.pos import POS
from app.models.dsm import DSM
from app.models.bts import BTS

db = SessionLocal()
print('=== RÉCAPITULATIF DE L\'IMPORT ===')
print(f'\n--- ODI (PART-ODI) ---')
print(f'DSM: {db.query(DSM).filter(DSM.partner_id == 4).count()}')
print(f'POS: {db.query(POS).filter(POS.partner_id == 4).count()}')
print(f'BTS: {db.query(BTS).filter(BTS.partner_id == 4).count()}')

print(f'\n--- MasterColor (PART-MC) ---')
print(f'DSM: {db.query(DSM).filter(DSM.partner_id == 2).count()}')
print(f'POS: {db.query(POS).filter(POS.partner_id == 2).count()}')
print(f'BTS: {db.query(BTS).filter(BTS.partner_id == 2).count()}')

print(f'\n--- ÉCHANTILLON DE DONNÉES ODI ---')
sample_dsm = db.query(DSM).filter(DSM.partner_id == 4).first()
if sample_dsm:
    print(f'DSM exemple: {sample_dsm.full_name} (org_id={sample_dsm.org_id}, color_code={sample_dsm.color_code}, sim_balance={sample_dsm.sim_balance})')

sample_pos = db.query(POS).filter(POS.partner_id == 4).first()
if sample_pos:
    print(f'POS exemple: {sample_pos.name} (org_id={sample_pos.org_id}, color_code={sample_pos.color_code}, sim_balance={sample_pos.sim_balance})')

sample_bts = db.query(BTS).filter(BTS.partner_id == 4).first()
if sample_bts:
    print(f'BTS exemple: {sample_bts.code_bts} (latitude={sample_bts.latitude}, longitude={sample_bts.longitude}, coverage_km2={sample_bts.coverage_km2})')

print(f'\n--- ÉCHANTILLON DE DONNÉES MASTERCOLOR ---')
sample_mc_pos = db.query(POS).filter(POS.partner_id == 2).first()
if sample_mc_pos:
    print(f'POS exemple: {sample_mc_pos.name} (latitude={sample_mc_pos.latitude}, longitude={sample_mc_pos.longitude}, zone={sample_mc_pos.zone})')

db.close()