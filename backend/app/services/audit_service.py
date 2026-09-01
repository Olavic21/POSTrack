"""Ecriture centralisee du journal d'audit (F-08).

Supporte la traçabilité complète des changements :
- Ancienne/valeur nouvelle
- Ancienne/nouvelle règle
- Utilisateur, Date, Action
- Motif de modification
"""
from sqlalchemy.orm import Session

from app.models.audit import AuditLog


def log_action(
    db: Session,
    *,
    user_id: int | None,
    partner_id: int | None,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    details: str | None = None,
    dsm_id: int | None = None,
    period_id: int | None = None,
    old_value: str | None = None,
    new_value: str | None = None,
    old_rule: str | None = None,
    new_rule: str | None = None,
    reason: str | None = None,
) -> AuditLog:
    """Ecrit une entrée d'audit avec traçabilité complète."""
    entry = AuditLog(
        user_id=user_id,
        partner_id=partner_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        dsm_id=dsm_id,
        period_id=period_id,
        old_value=old_value,
        new_value=new_value,
        old_rule=old_rule,
        new_rule=new_rule,
        reason=reason,
        details=details,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
