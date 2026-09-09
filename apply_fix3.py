import py_compile

PATH = r"c:/Users/HP/Desktop/POSTrack/backend/app/services/odi_import_service.py"

with open(PATH, encoding="utf-8") as f:
    src = f.read()

OLD3 = '''        # Trouver le DSM parent
        dsm_obj = dsm_map.get(parent_dsm)
        if not dsm_obj:
            errors.append({
                "entity": "POS",
                "code_pos": pos_code,
                "error": f"DSM parent '{parent_dsm}' introuvable.",
            })
            continue'''

NEW3 = '''        # Trouver le DSM parent
        dsm_obj = dsm_map.get(parent_dsm)
        if not dsm_obj:
            # DSM parent absent du niveau 5 (donnee source incomplete, ex.
            # DSM4 pour la zone LT3) : on le cree en placeholder afin de ne
            # pas perdre les POS associees. Re-lanceable : un eventuel DSM
            # deja present en base est reutilise.
            dsm_obj = db.query(DSM).filter(
                DSM.partner_id == partner_id, DSM.matricule == parent_dsm
            ).first()
            if not dsm_obj:
                dsm_obj = DSM(
                    partner_id=partner_id,
                    matricule=parent_dsm,
                    full_name=parent_dsm,  # nom par defaut = matricule
                )
                db.add(dsm_obj)
                db.flush()  # recuperer l'ID du placeholder
            dsm_map[parent_dsm] = dsm_obj'''

assert src.count(OLD3) == 1, f"OLD3 matches={src.count(OLD3)}"
src = src.replace(OLD3, NEW3)
with open(PATH, "w", encoding="utf-8", newline="\r\n") as f:
    f.write(src)
py_compile.compile(PATH, doraise=True)
print("DONE + SYNTAX OK")
