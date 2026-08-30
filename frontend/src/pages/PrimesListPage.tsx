import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import ExportButtons from '../components/Common/ExportButtons/ExportButtons'
import PageHeader from '../components/Common/PageHeader/PageHeader'
import DataTable from '../components/Common/DataTable/DataTable'
import StatusPill from '../components/Common/StatusPill/StatusPill'
import Button from '../components/Common/Button/Button'

type Prime = {
  id: number
  montant: number | string
  // Backend : champ "status" (+ anciennement "statut" selon les versions)
  status?: string
  statut?: string
  // Backend : "created_at" ; "date_attribution" conservé par compatibilité
  created_at?: string
  date_attribution?: string
  pos_id?: number
  pos?: { code_pos?: string; nom?: string; partenaire?: { nom?: string } }
  partenaire?: { nom?: string }
  // Champs d'affichage enrichis côté backend (prime_service.list_primes)
  pos_code?: string
  pos_nom?: string
  partner_name?: string
  period_code?: string
  commentaire?: string | null
}

type PrimeFilters = {
  search: string
  status: string
  period: string
  partner: string
}

function PrimesListPage() {
  const navigate = useNavigate()
  const [primes, setPrimes] = useState<Prime[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<PrimeFilters>({
    search: '',
    status: '',
    period: '',
    partner: '',
  })

  useEffect(() => {
    let ignore = false
    const fetchPrimes = async () => {
      try {
        setLoading(true)
        const params: any = {}
        if (filters.search) params.search = filters.search
        if (filters.status) params.status = filters.status
        if (filters.period) params.period = filters.period
        if (filters.partner) params.partner = filters.partner
        
        const response = await api.get('/primes', { params })
        const data = response.data?.items ?? response.data?.data ?? response.data ?? []
        if (!ignore) setPrimes(Array.isArray(data) ? data : [])
      } catch {
        if (!ignore) setPrimes([])
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    void fetchPrimes()
    return () => { ignore = true }
  }, [filters])

  const statutLabel = (s?: string) => (s ?? '').toLowerCase().replace('_', ' ') || '—'

  // Options de filtre
  const statusOptions = ['TOUS', 'ACTIF', 'NON_TRAITE', 'EN_COURS', 'VALIDE'].map(v => ({ value: v, label: v }))
  const periodOptions = ['TOUT', 'JANVIER', 'FEVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUILLET', 'AOUT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DECEMBRE'].map(v => ({ value: v, label: v }))

  /** Colonnes du tableau / export — alignées sur PrimeOut (backend). */
  const EXPORT_COLUMNS = [
    { label: 'Réf.', value: 'id' },
    { label: 'POS', value: (p: Prime) => p.pos_nom ?? p.pos?.nom ?? '' },
    { label: 'Code POS', value: (p: Prime) => p.pos_code ?? p.pos?.code_pos ?? '' },
    { label: 'Partenaire', value: (p: Prime) => p.partner_name ?? p.partenaire?.nom ?? '' },
    { label: 'Montant (FCFA)', value: (p: Prime) => Number(p.montant) },
    { label: 'Statut', value: (p: Prime) => statutLabel(p.status ?? p.statut) },
    {
      label: 'Date',
      value: (p: Prime) => (p.created_at ?? p.date_attribution ?? '').slice(0, 10),
    },
    { label: 'Période', value: 'period_code' },
    { label: 'Commentaire', value: 'commentaire' },
  ]

  /** Colonnes affichées — métadonnées masquées sous les breakpoints. */
  const PRIME_COLUMNS = [
    {
      key: 'id',
      header: 'Réf.',
      sortValue: (p: Prime) => p.id,
      render: (p: Prime) => <span className="font-medium text-slate-500">#{p.id}</span>,
    },
    {
      key: 'pos',
      header: 'POS',
      render: (p: Prime) => (
        <div className="min-w-0">
          <div className="font-medium text-slate-900">
            {p.pos_nom ?? p.pos?.nom ?? (p.pos_id ? `POS #${p.pos_id}` : `POS #${p.id}`)}
          </div>
          {(p.pos_code ?? p.pos?.code_pos) && (
            <div className="text-xs text-slate-400">{p.pos_code ?? p.pos?.code_pos}</div>
          )}
        </div>
      ),
    },
    {
      key: 'partner',
      header: 'Partenaire',
      responsive: 'hidden md:table-cell',
      render: (p: Prime) => p.partner_name ?? p.partenaire?.nom ?? p.pos?.partenaire?.nom ?? '—',
    },
    {
      key: 'montant',
      header: 'Montant',
      align: 'right' as const,
      sortValue: (p: Prime) => Number(p.montant) || 0,
      render: (p: Prime) => (
        <span className="font-semibold tabular-nums">
          {Number(p.montant).toLocaleString('fr-FR')} FCFA
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Date / Période',
      render: (p: Prime) => (
        <div>
          {(p.created_at ?? p.date_attribution ?? '').slice(0, 10) || '—'}
          {p.period_code && <div className="text-xs text-slate-400">{p.period_code}</div>}
        </div>
      ),
    },
    {
      key: 'statut',
      header: 'Statut',
      render: (p: Prime) => <StatusPill status={statutLabel(p.status ?? p.statut)} />,
    },
    {
      key: 'commentaire',
      header: 'Commentaire',
      responsive: 'hidden xl:table-cell',
      render: (p: Prime) => p.commentaire ?? '—',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Primes"
        subtitle="Suivi des primes attribuées aux nouveaux POS."
        actions={
          <>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate('/primes/dsm')}>
              Primes DSM
            </Button>
            <Button variant="primary" onClick={() => navigate('/primes/new')}>
              + Nouvelle prime
            </Button>
          </div>
          {/* Filtres */}
          <div className="mt-2 flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Recherche..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm flex-1"
            />
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value }) }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— Statut —</option>
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={filters.period}
              onChange={(e) => setFilters({ ...filters, period: e.target.value }) }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— Période —</option>
              {periodOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={filters.partner}
              onChange={(e) => setFilters({ ...filters, partner: e.target.value }) }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— Partenaire —</option>
              <option value="">Tous</option>
            </select>
          </div>
          </>
        }
      />

      <div className="card overflow-hidden">
        <div className="card-header flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-semibold text-slate-700">
            {loading ? 'Chargement…' : `${primes.length} prime(s)`}
          </span>
          <ExportButtons
            rows={primes}
            columns={EXPORT_COLUMNS}
            fileName="primes"
            title="Suivi des primes"
            disabled={loading}
          />
        </div>
        <DataTable
          columns={PRIME_COLUMNS}
          rows={primes}
          loading={loading}
          rowKey="id"
          dense
          emptyTitle="Aucune prime"
          emptyMessage="Aucune prime enregistrée pour le moment."
          // Nouveau prop pour le filtrage côté client si besoin
          // (les filtres sont appliqués côté serveur via API)
        />
      </div>
    </div>
  )
}

export default PrimesListPage
