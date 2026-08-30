import { useEffect, useState } from 'react'
import usePartner from '../../hooks/usePartner'
import primeService from '../../services/primeService'
import StatCard from '../../components/Dashboard/StatCard'
import DSMPrimesTable from '../../components/Primes/DSMPrimesTable'

const formatCurrency = (v) => {
  if (v === null || v === undefined) return '0 FCFA'
  return `${new Intl.NumberFormat('fr-FR').format(Number(v))} FCFA`
}

const formatPct = (v) => {
  if (v === null || v === undefined || isNaN(Number(v))) return '—'
  return `${Number(v).toFixed(1)} %`
}

export default function PartnerPrimesDashboard() {
  const { partnerContextId } = usePartner()
  const [periods, setPeriods] = useState([])
  const [selectedPeriod, setSelectedPeriod] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [filterStatus, setFilterStatus] = useState('TOUT')
  const [filterPartner, setFilterPartner] = useState('TOUT')

  useEffect(() => {
    if (!partnerContextId) return
    let ignore = false
    const load = async () => {
      try {
        const res = await primeService.getPeriods(partnerContextId)
        const data = res.data?.items ?? res.data ?? []
        if (!ignore) {
          setPeriods(Array.isArray(data) ? data : [])
          const openPeriod = (Array.isArray(data) ? data : []).find((p) => p.status === 'OPEN')
          if (openPeriod) setSelectedPeriod(openPeriod)
        }
      } catch {
        if (!ignore) setPeriods([])
      } finally {
        if (!ignore) setLoading(false)
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
        const res = await primeService.getDsmPrimeSummary(partnerContextId, selectedPeriod.id, { filterStatus, filterPartner })
        if (!ignore) setSummary(res.data)
      } catch {
        if (!ignore) setSummary(null)
      }
    }
    void load()
    return () => { ignore = true }
  }, [partnerContextId, selectedPeriod, filterStatus, filterPartner])

  const handleCalculate = async () => {
    if (!selectedPeriod) return
    setCalculating(true)
    try {
      await primeService.calculateDsmPrimes(partnerContextId, selectedPeriod.id, { filterStatus, filterPartner })
      const res = await primeService.getDsmPrimeSummary(partnerContextId, selectedPeriod.id, { filterStatus, filterPartner })
      setSummary(res.data)
    } catch (err) {
      alert(err?.response?.data?.detail || 'Erreur lors du calcul des primes.')
    } finally {
      setCalculating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Primes DSM</h1>
        <p className="mt-1 text-sm text-slate-500">
          Calcul automatique des primes création + revenus pour chaque DSM.
        </p>
      </div>

      {/* Period selector + filters */}
      <div className="card overflow-hidden animate-fade-in stagger-1">
        <div className="card-header flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Période de prime</h2>
            <p className="text-xs text-slate-500">Sélectionnez une période pour afficher les primes.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedPeriod?.id || ''}
              onChange={(e) => {
                const p = periods.find((pp) => pp.id === Number(e.target.value))
                setSelectedPeriod(p || null)
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— Sélectionner —</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>{p.code} — {p.label} ({p.status})</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="TOUT">Tous</option>
              <option value="CREATION">Création</option>
              <option value="REVENUS">Revenus</option>
              <option value="COMPLET">Total</option>
            </select>
            <select
              value={filterPartner}
              onChange={(e) => setFilterPartner(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="TOUT">Tous les DSM</option>
              <option value="PRIMÉ">DSM primés</option>
              <option value="NON_PRIMÉ">DSM non primés</option>
            </select>
          </div>
        </div>
        {selectedPeriod && (
          <div className="border-t border-slate-100 px-5 py-3 flex justify-end">
            <button
              type="button"
              onClick={handleCalculate}
              disabled={calculating || selectedPeriod.status !== 'OPEN'}
              className="btn btn-primary btn-sm"
            >
              {calculating ? 'Calcul en cours…' : 'Calculer les primes DSM'}
            </button>
          </div>
        )}
      </div>

      {/* KPI Summary */}
      {summary && (
        <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in stagger-2">
          <StatCard
            label="Prime Création"
            value={formatCurrency(summary.total_creation_prime)}
            loading={loading}
            accent="indigo"
            subtitle={`${formatPct(summary.global_creation_achievement_pct)} d'atteinte`}
          />
          <StatCard
            label="Prime Revenus"
            value={formatCurrency(summary.total_revenue_prime)}
            loading={loading}
            accent="green"
            subtitle={`${formatPct(summary.global_revenue_achievement_pct)} d'atteinte`}
          />
          <StatCard
            label="Prime Totale"
            value={formatCurrency(summary.total_prime)}
            loading={loading}
            accent="amber"
            subtitle={`${summary.dsm_count} DSM`}
          />
          <StatCard
            label="DSM primés"
            value={summary.dsm_count}
            loading={loading}
            accent="sky"
          />
        </div>

        {/* Global performance */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 animate-fade-in stagger-3">
          <div className="card overflow-hidden border-l-[3px] border-l-indigo-500">
            <div className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0176d3]">Performance Création</p>
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Objectif global</span>
                  <span className="font-semibold">{formatInt(summary.global_creation_target)} POS</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Réalisé</span>
                  <span className="font-semibold">{formatInt(summary.global_creation_realized)} POS</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Taux d'atteinte</span>
                  <span className="font-bold text-indigo-700">{formatPct(summary.global_creation_achievement_pct)}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="card overflow-hidden border-l-[3px] border-l-emerald-500">
            <div className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#2e844a]">Performance Revenus</p>
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Objectif global</span>
                  <span className="font-semibold">{formatCurrency(summary.global_revenue_target)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Réalisé</span>
                  <span className="font-semibold">{formatCurrency(summary.global_revenue_realized)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Taux d'atteinte</span>
                  <span className="font-bold text-emerald-700">{formatPct(summary.global_revenue_achievement_pct)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* DSM detail table with filters */}
        <div className="animate-fade-in stagger-4">
          <DSMPrimesTable data={summary} filterStatus={filterStatus} filterPartner={filterPartner} />
        </div>
        </>
      )}

      {!selectedPeriod && !loading && (
        <div className="card p-8 text-center text-sm text-slate-400">
          Sélectionnez une période pour afficher les primes DSM.
        </div>
      )}
    </div>
  )
}

function formatInt(v) {
  if (v === null || v === undefined) return '0'
  return new Intl.NumberFormat('fr-FR').format(v)
}