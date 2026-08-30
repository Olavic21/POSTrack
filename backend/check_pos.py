from app.core.database import SessionLocal
from app.models.pos import POS

db = SessionLocal()
all_pos = db.query(POS).all()
print(f'Total POS: {len(all_pos)}')
for pos in all_pos:
    print(f'  - {pos.code_pos} (partner_id={pos.partner_id})')
db.close()