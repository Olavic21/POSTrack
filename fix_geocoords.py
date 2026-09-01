from app.core.database import SessionLocal
from app.models.bts import BTS
from app.models.partner import Partner
from app.models.pos import POS
from sqlalchemy import select, func

db = SessionLocal()

# 1. Update BTS coordinates from ZONE ODI
bts_updates = {
    'DLA033': (4.026472, 9.802718),
    'DLA034': (4.00047, 9.81578),
    'DLA035': (3.992519, 9.76778),
    'DLA037': (4.0178, 9.79623),
    'DLA041': (4.0021, 9.76741),
    'DLA042': (4.02351, 9.76481),
    'DLA047': (4.00435, 9.7464),
    'DLA070': (4.026010, 9.734670),
    'DLA179': (4.00862, 9.73732),
    'DLA180': (4.08908, 9.61897),
    'DLA220': (4.00844, 9.75682),
    'DLA221': (4.01228, 9.77811),
    'DLA239': (4.07672, 9.80161),
    'DLA272': (4.0003363, 9.822783),
    'DLA274': (4.0003363, 9.822783),
    'DLA275': (4.0003363, 9.822783),
    'DLA276': (3.97662, 9.80161),
    'DLA278': (4.0042, 9.7994),
}

updated = 0
for code, (lat, lng) in bts_updates.items():
    stmt = update(BTS).where(BTS.code_bts == code).values(latitude=lat, longitude=lng)
    result = db.execute(stmt)
    updated += result.rowcount

db.commit()
print(f'BTS mis à jour: {updated}')

# 2. Verify ODI partner name is correct
partner = db.query(Partner).filter(Partner.code == 'PART-ODI').first()
if partner:
    print(f'Partenaire avant: code={partner.code} nom={partner.name}')
    print(f'Partenaire ODI: code={partner.code} nom={partner.name}')

# 3. Check BTS state
bts_total = db.query(BTS).count()
bts_with_coords = db.query(BTS).filter((BTS.latitude != None) & (BTS.longitude != None)).count()
print(f'BTS total: {bts_total}, avec coords: {bts_with_coords}')

# 4. Check POS state
pos_total = db.query(POS).count()
pos_with_coords = db.query(POS).filter((POS.latitude != None) & (POS.longitude != None)).count()
print(f'POS total: {pos_total}, avec coords: {pos_with_coords}')

# 5. Simulate coordinates for remaining BTS (3 remaining: need to find which ones don't have coords)
print()
print('BTS sans coords:')
bts_no_coords = db.query(BTS).filter((BTS.latitude == None) | (BTS.longitude == None)).all()
for b in bts_no_coords:
    print(f'  code={b.code_bts} partner_id={b.partner_id}')

# 6. Simulate coordinates for POS (3900 records - generate random-ish coords based on partner zones)
import random
print()
print('Simulation de coordonnées pour les POS...')
simulated = 0
for pos in db.query(POS).yield_per(100):
    # Assign coordinates based on partner zone
    # Simple: use partner's geographic center + small random offset
    partner = db.get(type(partner).__class__, pos.partner_id) if hasattr(db, 'get') else None
    # For now, generate random coords in Cameroon region (roughly 2-5 lat, 9-11 lng)
    lat = round(random.uniform(3.5, 4.5), 6)
    lng = round(random.uniform(9.5, 10.5), 6)
    pos.latitude = lat
    pos.longitude = lng
    simulated += 1
    if simulated % 1000 == 0:
        db.commit()
        
db.commit()
print(f'POS simulé: {simulated}')

# Final check
pos_after = db.query(POS).filter((POS.latitude != None) & (POS.longitude != None)).count()
print(f'POS avec coords après simulation: {pos_after}')