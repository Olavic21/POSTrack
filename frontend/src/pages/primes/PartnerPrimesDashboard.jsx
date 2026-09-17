import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import usePartner from '../../hooks/usePartner'
import primeService from '../../services/primeService'
import DSMPrimesTable from '../../components/Primes/DSMPrimesTable'
import PageHeader from '../../components/Common/PageHeader/PageHeader'
import KpiCard from '../../components/ui/KpiCard'

const formatCurrency = (v) => {
  if (v === null || v === undefined) return '—'
  return `${new Intl.NumberFormat('fr-FR').format(Number(v))} FCFA`
}
const formatPct = (v) => {
  if (v === null || v === undefined || isNaN(Number(v))) return '—'
  return `${Number(v).toFixed(1)}%`
}
const formatInt = (v) => {
  if (v === null || v === undefined) return '0'
  return new Intl.NumberFormat('fr-FR').format(v)
}

export default function PartnerPrimesDashboard() {
  const navigate = useNavigate()
  const { partnerContextId, partner } = usePartner()
  const [periods, setPeriods] = useState([])
  const [selectedPeriod, setSelectedPeriod] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loadingPeriods, setLoadingPeriods] = useState(true)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const partnerName = partner?.nom ?? partner?.name ?? partner?.code_partenaire ?? ''

  useEffect(() => {
    if (!partnerContextId) return
    let ignore = false
    const load = async () => {
      try {
        setLoadingPeriods(true)
        const res = await primeService.getPeriods(partnerContextId)
        const data = res.data?.items ?? res.data ?? []
        const arr = Array.isArray(data) ? data : []
        if (!ignore) {
          setPeriods(arr)
          const open = arr.find((p) => p.status === 'OPEN') ?? arr[0] ?? null
          if (open) setSelectedPeriod(open)
        }
      } catch {
        if (!ignore) setPeriods([])
      } finally {
        if (!ignore) setLoadingPeriods(false)
      }
    }
    void load()
    return () => { ignore = true }
  }, [partnerContextId])

  useEffect(() => {
    if (!partnerContextId || !selectedPeriod) {
      setSummary(null)
      return
    }
    let ignore = false
    const load = async () => {
      try {
        setLoadingSummary(true)
        const res = await primeService.getDsmPrimeSummary(partnerContextId, selectedPeriod.id)
        if (!ignore) setSummary(res.data)
      } catch {
        if (!ignore) setSummary(null)
      } finally {
        if (!ignore) setLoadingSummary(false)
      }
    }
    void load()
    return () => { ignore = true }
  }, [partnerContextId, selectedPeriod])

  const handleCalculate = async () => {
    if (!selectedPeriod) return
    setCalculating(true)
    try {
      await primeService.calculateDsmPrimes(partnerContextId, selectedPeriod.id)
      const res = await primeService.getDsmPrimeSummary(partnerContextId, selectedPeriod.id)
      setSummary(res.data)
    } catch (err) {
      alert(err?.response?.data?.detail || 'Erreur lors du calcul des primes.')
    } finally {
      setCalculating(false)
    }
  }

  const handleDsmClick = (dsmId) => {
    if (!selectedPeriod) return
    navigate(`/primes/dsm/${dsmId}?periodId=${selectedPeriod.id}`)
  }

  const kpi = useMemo(() => {
    if (!summary) return null
    const primed = summary.by_dsm?.filter(r=> Number(r.total_prime_amount||0) > 0).length ?? 0
    return {
      qtyCount: summary.quantity_qualified_dsm_count ?? 0,
      revCount: summary.revenue_qualified_dsm_count ?? 0,
      doubleCount: summary.double_qualified_dsm_count ?? 0,
      primedCount: primed,
      total: summary.dsm_count ?? 0,
    }
  }, [summary])

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Primes DSM`}
        subtitle={selectedPeriod ? `${selectedPeriod.label ?? selectedPeriod.code} • ${selectedPeriod.code} • ${selectedPeriod.status} • ${selectedPeriod.start_date ?? ''} → ${selectedPeriod.end_date ?? ''}` : 'Sélectionnez une période'}
        eyebrow={partnerName ? `Partenaire ${partnerName}` : 'Espace primes'}
        breadcrumbs={['Espace partenaire', 'Primes DSM']}
        actions={
          selectedPeriod ? (
            <button
              type="button"
              onClick={handleCalculate}
              disabled={calculating || selectedPeriod.status !== 'OPEN'}
              className="btn btn-primary"
            >
              {calculating ? 'Calcul…' : 'Recalculer les primes'}
            </button>
          ) : null
        }
      />

      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">Période de prime</p>
          <p className="text-xs text-slate-500">Sélectionnez la période à analyser</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedPeriod?.id || ''}
            onChange={(e) => {
              const p = periods.find((pp) => pp.id === Number(e.target.value))
              setSelectedPeriod(p || null)
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm"
            disabled={loadingPeriods}
          >
            <option value="">— Sélectionner —</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>{p.code} — {p.label} ({p.status})</option>
            ))}
          </select>
        </div>
      </div>
      {selectedPeriod?.status !== 'OPEN' && selectedPeriod && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800">Seules les périodes ouvertes peuvent être recalculées.</div>
      )}

      {selectedPeriod && summary && !loadingSummary && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <p className="kpi-label text-indigo-600">Performance création</p>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-slate-500">Objectif global</span><span className="font-bold">{formatInt(summary.global_creation_target)} POS</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Réalisé</span><span className="font-bold text-indigo-700">{formatInt(summary.global_creation_realized)} POS</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Taux</span><span className="font-extrabold text-indigo-700">{formatPct(summary.global_creation_achievement_pct)}</span></div>
                <div className="progress-track mt-2"><div className="progress-fill bg-indigo-500" style={{ width: `${Math.min(100, summary.global_creation_achievement_pct ?? 0)}%` }} /></div>
              </div>
            </div>
            <div className="card p-5">
              <p className="kpi-label text-emerald-600">Performance revenus</p>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-slate-500">Objectif global</span><span className="font-bold">{formatCurrency(summary.global_revenue_target)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Réalisé</span><span className="font-bold text-emerald-700">{formatCurrency(summary.global_revenue_realized)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Taux</span><span className="font-extrabold text-emerald-700">{formatPct(summary.global_revenue_achievement_pct)}</span></div>
                <div className="progress-track mt-2"><div className="progress-fill bg-emerald-500" style={{ width: `${Math.min(100, summary.global_revenue_achievement_pct ?? 0)}%` }} /></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <KpiCard label="Création ≥75%" value={`${kpi?.qtyCount ?? 0} / ${kpi?.total ?? 0}`} sublabel="≥1,5 → 2 POS" tone="info" />
            <KpiCard label="Revenus ≥75%" value={`${kpi?.revCount ?? 0} / ${kpi?.total ?? 0}`} sublabel="≥375 000 FCFA" tone="warning" />
            <KpiCard label="Double critère" value={`${kpi?.doubleCount ?? 0} / ${kpi?.total ?? 0}`} sublabel="Les deux ≥75%" tone="success" />
            <KpiCard label="DSM primés" value={`${kpi?.primedCount ?? 0} / ${kpi?.total ?? 0}`} sublabel="Prime > 0" tone="brand" />
          </div>

          <div className="card overflow-hidden border-2 border-indigo-200">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 text-white flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold tracking-tight">Primes à distribuer — {selectedPeriod.label ?? selectedPeriod.code}</p>
                <p className="text-xs text-indigo-100">{summary.dsm_count} DSM concernés</p>
              </div>
              <p className="text-2xl font-extrabold">{formatCurrency(summary.total_prime ?? (Number(summary.total_creation_prime||0)+Number(summary.total_revenue_prime||0)))}</p>
            </div>
            <div className="grid grid-cols-1 gap-0 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
              <div className="p-5 bg-slate-50/50">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Revenus première recharge</p>
                <p className="mt-1 text-lg font-extrabold text-slate-900">{formatCurrency(summary.global_revenue_realized)}</p>
              </div>
              <div className="p-5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-600">Prime création</p>
                <p className="mt-1 text-lg font-extrabold text-indigo-700">{formatCurrency(summary.total_creation_prime)}</p>
              </div>
              <div className="p-5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">Prime revenus</p>
                <p className="mt-1 text-lg font-extrabold text-emerald-700">{formatCurrency(summary.total_revenue_prime)}</p>
              </div>
            </div>
          </div>

          <DSMPrimesTable data={summary} onDsmClick={handleDsmClick} />
        </>
      )}

      {selectedPeriod && loadingSummary && (
        <div className="card p-10 text-center"><div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" /><p className="mt-3 text-sm text-slate-400">Chargement synthèse…</p></div>
      )}

      {!selectedPeriod && !loadingPeriods && (
        <div className="card p-8 text-center">
          <p className="text-sm font-semibold text-slate-700">Sélectionnez une période pour afficher les primes</p>
          <p className="mt-1 text-xs text-slate-500">Les données sont isolées par partenaire et par période.</p>
        </div>
      )}
    </div>
  )
}
