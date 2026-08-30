from app.core.database import SessionLocal
from app.models.bts import BTS

db = SessionLocal()
bts_list = db.query(BTS).filter(BTS.partner_id == 4).all()
print('=== BTS ODI avec données complètes ===')
for bts in bts_list[:10]:
    print(f'{bts.code_bts}: lat={bts.latitude}, lon={bts.longitude}, coverage={bts.coverage_km2}, capacity={bts.capacite_max}, traffic={bts.traffic_volume_gb}')
db.close()