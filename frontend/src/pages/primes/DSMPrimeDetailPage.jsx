import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import usePartner from '../../hooks/usePartner'
import primeService from '../../services/primeService'
import dsmService from '../../services/dsmService'
import PageHeader from '../../components/Common/PageHeader/PageHeader'

const formatCurrency = (v) => {
  if (v === null || v === undefined) return '—'
  return `${new Intl.NumberFormat('fr-FR').format(Number(v))} FCFA`
}
const formatPct = (v) => {
  if (v === null || v === undefined || isNaN(Number(v))) return '—'
  return `${Number(v).toFixed(1)}%`
}
const formatRate = (v) => (v == null ? '—' : `${Number(v).toFixed(0)}%`)

export default function DSMPrimeDetailPage() {
  const { dsmId } = useParams()
  const [searchParams] = useSearchParams()
  const periodId = searchParams.get('periodId') || searchParams.get('prime_period_id')
  const navigate = useNavigate()
  const { partnerContextId, partner } = usePartner()
  const [detail, setDetail] = useState(null)
  const [period, setPeriod] = useState(null)
  const [identity, setIdentity] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!partnerContextId || !dsmId || !periodId) {
      setLoading(false)
      if (!periodId) setError('Période manquante — revenez via le tableau des primes.')
      return
    }
    let ignore = false
    const load = async () => {
      try {
        setLoading(true)
        setError('')
        const [detRes, periodsRes] = await Promise.all([
          primeService.getDsmPrimeDetail(partnerContextId, Number(dsmId), Number(periodId)),
          primeService.getPeriods(partnerContextId),
        ])
        if (ignore) return
        setDetail(detRes.data)
        const list = periodsRes.data?.items ?? periodsRes.data ?? []
        const arr = Array.isArray(list) ? list : []
        const p = arr.find((pp) => pp.id === Number(periodId))
        setPeriod(p || null)
        try {
          const idRes = await dsmService.getById(Number(dsmId))
          if (!ignore) setIdentity(idRes.data ?? null)
        } catch {}
      } catch (e) {
        if (!ignore) setError(e?.response?.data?.detail || e?.message || 'Détail indisponible.')
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    void load()
    return () => { ignore = true }
  }, [partnerContextId, dsmId, periodId])

  const dsmName = detail?.dsm_name || identity?.full_name || identity?.nom || `DSM #${dsmId}`
  const partnerName = partner?.nom ?? partner?.name ?? partner?.code ?? ''
  const totalPrime = Number(detail?.total_prime_amount || 0)
  const isPrime = totalPrime > 0
  const isDouble = !!detail?.double_qualified
  const qtyPct = detail?.creation_achievement_pct ?? 0
  const revPct = detail?.revenue_achievement_pct ?? 0
  const creationPrime = Number(detail?.creation_prime_amount || 0)
  const revenuePrime = Number(detail?.revenue_prime_amount || 0)

  if (loading) {
    return <div className="card p-10 text-center"><div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" /><p className="mt-2 text-sm text-slate-400">Chargement…</p></div>
  }
  if (error || !detail) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => navigate('/primes')} className="text-sm font-semibold text-indigo-600 hover:underline">← Retour</button>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800"><p>{error || 'DSM introuvable.'}</p></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={dsmName}
        subtitle={`${period?.label ?? period?.code ?? `Période #${periodId}`} • ${period?.start_date ?? ''} → ${period?.end_date ?? ''} • ${partnerName}`}
        breadcrumbs={['Primes DSM', period?.label ?? 'Période', dsmName]}
        eyebrow="Détail prime DSM"
        actions={<button type="button" onClick={() => navigate('/primes')} className="btn btn-secondary">← Retour aux primes</button>}
      />

      <div className={`rounded-2xl border p-6 ${isPrime ? (isDouble ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50') : 'border-slate-200 bg-slate-50'}`}>
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Statut prime</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={`text-2xl font-extrabold ${isPrime ? (isDouble ? 'text-emerald-700' : 'text-amber-700') : 'text-slate-600'}`}>{isPrime ? (isDouble ? 'Primé — double critère' : 'Primé — une composante') : 'Non primé'}</p>
            <p className="mt-1 text-sm text-slate-600">Création : {detail?.creation_qualified ? `atteint (${formatCurrency(creationPrime)})` : 'non atteint'} • Revenus : {detail?.revenue_qualified ? `atteint (${formatCurrency(revenuePrime)})` : 'non atteint'}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Prime totale</p>
            <p className={`text-3xl font-extrabold ${isPrime ? 'text-slate-900' : 'text-slate-600'}`}>{formatCurrency(detail?.total_prime_amount)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <p className="kpi-label text-indigo-600">Objectif création</p>
          <p className="kpi-value mt-2">{detail?.creation_objective ?? 2} POS</p>
          <p className="kpi-sub">Objectif global partenaire : 118 POS / mois</p>
        </div>
        <div className="card p-5">
          <p className="kpi-label text-emerald-600">Objectif revenus</p>
          <p className="kpi-value mt-2">{formatCurrency(detail?.revenue_objective ?? 500000)}</p>
          <p className="kpi-sub">Objectif global : {formatCurrency(59 * 500000)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <p className="kpi-label text-indigo-600">Création — réalisation</p>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Réalisé</span><span className="font-bold">{detail?.creation_realized ?? 0} POS / {detail?.creation_objective ?? 2}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Taux</span><span className={`font-extrabold ${qtyPct >= 75 ? 'text-emerald-600' : 'text-red-600'}`}>{formatPct(qtyPct)}</span></div>
            <div className="progress-track mt-3"><div className={`progress-fill ${qtyPct >= 75 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, qtyPct)}%` }} /></div>
            <p className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold border ${detail?.creation_qualified ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{detail?.creation_qualified ? 'Atteint ≥75%' : 'Non atteint'}</p>
          </div>
        </div>
        <div className="card p-5">
          <p className="kpi-label text-emerald-600">Revenus — réalisation</p>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Réalisé</span><span className="font-bold">{formatCurrency(detail?.revenue_realized)} / {formatCurrency(detail?.revenue_objective)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Taux</span><span className={`font-extrabold ${revPct >= 75 ? 'text-emerald-600' : 'text-red-600'}`}>{formatPct(revPct)}</span></div>
            <div className="progress-track mt-3"><div className={`progress-fill ${revPct >= 75 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, revPct)}%` }} /></div>
            <p className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold border ${detail?.revenue_qualified ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{detail?.revenue_qualified ? 'Atteint ≥75%' : 'Non atteint'}</p>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Détail du calcul</h3>
          <p className="text-xs text-slate-500">Grille : &lt;75% → 0% • 75–85% → 5% • 85–95% → 6% • ≥95% → 7%</p>
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-3">
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Prime création</p>
            <div className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">Taux prime</span><span className="font-bold text-indigo-700">{formatRate(detail?.creation_rate_pct)}</span></div>
              <div className="flex justify-between border-t border-indigo-100 pt-2"><span className="font-semibold">Montant</span><span className={`font-extrabold ${creationPrime>0?'text-indigo-700':'text-slate-400'}`}>{formatCurrency(creationPrime)}</span></div>
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Prime revenus</p>
            <div className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">Taux prime</span><span className="font-bold text-emerald-700">{formatRate(detail?.revenue_rate_pct)}</span></div>
              <div className="flex justify-between border-t border-emerald-100 pt-2"><span className="font-semibold">Montant</span><span className={`font-extrabold ${revenuePrime>0?'text-emerald-700':'text-slate-400'}`}>{formatCurrency(revenuePrime)}</span></div>
            </div>
          </div>
          <div className="rounded-2xl bg-slate-900 text-white p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-300">Prime totale</p>
            <p className="mt-3 text-2xl font-extrabold">{formatCurrency(totalPrime)}</p>
            <p className="mt-1 text-xs text-slate-400">Création + Revenus</p>
          </div>
        </div>
      </div>
    </div>
  )
}
