"""
Re-import ODI data using the OFFICIAL service (odi_import_service.py).

The DB was previously loaded with the old standalone `import_odi_real_data.py`
which:
  - never imported color_code (LT3..LT8) -> 0/n
  - fabricated code_pos as ODI-POS-<org_id> -> real POS codes lost
  - linked POS->DSM randomly -> hierarchy lost
Re-importing with the official service fixes all three, and (with the
commit 4eb421d fix) preserves the 96 orphan-DSM4 POS via a placeholder DSM.
"""
import os, sys, shutil
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.core.database import SessionLocal, engine, Base
from app.models.partner import Partner
from app.models.dsm import DSM
from app.models.pos import POS
from app.models.bts import BTS
from app.services.odi_import_service import import_partner_files

STOCK = os.path.join('database', 'imports', 'ODI', 'STOCK ODI 27 Aug 26.xlsx')
ZONE = os.path.join('database', 'imports', 'ODI', 'ZONE ODI.xlsx')

# 0) backup
shutil.copy('postrack.db', 'postrack.db.bak')
print("Backup -> postrack.db.bak")

db = SessionLocal()
try:
    partner = db.query(Partner).filter(Partner.code == 'PART-AUDI').first()
    assert partner, "Partner PART-AUDI not found"
    pid = partner.id
    print(f"Partner: {partner.code} (id={pid})")

    # 1) clear old (incorrect) ODI data for this partner
    n_pos = db.query(POS).filter(POS.partner_id == pid).delete(synchronize_session=False)
    n_bts = db.query(BTS).filter(BTS.partner_id == pid).delete(synchronize_session=False)
    n_dsm = db.query(DSM).filter(DSM.partner_id == pid).delete(synchronize_session=False)
    db.commit()
    print(f"Cleared old data: POS={n_pos}, BTS={n_bts}, DSM={n_dsm}")

    # 2) read file bytes
    with open(STOCK, 'rb') as f:
        stock_bytes = f.read()
    with open(ZONE, 'rb') as f:
        zone_bytes = f.read()

    # 3) official import
    result = import_partner_files(db, partner_id=pid, zone_bytes=zone_bytes, stock_bytes=stock_bytes)
    print("\n=== Import result ===")
    import json
    print(json.dumps(result, indent=2, default=str))
finally:
    db.close()
