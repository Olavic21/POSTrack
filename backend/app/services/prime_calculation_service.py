"""
prime_calculation_service : LEGACY — calcul à montant fixe par POS.

⚠️  LEGACY / COMPATIBILITÉ : ce service historique (montant_fixe = 50 000 FCFA
par POS NOUVEAU, quote-part DSM 10 %) est conservé uniquement pour la
compatibilité avec les anciennes Prime/DSMCommission (status CALCULATED) et
pour la validation de primes unitaires (validate_prime). Le moteur de référence
pour les primes DSM est désormais dsm_prime_calculation_service (phase 3B) :
grille 75/95, taux 0,1/0,5 %, double critère quantité+revenus, montant =
taux × revenus réels. Le Dashboard doit afficher le montant 3B (DSMCommission
ELIGIBLE/NON_ELIGIBLE) lorsqu'une période OPEN existe, pas ce montant fixe.

Ne pas utiliser pour de nouveaux calculs DSM — utiliser
dsm_prime_calculation_service.calculate_dsm_primes_for_period.
"""
from decimal import Decimal
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError, ValidationErrorApp
from app.models.pos import POS, TypePos
from app.models.prime_period import PrimePeriod, StatutPeriode
from app.models.prime import Prime, StatutPrime
from app.models.dsm_commission import DSMCommission, StatutCommission
from app.services import audit_service


def calculate_primes_for_period(db: Session, *, partner_id: int, user_id: int,
                                 prime_period_id: int, montant_fixe: Decimal) -> dict:
    period = db.query(PrimePeriod).filter(
        PrimePeriod.id == prime_period_id, PrimePeriod.partner_id == partner_id
    ).first()
    if not period:
        raise NotFoundError("Periode de prime introuvable dans ce Partenaire.")
    if period.status != StatutPeriode.OPEN:
        raise ValidationErrorApp("La periode de prime doit etre OPEN pour lancer un calcul.")

    # POS Nouveau du partenaire, sans prime existante
    pos_sans_prime_ids = {
        p.id for p in db.query(POS).filter(
            POS.partner_id == partner_id, POS.type_pos == TypePos.NOUVEAU
        ).all()
    } - {p.pos_id for p in db.query(Prime).join(POS).filter(POS.partner_id == partner_id).all()}

    eligible_pos = db.query(POS).filter(POS.id.in_(pos_sans_prime_ids)).all() if pos_sans_prime_ids else []

    created_primes = []
    dsm_counts: dict[int, int] = {}
    for pos in eligible_pos:
        prime = Prime(
            pos_id=pos.id,
            prime_period_id=period.id,
            montant=montant_fixe,
            status=StatutPrime.EN_ATTENTE,
            demandeur_id=user_id,
        )
        db.add(prime)
        created_primes.append(prime)
        dsm_counts[pos.dsm_id] = dsm_counts.get(pos.dsm_id, 0) + 1

    db.commit()
    for prime in created_primes:
        db.refresh(prime)

    # Commissions DSM : une par DSM ayant au moins un POS eligible sur la periode
    commissions = []
    for dsm_id, count in dsm_counts.items():
        existing = db.query(DSMCommission).filter(
            DSMCommission.partner_id == partner_id,
            DSMCommission.dsm_id == dsm_id,
            DSMCommission.prime_period_id == period.id,
        ).first()
        amount = montant_fixe * count * Decimal("0.10")  # quote-part indicative 10%
        if existing:
            existing.eligible_pos_count = count
            existing.amount = amount
            existing.status = StatutCommission.CALCULATED
            db.add(existing)
            commissions.append(existing)
        else:
            commission = DSMCommission(
                partner_id=partner_id,
                dsm_id=dsm_id,
                prime_period_id=period.id,
                eligible_pos_count=count,
                amount=amount,
                status=StatutCommission.CALCULATED,
            )
            db.add(commission)
            commissions.append(commission)
    db.commit()
    for c in commissions:
        db.refresh(c)

    audit_service.log_action(
        db, user_id=user_id, partner_id=partner_id, action="PRIME_CALCULATE",
        entity_type="PRIME_PERIOD", entity_id=period.id,
        details=f"{len(created_primes)} prime(s) calculee(s), {len(commissions)} commission(s) DSM",
    )

    return {"primes": created_primes, "commissions": commissions, "period": period}


def validate_prime(db: Session, *, partner_id: int, user_id: int, prime_id: int, new_status: str, commentaire: str | None):
    from datetime import datetime, timezone

    prime = db.query(Prime).join(POS).filter(Prime.id == prime_id, POS.partner_id == partner_id).first()
    if not prime:
        raise NotFoundError("Prime introuvable dans ce Partenaire.")

    pos = db.query(POS).filter(POS.id == prime.pos_id).first()
    if pos.type_pos == TypePos.RECONDUIT and new_status == StatutPrime.VALIDEE.value:
        raise ConflictError("Un POS RECONDUIT ne peut pas voir sa prime de creation validee.")

    prime.status = new_status
    if commentaire:
        prime.commentaire = commentaire
    if new_status == StatutPrime.VALIDEE.value:
        prime.validated_by = user_id
        prime.validated_at = datetime.now(timezone.utc)
    db.add(prime)
    db.commit()
    db.refresh(prime)

    audit_service.log_action(
        db, user_id=user_id, partner_id=partner_id, action="PRIME_STATUS_UPDATE",
        entity_type="PRIME", entity_id=prime.id, details=f"Nouveau statut : {new_status}",
    )
    return prime
