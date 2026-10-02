import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import posService from '../../services/posService'
import usePartner from '../../hooks/usePartner'
import { dsmService } from '../../services/dsmService'
import Alert from '../../components/Common/Alert/Alert'
import Button from '../../components/Common/Button/Button'
import PageHeader from '../../components/Common/PageHeader/PageHeader'

const todayIso = () => new Date().toISOString().slice(0, 10)
const nextYearIso = () => {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

function ZoningBadge({ zoning }) {
  if (!zoning) return null
  const map = {
    VERT: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    ORANGE: 'bg-amber-100 text-amber-800 border-amber-200',
    ROUGE: 'bg-red-100 text-red-800 border-red-200',
    INCONNU: 'bg-slate-100 text-slate-600 border-slate-200',
  }
  const dot = { VERT: '🟢', ORANGE: '🟠', ROUGE: '🔴', INCONNU: '⚪' }
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${map[zoning.status] || map.INCONNU}`}>
      <span>{dot[zoning.status] || '⚪'}</span>
      <span>{zoning.status}</span>
      {zoning.micro_zone ? <span className="font-normal">· {zoning.micro_zone}</span> : null}
      {zoning.partner_name && zoning.status === 'ROUGE' ? <span className="font-normal">· {zoning.partner_name}</span> : null}
    </div>
  )
}

export default function POSCreatePage() {
  const navigate = useNavigate()
  const { partnerContextId, partner } = usePartner()
  const [dsms, setDsms] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [zoning, setZoning] = useState(null)
  const [zoningLoading, setZoningLoading] = useState(false)

  const [form, setForm] = useState({
    code_pos: '',
    name: '',
    address: '',
    zone: '',
    latitude: '',
    longitude: '',
    dsm_id: '',
    date_creation: todayIso(),
    date_expiration: nextYearIso(),
    stock_initial: '0',
  })
  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => {
    let mounted = true
    const fetchDsms = async () => {
      try {
        const res = await dsmService.getAll({ limit: 500 })
        const items = res.data?.items ?? res.data ?? []
        if (mounted) setDsms(Array.isArray(items) ? items : [])
      } catch { if (mounted) setDsms([]) }
    }
    void fetchDsms()
    return () => { mounted = false }
  }, [partnerContextId])

  const fetchZoning = useCallback(async () => {
    const lat = parseFloat(form.latitude)
    const lon = parseFloat(form.longitude)
    if (Number.isNaN(lat) || Number.isNaN(lon)) { setZoning(null); return }
    const dsmId = form.dsm_id ? Number(form.dsm_id) : null
    try {
      setZoningLoading(true)
      const params = { latitude: lat, longitude: lon }
      if (dsmId) params.dsm_id = dsmId
      if (form.zone) params.zone = form.zone
      const res = await api.get('/pos/zoning/preview', { params })
      setZoning(res.data)
    } catch { setZoning(null) }
    finally { setZoningLoading(false) }
  }, [form.latitude, form.longitude, form.dsm_id, form.zone])

  useEffect(() => {
    const t = setTimeout(() => { void fetchZoning() }, 400)
    return () => clearTimeout(t)
  }, [fetchZoning])

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const validate = () => {
    const errs = {}
    if (!form.code_pos.trim()) errs.code_pos = 'Le code POS est obligatoire.'
    if (!form.name.trim()) errs.name = 'Le nom du POS est obligatoire.'
    if (!form.dsm_id) errs.dsm_id = 'Sélectionnez un DSM.'
    if (!form.date_creation) errs.date_creation = 'Date de prise en portefeuille requise.'
    if (!form.date_expiration) errs.date_expiration = "Date d'expiration requise."
    if (form.date_creation && form.date_expiration && form.date_expiration <= form.date_creation) errs.date_expiration = "L'expiration doit être après la création."
    if (form.latitude !== '' && Number.isNaN(Number(form.latitude))) errs.latitude = 'Latitude invalide.'
    if (form.longitude !== '' && Number.isNaN(Number(form.longitude))) errs.longitude = 'Longitude invalide.'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    if (!partnerContextId) { setError('Aucun partenaire sélectionné.'); return }
    setLoading(true)
    setError('')
    try {
      const payload = {
        code_pos: form.code_pos.trim(),
        name: form.name.trim(),
        address: form.address.trim() || null,
        zone: form.zone.trim() || null,
        latitude: form.latitude === '' ? null : Number(form.latitude),
        longitude: form.longitude === '' ? null : Number(form.longitude),
        dsm_id: Number(form.dsm_id),
        date_creation: form.date_creation,
        date_expiration: form.date_expiration,
        stock_initial: form.stock_initial === '' ? 0 : Number(form.stock_initial),
      }
      await posService.create(payload)
      setSuccess('POS créé avec succès')
      setTimeout(() => navigate('/pos'), 700)
    } catch (err) {
      setError(err?.apiMessage || err?.response?.data?.detail || 'Erreur lors de la création. Vérifiez les champs.')
    } finally { setLoading(false) }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Nouveau POS"
        subtitle={partner ? `Partenaire actif : ${partner.nom || partner.name || `#${partnerContextId}`}` : 'Création d\'un point de vente rattaché au partenaire actif.'}
        breadcrumbs={['Espace partenaire', 'POS', 'Nouveau']}
      />

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}
      {success && <Alert type="success" message={success} />}

      <form onSubmit={handleSubmit} className="card card-body space-y-6" noValidate>
        {/* Identité */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Identité</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pos-code" className="label">Code POS *</label>
              <input id="pos-code" value={form.code_pos} onChange={(e) => update('code_pos', e.target.value)} className="input" placeholder="POS-001" />
              {fieldErrors.code_pos && <p className="mt-1 text-xs text-red-600">{fieldErrors.code_pos}</p>}
              <p className="mt-1 text-xs text-slate-400">Unique dans le périmètre du partenaire.</p>
            </div>
            <div>
              <label htmlFor="pos-name" className="label">Nom du POS *</label>
              <input id="pos-name" value={form.name} onChange={(e) => update('name', e.target.value)} className="input" placeholder="Ex. Kiosk Bépanda" />
              {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="pos-address" className="label">Adresse</label>
              <input id="pos-address" value={form.address} onChange={(e) => update('address', e.target.value)} className="input" placeholder="Rue, quartier, ville" />
            </div>
          </div>
        </section>

        {/* Rattachement */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Rattachement</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pos-dsm" className="label">DSM *</label>
              <select id="pos-dsm" value={form.dsm_id} onChange={(e) => update('dsm_id', e.target.value)} className="select">
                <option value="">Sélectionner un DSM…</option>
                {dsms.map((d) => <option key={d.id} value={String(d.id)}>{d.full_name || d.matricule} — {d.zone || '—'}</option>)}
              </select>
              {fieldErrors.dsm_id && <p className="mt-1 text-xs text-red-600">{fieldErrors.dsm_id}</p>}
            </div>
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-3 py-2.5">
              <p className="text-xs font-semibold text-indigo-700">Partenaire</p>
              <p className="text-sm font-medium text-slate-800">{partner?.nom || partner?.name || `Partenaire #${partnerContextId}`}</p>
              <p className="text-xs text-slate-500">Déterminé automatiquement par le contexte actif.</p>
            </div>
          </div>
        </section>

        {/* Localisation + zoning */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Localisation &amp; zoning</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="pos-zone" className="label">Micro-zone / Quartier</label>
              <input id="pos-zone" value={form.zone} onChange={(e) => update('zone', e.target.value)} className="input" placeholder="Ex. MZ 1, Akwa" />
            </div>
            <div>
              <label htmlFor="pos-lat" className="label">Latitude GPS</label>
              <input id="pos-lat" type="number" step="any" value={form.latitude} onChange={(e) => update('latitude', e.target.value)} className="input" placeholder="4.0511" />
              {fieldErrors.latitude && <p className="mt-1 text-xs text-red-600">{fieldErrors.latitude}</p>}
            </div>
            <div>
              <label htmlFor="pos-lon" className="label">Longitude GPS</label>
              <input id="pos-lon" type="number" step="any" value={form.longitude} onChange={(e) => update('longitude', e.target.value)} className="input" placeholder="9.7679" />
              {fieldErrors.longitude && <p className="mt-1 text-xs text-red-600">{fieldErrors.longitude}</p>}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Zoning automatique</p>
              {zoningLoading ? <span className="text-xs text-slate-400">Calcul…</span> : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {zoning ? <ZoningBadge zoning={zoning} /> : <span className="text-xs text-slate-400">Renseignez latitude/longitude et DSM pour voir le statut.</span>}
            </div>
            {zoning?.detail ? <p className="mt-2 text-xs text-slate-500">{zoning.detail}</p> : null}
            <ul className="mt-2 space-y-1 text-xs text-slate-500">
              <li>🟢 VERT — dans la micro-zone du DSM</li>
              <li>🟠 ORANGE — hors MZ DSM mais dans le territoire du partenaire (affiche la MZ trouvée)</li>
              <li>🔴 ROUGE — hors territoire (affiche le partenaire du territoire)</li>
            </ul>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
              <div className="rounded-lg bg-white border border-slate-200 px-3 py-2">
                <span className="font-semibold text-slate-600">Micro-zone détectée :</span> <span className="text-slate-800">{zoning?.micro_zone || '—'}</span>
              </div>
              <div className="rounded-lg bg-white border border-slate-200 px-3 py-2">
                <span className="font-semibold text-slate-600">Partenaire détecté :</span> <span className="text-slate-800">{zoning?.partner_name || '—'}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Dates & stock */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Cycle &amp; stock</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="pos-date-creation" className="label">Prise en portefeuille *</label>
              <input id="pos-date-creation" type="date" value={form.date_creation} onChange={(e) => update('date_creation', e.target.value)} className="input" />
              {fieldErrors.date_creation && <p className="mt-1 text-xs text-red-600">{fieldErrors.date_creation}</p>}
            </div>
            <div>
              <label htmlFor="pos-date-exp" className="label">Expiration *</label>
              <input id="pos-date-exp" type="date" value={form.date_expiration} onChange={(e) => update('date_expiration', e.target.value)} className="input" />
              {fieldErrors.date_expiration && <p className="mt-1 text-xs text-red-600">{fieldErrors.date_expiration}</p>}
            </div>
            <div>
              <label htmlFor="pos-stock" className="label">Stock initial</label>
              <input id="pos-stock" type="number" min="0" value={form.stock_initial} onChange={(e) => update('stock_initial', e.target.value)} className="input" />
            </div>
          </div>
          <p className="text-xs text-slate-400">Le POS est créé en statut ACTIF, type NOUVEAU. Seule une reconduction peut le passer en RECONDUIT.</p>
        </section>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
          <Button variant="secondary" type="button" onClick={() => navigate('/pos')}>Annuler</Button>
          <Button variant="primary" type="submit" className={loading ? 'btn-loading' : undefined} aria-busy={loading} disabled={loading}>
            {loading ? 'Création…' : 'Créer le POS'}
          </Button>
        </div>
      </form>
    </div>
  )
}
