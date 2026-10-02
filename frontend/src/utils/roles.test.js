import { describe, expect, it } from 'vitest'
import { ROLES } from './constants'
import { filterNavByRole, getRoleLabel, hasRole, normalizeRole } from './roles'
import { NAV_ITEMS } from './constants'

describe('roles — matrice A2', () => {
  it('normalise les alias backend vers les rôles cibles', () => {
    expect(normalizeRole('PARTENAIRE')).toBe(ROLES.MANAGER)
    expect(normalizeRole('DSM')).toBe(ROLES.CHEF_OPERATIONNEL)
    expect(normalizeRole('POS_HOLDER')).toBe(ROLES.OPERATIONNEL)
    expect(normalizeRole('ADMIN')).toBe(ROLES.ADMIN)
  })

  it('hasRole accepte les rôles cibles et les alias', () => {
    expect(hasRole({ role: 'MANAGER' }, [ROLES.MANAGER])).toBe(true)
    expect(hasRole({ role: 'OPERATIONNEL' }, [ROLES.ADMIN])).toBe(false)
    expect(hasRole({ role: 'ADMIN' }, ROLES.ADMIN ? [ROLES.ADMIN] : [])).toBe(true)
  })

  it('fournit un libellé métier', () => {
    expect(getRoleLabel('DSM')).toBe('Chef opérationnel')
    expect(getRoleLabel('ADMIN')).toBe('Administrateur')
  })

  it('filtre la navigation : ADMIN voit Partenaires et Audit', () => {
    const items = filterNavByRole(NAV_ITEMS, { role: 'ADMIN' })
    const ids = items.map((i) => i.id)
    expect(ids).toContain('partenaires')
    expect(ids).toContain('audit')
    expect(ids).toContain('import-export')
  })

  it('filtre la navigation : OPERATIONNEL n’a pas Partenaires / Audit', () => {
    const items = filterNavByRole(NAV_ITEMS, { role: 'OPERATIONNEL' })
    const ids = items.map((i) => i.id)
    expect(ids).toContain('pos')
    expect(ids).toContain('dsm')
    expect(ids).toContain('bts')
    expect(ids).toContain('requetes')
    expect(ids).not.toContain('sims')
    expect(ids).not.toContain('dashboard')
    expect(ids).not.toContain('partenaires')
    expect(ids).not.toContain('primes')
    expect(ids).not.toContain('import-export')
    expect(ids).not.toContain('audit')
  })

  it('filtre la navigation : Représentant DSM voit POS et Requêtes, pas Import', () => {
    const items = filterNavByRole(NAV_ITEMS, { role: 'DSM' })
    const ids = items.map((i) => i.id)
    expect(ids).toContain('pos')
    expect(ids).toContain('requetes')
    expect(ids).toContain('bts')
    expect(ids).toContain('dsm')
    expect(ids).not.toContain('sims')
    expect(ids).not.toContain('import-export')
    expect(ids).not.toContain('partenaires')
    expect(ids).not.toContain('audit')
  })
})
