import py_compile

PATH = r"c:/Users/HP/Desktop/POSTrack/backend/app/services/odi_import_service.py"

# Read in universal-newline mode (CRLF -> LF) so LF based search strings match.
with open(PATH, encoding="utf-8") as f:
    src = f.read()

OLD1 = '''    db.flush()

    # Level 6 : POS
    level6 = df[df["Level"] == 6]'''

NEW1 = '''    db.flush()

    # Cache local des POS crees pendant ce run : le fichier STOCK liste parfois
    # le meme code_pos sous plusieurs DSM parents (cross-listing). La session est
    # en autoflush=False, donc un INSERT en instance n'est pas visible d'une
    # requete ulterieure -> risque de violation de la contrainte UNIQUE
    # (partner_id, code_pos) au commit. Le cache garantit qu'un code est cree une
    # seule fois par run ; les occurrences suivantes le mettent a jour.
    pos_cache: dict[str, POS] = {}

    # Level 6 : POS
    level6 = df[df["Level"] == 6]'''

OLD2 = '''        try:
            existing = db.query(POS).filter(
                POS.partner_id == partner_id, POS.code_pos == pos_code
            ).first()

            if existing:
                if org_id:
                    existing.org_id = org_id
                if color_code:
                    existing.color_code = color_code
                if sim_balance is not None:
                    existing.sim_balance = sim_balance
                if not existing.dsm_id:
                    existing.dsm_id = dsm_obj.id
                db.add(existing)
                updated_pos += 1
            else:
                # Les POS reels n'ont pas de dates formelles, on utilise des dates par defaut
                today = date.today()
                pos = POS(
                    partner_id=partner_id,
                    dsm_id=dsm_obj.id,
                    code_pos=pos_code,
                    name=pos_code,
                    org_id=org_id,
                    color_code=color_code,
                    sim_balance=sim_balance,
                    type_pos=TypePos.NOUVEAU,
                    status=StatutPos.ACTIF,
                    stock_initial=0,
                    stock_actuel=0,
                    date_creation=today,
                    date_expiration=today.replace(year=today.year + 1),
                )
                db.add(pos)
                created_pos += 1
        except Exception as exc:
            errors.append({"entity": "POS", "code_pos": pos_code, "error": str(exc)})'''

NEW2 = '''        try:
            # 1er regard : cache local du run (gere le cross-listing memoire) ;
            # 2e regard : base de donnees (gere la relance sur donnees preexistantes).
            existing = pos_cache.get(pos_code)
            if existing is None:
                existing = db.query(POS).filter(
                    POS.partner_id == partner_id, POS.code_pos == pos_code
                ).first()

            if existing:
                pos_cache[pos_code] = existing
                if org_id:
                    existing.org_id = org_id
                if color_code:
                    existing.color_code = color_code
                if sim_balance is not None:
                    existing.sim_balance = sim_balance
                if not existing.dsm_id:
                    existing.dsm_id = dsm_obj.id
                db.add(existing)
                updated_pos += 1
            else:
                # Les POS reels n'ont pas de dates formelles, on utilise des dates par defaut
                today = date.today()
                pos = POS(
                    partner_id=partner_id,
                    dsm_id=dsm_obj.id,
                    code_pos=pos_code,
                    name=pos_code,
                    org_id=org_id,
                    color_code=color_code,
                    sim_balance=sim_balance,
                    type_pos=TypePos.NOUVEAU,
                    status=StatutPos.ACTIF,
                    stock_initial=0,
                    stock_actuel=0,
                    date_creation=today,
                    date_expiration=today.replace(year=today.year + 1),
                )
                db.add(pos)
                db.flush()  # rend le POS visible aux requetes suivantes du run
                pos_cache[pos_code] = pos
                created_pos += 1
        except Exception as exc:
            errors.append({"entity": "POS", "code_pos": pos_code, "error": str(exc)})'''

assert src.count(OLD1) == 1, f"OLD1 matches={src.count(OLD1)}"
assert src.count(OLD2) == 1, f"OLD2 matches={src.count(OLD2)}"
src = src.replace(OLD1, NEW1)
src = src.replace(OLD2, NEW2)
# Write back preserving CRLF line endings (consistent with the repo).
with open(PATH, "w", encoding="utf-8", newline="\r\n") as f:
    f.write(src)
py_compile.compile(PATH, doraise=True)
print("DONE + SYNTAX OK")





