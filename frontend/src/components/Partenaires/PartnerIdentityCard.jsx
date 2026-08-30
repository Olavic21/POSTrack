import { useMemo } from 'react'

export const NOT_PROVIDED = 'Non renseigné'

export function displayValue(value) {
  if (value === null || value === undefined) return NOT_PROVIDED
  if (typeof value === 'string' && value.trim() === '') return NOT_PROVIDED
  return value
}

function initials(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '—'
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('')
}

function formatDate(value) {
  if (!value) return NOT_PROVIDED
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return NOT_PROVIDED
  return d.toLocaleDateString('fr-FR')
}

export function displayUserId(userId, username) {
  if (!userId && !username) return NOT_PROVIDED
  if (!userId) return NOT_PROVIDED
  return username ? `#${userId} (${username})` : `#${userId}`
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-gradient-to-br from-slate-50/60 to-white p-3.5">
      <div className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-brand-500">{title}</div>
      <div className="grid gap-3 sm:grid-cols-3">{children}</div>
    </div>
  )
}

/**
 * Carte d'identité partenaire — design system polish.
 */
export default function PartnerIdentityCard({ identity, loading = false }) {
  const monogram = useMemo(() => initials(identity?.name), [identity?.name])

  if (loading) {
    return (
      <div className="card overflow-hidden" aria-busy="true">
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="skeleton h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-40 rounded" />
              <div className="skeleton h-3 w-28 rounded" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isActive = identity?.is_active

  return (
    <section className="card overflow-hidden">
      {/* Header */}
      <header className="glass flex flex-wrap items-center gap-4 border-b border-indigo-100/40 px-5 py-4">
        <div
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-brand text-base font-bold text-white shadow-lg shadow-indigo-500/20"
        >
          {monogram}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-extrabold text-slate-900">
            {displayValue(identity?.name)}
          </h2>
          <p className="text-sm text-slate-500">
            Code partenaire&nbsp;: <span className="font-mono font-semibold text-brand-600">{displayValue(identity?.code)}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              isActive ? 'bg-emerald-100 text-emerald-800 border border-emerald-200/60' : 'bg-red-100 text-red-800 border border-red-200/60'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {isActive === undefined || isActive === null ? NOT_PROVIDED : isActive ? 'ACTIF' : 'INACTIF'}
          </span>
          <span className="text-xs text-slate-400">Contrat : {formatDate(identity?.contract_start_date)}</span>
        </div>
      </header>

      <div className="space-y-3 p-4">
        <Section title="Responsable">
          <Field label="Nom" value={displayValue(identity?.responsable_name)} />
          <Field label="Contact" value={displayValue(identity?.responsable_contact)} />
          <Field label="Autre contact" value={displayUserId(identity?.responsable_user_id, identity?.responsable_username)} />
        </Section>

        <Section title="Commercial">
          <Field label="Nom" value={displayValue(identity?.commercial_name)} />
          <Field label="Contact" value={displayValue(identity?.commercial_contact)} />
          <Field label="Autre contact du commercial" value={displayUserId(identity?.commercial_user_id, identity?.commercial_username)} />
        </Section>

        <Section title="Master SIM">
          <Field label="Master SIM prise en portefeuille" value={displayValue(identity?.master_sim_number)} />
          <Field label="Adresse" value={displayValue(identity?.address)} />
          <Field label="Créé le" value={formatDate(identity?.created_at)} />
        </Section>

        {/* Counters */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['Micro-zones', identity?.nb_micro_zones, 'bg-sky-50/80 border-sky-100'],
            ['POS créés', identity?.nb_pos_crees, 'bg-indigo-50/80 border-indigo-100'],
            ['POS actifs', identity?.nb_pos_actifs, 'bg-emerald-50/80 border-emerald-100'],
            ['BTS', identity?.nb_bts, 'bg-amber-50/80 border-amber-100'],
          ].map(([label, value, cls]) => (
            <div key={label} className={`rounded-xl border p-3 text-center transition-colors duration-200 hover:shadow-sm ${cls}`}>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
              <div className="mt-1 text-xl font-extrabold text-slate-900">
                {loading ? '…' : typeof value === 'number' ? value : NOT_PROVIDED}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
