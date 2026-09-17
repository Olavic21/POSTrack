// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import partenaireService from '../services/partenaireService'
import PageHeader from '../components/Common/PageHeader/PageHeader'
import SearchFilterBar from '../components/Common/SearchFilterBar/SearchFilterBar'
import DataTable from '../components/Common/DataTable/DataTable'
import Pagination from '../components/Common/Pagination/Pagination'
import StatusPill from '../components/Common/StatusPill/StatusPill'
import ExportButtons from '../components/Common/ExportButtons/ExportButtons'
import Button from '../components/Common/Button/Button'

type Partenaire = {
  id: number
  code: string | null
  nom: string
  adresse: string | null
  responsable: string | null
  responsable_contact: string | null
  responsable_user_id: number | null
  commercial: string | null
  commercial_contact: string | null
  commercial_user_id: number | null
  master_sim_number: string | null
  contract_start_date: string | Date | null
  created_at: string | null
  pos_count: number
  statut: 'actif' | 'inactif' | string
}

type PartenairePayload = {
  id?: number
  name?: string
  nom?: string
  code?: string
  address?: string | null
  adresse?: string | null
  is_active?: boolean
  responsable_name?: string | null
  responsable_contact?: string | null
  responsable_user_id?: number | null
  commercial_name?: string | null
  commercial_contact?: string | null
  commercial_user_id?: number | null
  master_sim_number?: string | null
  contract_start_date?: string | Date | null
  created_at?: string
  pos_count?: number | null
}

const PAGE_SIZE = 20

const frDate = (value: string | Date | null) =>
  value ? new Date(value).toLocaleDateString('fr-FR') : '—'

const toSafeLower = (value: unknown) =>
  typeof value === 'string' ? value.toLowerCase() : String(value ?? '').toLowerCase()

/** Cellule « contact » : nom + téléphone en sous-ligne. */
const contactCell = (name: string | null, contact: string | null) => (
  <div className="min-w-0">
    <div className="font-medium text-slate-800">{name || 'Non renseigné'}</div>
    {contact ? <div className="text-xs text-slate-400">{contact}</div> : null}
  </div>
)

export default function PartenairesListPage() {
  const navigate = useNavigate()
  const [partenaires, setPartenaires] = useState<Partenaire[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const fetchPartenaires = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const response = await partenaireService.getAll({ limit: 500 })
      const raw = response.data?.items || response.data?.data || response.data || []
      const list = Array.isArray(raw) ? (raw as PartenairePayload[]) : []
      const data = list
        .filter((p): p is PartenairePayload & { id: number } => !!p && typeof p.id === 'number')
        .map((p) => ({
          id: p.id,
          code: p.code ?? null,
          nom: p.nom || p.name || `Partenaire #${p.id}`,
          adresse: p.adresse ?? p.address ?? null,
          responsable: p.responsable_name ?? null,
          responsable_contact: p.responsable_contact ?? null,
          responsable_user_id: p.responsable_user_id ?? null,
          commercial: p.commercial_name ?? null,
          commercial_contact: p.commercial_contact ?? null,
          commercial_user_id: p.commercial_user_id ?? null,
          master_sim_number: p.master_sim_number ?? null,
          contract_start_date: p.contract_start_date ?? null,
          created_at: p.created_at ?? null,
          pos_count: p.pos_count ?? 0,
          statut: p.is_active === false ? 'inactif' : 'actif',
        }))
      setPartenaires(data)
    } catch (err) {
      const apiError = err as { response?: { data?: { detail?: string } }; message?: string }
      setError(
        apiError?.response?.data?.detail ||
          apiError?.message ||
          'Impossible de charger les partenaires.',
      )
      setPartenaires([])
    } finally {
      setLoading(false)
    }
  }, [])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void fetchPartenaires()
  }, [fetchPartenaires])
  /* eslint-enable react-hooks/set-state-in-effect */

  const filtered = useMemo(() => {
    const needle = toSafeLower(searchTerm)
    return partenaires.filter((p) => {
      const matchesSearch =
        !needle ||
        toSafeLower(p.nom).includes(needle) ||
        toSafeLower(p.code).includes(needle) ||
        toSafeLower(p.responsable).includes(needle) ||
        toSafeLower(p.commercial).includes(needle)
      const matchesStatus = statusFilter ? p.statut === statusFilter : true
      return matchesSearch && matchesStatus
    })
  }, [partenaires, searchTerm, statusFilter])

  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  )

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setPage(1)
  }, [searchTerm, statusFilter])
  /* eslint-enable react-hooks/set-state-in-effect */

  const resetFilters = () => {
    setSearchTerm('')
    setStatusFilter('')
    setPage(1)
  }

  const activeFilters = [
    ...(searchTerm
      ? [{ label: `Recherche : « ${searchTerm} »`, onRemove: () => setSearchTerm('') }]
      : []),
    ...(statusFilter
      ? [{ label: `Statut : ${statusFilter}`, onRemove: () => setStatusFilter('') }]
      : []),
  ]

  const EXPORT_COLUMNS = [
    { label: 'Code', value: 'code' },
    { label: 'Nom', value: 'nom' },
    { label: 'Adresse', value: 'adresse' },
    { label: 'Responsable', value: 'responsable' },
    { label: 'Contact responsable', value: 'responsable_contact' },
    { label: 'Commercial', value: 'commercial' },
    { label: 'Contact commercial', value: 'commercial_contact' },
    { label: 'MasterSIM', value: 'master_sim_number' },
    {
      label: 'Début du contrat',
      value: (p: Partenaire) =>
        p.contract_start_date ? new Date(p.contract_start_date).toLocaleDateString('fr-FR') : '',
    },
    { label: 'Nombre de POS', value: 'pos_count' },
    { label: 'Statut', value: 'statut' },
  ]

  /** Colonnes affichées — métadonnées administratives masquées < xl (export détaillé). */
  const columns = [
    {
      key: 'code',
      header: 'Code',
      sortValue: (p: Partenaire) => p.code ?? '',
      render: (p: Partenaire) => (
        <span className="font-mono font-semibold text-brand-600">{p.code || '—'}</span>
      ),
    },
    {
      key: 'nom',
      header: 'Nom',
      sortValue: (p: Partenaire) => p.nom,
      render: (p: Partenaire) => <span className="font-semibold text-slate-900">{p.nom}</span>,
    },
    {
      key: 'responsable',
      header: 'Responsable',
      responsive: 'hidden lg:table-cell',
      sortValue: (p: Partenaire) => p.responsable ?? '',
      render: (p: Partenaire) => contactCell(p.responsable, p.responsable_contact),
    },
    {
      key: 'commercial',
      header: 'Commercial',
      responsive: 'hidden lg:table-cell',
      sortValue: (p: Partenaire) => p.commercial ?? '',
      render: (p: Partenaire) => contactCell(p.commercial, p.commercial_contact),
    },
    {
      key: 'adresse',
      header: 'Adresse',
      responsive: 'hidden xl:table-cell',
      render: (p: Partenaire) => p.adresse || '—',
    },
    {
      key: 'master_sim_number',
      header: 'MasterSIM',
      responsive: 'hidden xl:table-cell',
      render: (p: Partenaire) => <span className="font-mono text-xs">{p.master_sim_number || '—'}</span>,
    },
    {
      key: 'contract_start_date',
      header: 'Contrat',
      responsive: 'hidden xl:table-cell',
      sortValue: (p: Partenaire) => (p.contract_start_date ? String(p.contract_start_date) : ''),
      render: (p: Partenaire) => frDate(p.contract_start_date),
    },
    {
      key: 'pos_count',
      header: 'POS',
      align: 'right' as const,
      sortValue: (p: Partenaire) => p.pos_count ?? 0,
      render: (p: Partenaire) => <span className="font-semibold tabular-nums">{p.pos_count}</span>,
    },
    {
      key: 'statut',
      header: 'Statut',
      render: (p: Partenaire) => <StatusPill status={p.statut} />,
    },
    {
      key: 'created_at',
      header: 'Créé le',
      responsive: 'hidden xl:table-cell',
      render: (p: Partenaire) => frDate(p.created_at),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: () => (
        <button
          type="button"
          onClick={() => navigate('/partenaires/new')}
          className="font-medium text-brand-600 transition-colors hover:text-brand-800"
        >
          Modifier
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Liste des Partenaires"
        subtitle="Identité, encadrement (responsable / commercial), contrats et portefeuille POS."
        actions={
          <Button variant="primary" onClick={() => navigate('/partenaires/new')}>
            + Nouveau Partenaire
          </Button>
        }
      />

      <SearchFilterBar
        search={searchTerm}
        onSearchChange={(v) => setSearchTerm(v)}
        searchPlaceholder="Rechercher (nom, code, responsable, commercial)…"
        filters={[
          {
            key: 'statut',
            label: 'Statut : tous',
            value: statusFilter,
            options: [
              { value: 'actif', label: 'Actif' },
              { value: 'inactif', label: 'Inactif' },
            ],
            onChange: (v: string) => setStatusFilter(v),
          },
        ]}
        activeFilters={activeFilters}
        onReset={resetFilters}
        resultCount={filtered.length}
        actions={
          <ExportButtons
            rows={filtered}
            columns={EXPORT_COLUMNS}
            fileName="partenaires"
            title="Gestion des Partenaires"
            disabled={loading}
          />
        }
      />

      <div className="card overflow-hidden">
        <DataTable
          columns={columns}
          rows={paged}
          loading={loading}
          error={error || null}
          onRetry={() => fetchPartenaires()}
          rowKey="id"
          emptyTitle="Aucun partenaire"
          emptyMessage="Aucun partenaire enregistré pour le moment."
          emptyActionLabel="+ Nouveau Partenaire"
          onEmptyAction={() => navigate('/partenaires/new')}
        />
        <div className="card-footer">
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={filtered.length}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  )
}