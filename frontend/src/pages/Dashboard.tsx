// @ts-nocheck
import { useEffect, useState, useMemo } from 'react'
import usePartner from '../hooks/usePartner'
import analyticsService from '../services/analyticsService'
import partenaireService from '../services/partenaireService'
import posService from '../services/posService'
import { getRoleLabel } from '../utils/roles'
import { useI18n } from '../i18n'
import KpiCard from '../components/ui/KpiCard'
import PageHeader from '../components/Common/PageHeader/PageHeader'
import EmptyStatePremium from '../components/ui/EmptyStatePremium'
import ProgressBar from '../components/ui/ProgressBar'
import ChartCard from '../components/Dashboard/ChartCard'
import SaturationChart from '../components/Dashboard/SaturationChart'
import PrimeDsmCard from '../components/Dashboard/PrimeDsmCard'
import BtsEtatCard from '../components/Dashboard/BtsEtatCard'
import BtsProductionCard from '../components/Dashboard/BtsProductionCard'
import POSObjectiveBarChart from '../components/Dashboard/POSObjectiveBarChart'
import PartnerIdentityCard from '../components/Partenaires/PartnerIdentityCard'

type Stats = {
  partner_name?: string
  pos_total?: number
  pos_nouveau?: number
  pos_reconduit?: number
  primes_en_attente?: number
  primes_validees?: number
  montant_primes_periode?: string | number
  montant_primes_dsm?: string | number
  requetes_ouvertes?: number
  requetes_total?: number
  requetes_terminees?: number
  bts_saturees?: number
  sim_en_stock?: number
  sim_assignees?: number
}

type SalesSummary = {
  creation?: { stock_initial?: number | null; cumul?: number; objectif?: number | null }
  redeploiement?: { stock_initial?: number | null; cumul?: number; objectif?: number | null }
  sell_out?: { cumul?: number }
  loading?: { cumul?: number }
  revenue_global?: { objectif?: number | null; realisation?: number | null }
}

function formatInt(v: number | null | undefined) {
  if (v === null || v === undefined) return '0'
  return new Intl.NumberFormat('fr-FR').format(v)
}
function formatCurrency(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === '') return '—'
  return `${new Intl.NumberFormat('fr-FR').format(Number(v))} FCFA`
}

export default function Dashboard() {
  const { t } = useI18n();
  const { partnerContextId, partner, user } = usePartner() as any
  const [stats, setStats] = useState<Stats | null>(null)
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null)
  const [enrichedPos, setEnrichedPos] = useState<any[]>([])
  const [identity, setIdentity] = useState<any | null>(null)
  const [kpiObj, setKpiObj] = useState<any | null>(null)
  const [kpiReal, setKpiReal] = useState<any | null>(null)
  const [kpiBoth, setKpiBoth] = useState<any | null>(null)
  const [simLinkage, setSimLinkage] = useState<any | null>(null)
  const [btsEtat, setBtsEtat] = useState<any[]>([])
  const [btsProduction, setBtsProduction] = useState<any | null>(null)
  const [primeSummary, setPrimeSummary] = useState<any | null>(null)
  const [selectedPrimePeriod, setSelectedPrimePeriod] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [showBestPos, setShowBestPos] = useState(false)

  useEffect(() => {
    let ignore = false
    const load = async () => {
      if (!partnerContextId) {
        if (!ignore) {
          setStats(null); setSalesSummary(null); setEnrichedPos([]); setIdentity(null)
          setKpiObj(null); setKpiReal(null); setKpiBoth(null); setSimLinkage(null); setBtsEtat([]); setBtsProduction(null); setPrimeSummary(null); setLoading(false)
        }
        return
      }
      const kpiMonth = selectedPrimePeriod?.start_date ? selectedPrimePeriod.start_date.slice(0, 7) + '-01' : undefined
      const kpiParams = kpiMonth ? { month: kpiMonth } : undefined
      try {
        const [statsRes, salesRes, posRes, identityRes, kpiObjRes, kpiRealRes, kpiBothRes, simLinkRes, btsEtatRes, btsProdRes] = await Promise.all([
          analyticsService.getDashboard(partnerContextId),
          analyticsService.getSalesSummary(partnerContextId),
          posService.getEnriched({ limit: 100 }),
          partenaireService.getIdentity(partnerContextId),
          analyticsService.getKpiObjectives(partnerContextId, kpiParams),
          analyticsService.getKpiRealisations(partnerContextId, kpiParams),
          analyticsService.getKpiDsmBothCriteria(partnerContextId, kpiParams),
          analyticsService.getSimLinkage(partnerContextId),
          analyticsService.getBtsEtat(partnerContextId),
          analyticsService.getBtsProduction(partnerContextId),
        ])
        if (!ignore) {
          setStats(statsRes.data)
          setSalesSummary(salesRes.data)
          const posData = posRes.data?.items ?? posRes.data?.data ?? posRes.data?.results ?? posRes.data ?? []
          setEnrichedPos(Array.isArray(posData) ? posData : [])
          setIdentity(identityRes.data?.data ?? identityRes.data ?? null)
          setKpiObj(kpiObjRes.data ?? null)
          setKpiReal(kpiRealRes.data ?? null)
          setKpiBoth(kpiBothRes.data ?? null)
          setSimLinkage(simLinkRes.data ?? null)
          setBtsEtat(Array.isArray(btsEtatRes.data) ? btsEtatRes.data : [])
          setBtsProduction(btsProdRes.data ?? null)
        }
      } catch {
        if (!ignore) { setStats(null); setSalesSummary(null); setEnrichedPos([]); setIdentity(null); setKpiObj(null); setKpiReal(null); setKpiBoth(null); setSimLinkage(null); setBtsEtat([]) }
      } finally { if (!ignore) setLoading(false) }
    }
    void load()
    return () => { ignore = true }
  }, [partnerContextId, selectedPrimePeriod])

  const simStats = useMemo(() => {
    if (simLinkage?.linkees || simLinkage?.delinkees) {
      return {
        linkedCount: simLinkage.linkees?.nombre ?? 0,
        linkedSellOut: simLinkage.linkees?.sell_out ?? 0,
        linkedLoading: simLinkage.linkees?.loading ?? 0,
        unlinkedCount: simLinkage.delinkees?.nombre ?? 0,
        unlinkedSellOut: simLinkage.delinkees?.sell_out ?? 0,
        unlinkedLoading: simLinkage.delinkees?.loading ?? 0,
      }
    }
    const linked = enrichedPos.filter((p) => p.linkage_status === 'LINKED')
    const unlinked = enrichedPos.filter((p) => p.linkage_status === 'UNLINKED')
    return {
      linkedCount: linked.length,
      linkedSellOut: linked.reduce((s, p) => s + (p.sell_out ?? 0), 0),
      linkedLoading: linked.reduce((s, p) => s + (p.loading ?? 0), 0),
      unlinkedCount: unlinked.length,
      unlinkedSellOut: unlinked.reduce((s, p) => s + (p.sell_out ?? 0), 0),
      unlinkedLoading: unlinked.reduce((s, p) => s + (p.loading ?? 0), 0),
    }
  }, [simLinkage, enrichedPos])

  const btsCounts = useMemo(() => {
    const count = (etat: string) => btsEtat.filter((b) => b.etat === etat).length
    return { total: btsEtat.length, normales: count('Normal'), presqueSaturees: count('Presque saturé'), saturees: count('Saturé') }
  }, [btsEtat])

  const bestPos = useMemo(() => [...enrichedPos].sort((a, b) => (b.sell_out ?? 0) - (a.sell_out ?? 0)).slice(0, 20), [enrichedPos])
  const stockInitialCreation = salesSummary?.creation?.stock_initial ?? 0
  const creationMensuelle = salesSummary?.creation?.cumul ?? 0
  const redeploiementMensuel = salesSummary?.redeploiement?.cumul ?? 0
  const stockFinalCreation = Math.max(0, (stockInitialCreation ?? 0) - creationMensuelle)

  const objectifCreation = (primeSummary as any)?.global_creation_target != null ? Number((primeSummary as any).global_creation_target) : kpiObj?.objectifs?.creation_pos ?? null
  // Règle métier §16 : objectif reconduction = même que création si non fourni
  const objectifReconduction = kpiObj?.objectifs?.reconduction_pos ?? objectifCreation ?? null
  const posRepartitionData = [
    { name: 'Créations', Objectif: objectifCreation ?? 0, Réalisation: kpiReal?.realisations?.creation_pos ?? 0 },
    { name: 'Reconductions', Objectif: objectifReconduction ?? 0, Réalisation: kpiReal?.realisations?.reconduction_pos ?? 0 },
  ]
  const partnerLabel = partner?.nom ?? partner?.code_partenaire ?? (partnerContextId ? `Partenaire #${partnerContextId}` : '—')
  const periodLabel = selectedPrimePeriod?.label ?? kpiReal?.month ?? 'Mois en cours'

  // KPI taux helper
  const taux = kpiReal?.taux ?? {}
  const objectifs = kpiObj?.objectifs ?? {}
  const realisations = kpiReal?.realisations ?? {}

  if (!partnerContextId && !loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tableau de bord" subtitle="Vue d'ensemble de l'activité commerciale." breadcrumbs={['Espace partenaire', 'Tableau de bord']} />
        <EmptyStatePremium title="Aucun partenaire sélectionné" description="Sélectionnez un partenaire pour afficher les indicateurs, les objectifs et les primes." icon="🏢" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header premium */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-600">Tableau de bord partenaire</p>
            <h1 className="mt-1 text-[28px] font-extrabold tracking-tight text-slate-900 leading-none">{partnerLabel}</h1>
            <p className="mt-2 text-sm text-slate-500">Période <span className="font-semibold text-slate-700">{periodLabel}</span> • Vue d’ensemble de l’activité des terminaux de paiement</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
              <span className="h-2 w-2 rounded-full bg-slate-400" /> {getRoleLabel(user?.role)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
              <span className="h-2 w-2 rounded-full bg-indigo-500" /> {partnerLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Identité partenaire complète — source vérité PartnerIdentityCard (responsable/commercial/master SIM/contrat/code/is_active) */}
      {partnerContextId ? (
        <PartnerIdentityCard identity={identity as never} loading={loading} />
      ) : null}

      {/* KPI principaux */}
      <div>
        <h2 className="section-label mb-3">Indicateurs clés</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="POS en parc" value={loading ? undefined : formatInt(stats?.pos_total ?? 0)} sublabel="Total en base" tone="brand" icon="🏪" loading={loading} />
          <KpiCard label="POS actifs" value={loading ? undefined : formatInt((stats?.pos_nouveau ?? 0) + (stats?.pos_reconduit ?? 0))} sublabel="Nouveaux + reconduits" tone="success" icon="✓" loading={loading} />
          <KpiCard label="BTS suivies" value={loading ? undefined : formatInt(btsCounts.total)} sublabel={`${btsCounts.saturees} saturées`} tone="info" icon="📡" loading={loading} />
          <KpiCard label="Requêtes en cours" value={loading ? undefined : formatInt(stats?.requetes_ouvertes ?? 0)} sublabel={`${formatInt(stats?.requetes_terminees ?? 0)} traitées`} tone="warning" icon="📝" loading={loading} />
        </div>
      </div>

      {/* Objectifs & Réalisations */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Objectifs du mois</h3>
            {kpiObj?.month ? <span className="rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{kpiObj.month}</span> : null}
          </div>
          <div className="mt-4 space-y-3">
            {loading ? <div className="skeleton h-24 w-full" /> : (
              [
                ['Sell-out', objectifs.sell_out],
                ['Loading', objectifs.loading],
                ['Création POS', objectifs.creation_pos],
                ['Reconduction POS', objectifs.reconduction_pos],
                ['Revenus', objectifs.revenus],
              ].map(([label, val]) => (
                <div key={String(label)} className="flex items-center justify-between py-1">
                  <span className="text-sm text-slate-600">{label}</span>
                  <span className={`text-sm font-bold ${val == null ? 'text-slate-400 font-medium' : 'text-slate-900'}`}>{val == null ? '—' : formatInt(val as number)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Avancement vs objectifs</h3>
            {kpiReal?.month ? <span className="rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{kpiReal.month}</span> : null}
          </div>
          <div className="mt-4 space-y-4">
            {loading ? <div className="skeleton h-24 w-full" /> : (
              [
                ['Sell-out', realisations.sell_out, taux.sell_out],
                ['Loading', realisations.loading, taux.loading],
                ['Création POS', realisations.creation_pos, taux.creation_pos],
                ['Reconduction POS', realisations.reconduction_pos, taux.reconduction_pos],
                ['Revenus', realisations.revenus, taux.revenus],
              ].map(([label, real, t]) => (
                <div key={String(label)}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">{label}</span>
                    <span className="text-sm font-bold text-slate-900">{formatInt(real as number)} <span className="ml-2 text-xs font-semibold text-slate-500">{t == null ? '—' : `${Number(t).toFixed(1)}%`}</span></span>
                  </div>
                  <ProgressBar value={t ?? 0} tone={t == null ? 'brand' : t >= 100 ? 'success' : t >= 75 ? 'info' : 'warning'} className="mt-1.5" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Primes DSM */}
      <div>
        <h2 className="section-label mb-3">Primes DSM — période sélectionnée</h2>
        <PrimeDsmCard loading={loading} stats={stats} kpi={kpiBoth} onPrimeSummaryChange={setPrimeSummary as any} onPeriodSelected={setSelectedPrimePeriod as any} />
      </div>

      {/* Réalisation POS créé / reconduit — restauré */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card p-5 border-l-4 border-l-indigo-500">
          <p className="kpi-label text-indigo-600">Réalisation POS créé</p>
          <div className="mt-3 flex items-end justify-between">
            <div><p className="text-xs text-slate-500">Objectif (mois) — PartnerSalesTarget</p><p className="text-lg font-bold text-slate-900">{loading ? '…' : objectifCreation != null ? formatInt(objectifCreation) : '—'}</p></div>
            <div className="text-right"><p className="text-xs text-slate-500">Réalisé — POS NOUVEAU</p><p className="text-xl font-extrabold text-slate-900">{loading ? '…' : formatInt(kpiReal?.realisations?.creation_pos ?? 0)}</p><p className="text-xs font-semibold text-slate-500">{kpiReal?.taux?.creation_pos == null ? '—' : `${Number(kpiReal.taux.creation_pos).toFixed(1)}%`}</p></div>
          </div>
        </div>
        <div className="card p-5 border-l-4 border-l-emerald-500">
          <p className="kpi-label text-emerald-600">Réalisation POS reconduit</p>
          <div className="mt-3 flex items-end justify-between">
            <div><p className="text-xs text-slate-500">Objectif (mois) = même que création</p><p className="text-lg font-bold text-slate-900">{loading ? '…' : objectifReconduction != null ? formatInt(objectifReconduction) : '—'}</p></div>
            <div className="text-right"><p className="text-xs text-slate-500">Réalisé — POS RECONDUIT</p><p className="text-xl font-extrabold text-slate-900">{loading ? '…' : formatInt(kpiReal?.realisations?.reconduction_pos ?? 0)}</p><p className="text-xs font-semibold text-slate-500">{kpiReal?.taux?.reconduction_pos == null ? '—' : `${Number(kpiReal.taux.reconduction_pos).toFixed(1)}%`}</p></div>
          </div>
        </div>
      </div>

      {/* Prime création / revenus — restauré */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card p-5 border-l-4 border-l-indigo-500">
          <p className="kpi-label text-indigo-600">Prime création</p>
          <div className="mt-3 flex items-end justify-between gap-2">
            <div><p className="text-xs text-slate-500">Montant période ouverte — DSMCommission</p><p className="text-lg font-bold text-slate-900">{loading ? '…' : (primeSummary as any)?.total_creation_prime != null ? `${new Intl.NumberFormat('fr-FR').format(Number((primeSummary as any).total_creation_prime))} FCFA` : '—'}</p></div>
            <p className="text-xs text-slate-400">{(primeSummary as any)?.dsm_count != null ? `${(primeSummary as any).dsm_count} DSM` : ''}</p>
          </div>
          <p className="mt-1 text-[10px] text-slate-400">Règle 3B : seule prime revenus calculée si double critère ≥75%</p>
        </div>
        <div className="card p-5 border-l-4 border-l-emerald-500">
          <p className="kpi-label text-emerald-600">Prime revenus (1ère recharge × taux final)</p>
          <div className="mt-3"><p className="text-lg font-bold text-slate-900">{loading ? '…' : (primeSummary as any)?.total_revenue_prime != null ? `${new Intl.NumberFormat('fr-FR').format(Number((primeSummary as any).total_revenue_prime))} FCFA` : '—'}</p><p className="mt-1 text-[11px] text-slate-400">Source: DSMCommission.total_revenue_prime — revenu réel éligible</p></div>
        </div>
      </div>

      {/* Statut des primes — restauré */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card p-5 border-l-4 border-l-indigo-500">
          <p className="kpi-label text-indigo-600">Statut des primes — POS créés</p>
          <div className="mt-3 space-y-2">
            <div className="flex justify-between"><span className="text-sm text-slate-600">Primes en attente (POS créés)</span><span className="text-lg font-bold text-amber-600">{loading ? '…' : formatInt(stats?.primes_en_attente ?? 0)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-600">Primes validées</span><span className="text-lg font-bold text-emerald-600">{loading ? '…' : formatInt(stats?.primes_validees ?? 0)}</span></div>
          </div>
          <p className="mt-2 text-[10px] text-slate-400">Source: Prime.status groupé par POS partenaire</p>
        </div>
        <div className="card p-5 border-l-4 border-l-emerald-500">
          <p className="kpi-label text-emerald-600">Statut des primes — Revenus</p>
          <div className="mt-3 space-y-2">
            <div className="flex justify-between"><span className="text-sm text-slate-600">DSM éligibles</span><span className="text-lg font-bold text-emerald-600">{loading ? '…' : `${(kpiBoth as any)?.dsm_both_criteria ?? 0} / ${(kpiBoth as any)?.total_dsm ?? 0}`}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-600">Prime revenus totale</span><span className="text-lg font-bold text-slate-900">{loading ? '…' : (primeSummary as any)?.total_revenue_prime != null ? `${new Intl.NumberFormat('fr-FR').format(Number((primeSummary as any).total_revenue_prime))} FCFA` : '—'}</span></div>
          </div>
          <p className="mt-2 text-[10px] text-slate-400">Éligibilité = double critère ≥75% (2 POS/DSM, 500k FCFA)</p>
        </div>
      </div>

      {/* Synthèse financière */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5 border-l-4 border-l-indigo-500">
          <p className="kpi-label text-indigo-600">Revenus — objectif</p>
          <p className="kpi-value mt-2 text-slate-900">{loading ? '…' : formatCurrency(salesSummary?.revenue_global?.objectif ?? 0)}</p>
          <p className="kpi-sub mt-1">Réalisé : {loading ? '…' : salesSummary?.revenue_global?.realisation != null ? formatCurrency(salesSummary.revenue_global.realisation) : '—'}</p>
          <p className="mt-1 text-[10px] text-slate-400">POSPerformance.revenue</p>
        </div>
        <div className="card p-5 border-l-4 border-l-emerald-500">
          <p className="kpi-label text-emerald-600">Loading</p>
          <p className="kpi-value mt-2 text-slate-900">{loading ? '…' : formatInt(salesSummary?.loading?.cumul ?? 0)}</p>
          <p className="kpi-sub mt-1">Montant vendu (FCFA) — POSPerformance.revenue</p>
        </div>
        <div className="card p-5 border-l-4 border-l-sky-500">
          <p className="kpi-label text-sky-600">Sell-out</p>
          <p className="kpi-value mt-2 text-slate-900">{loading ? '…' : formatInt(salesSummary?.sell_out?.cumul ?? 0)}</p>
          <p className="kpi-sub mt-1">Montant doté par DSM — POSPerformance.stock_value</p>
        </div>
      </div>

      {/* Prime POS / Performance / Revenu global — trio restauré */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5 border-l-4 border-l-indigo-500">
          <p className="kpi-label text-indigo-600">Prime POS</p>
          <div className="mt-3 space-y-2">
            <div className="flex justify-between"><span className="text-sm text-slate-600">POS réalisés (NOUVEAU)</span><span className="text-lg font-bold text-slate-900">{loading ? '…' : formatInt(stats?.pos_nouveau ?? 0)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-600">Primes en attente</span><span className="text-lg font-bold text-amber-600">{loading ? '…' : formatInt(stats?.primes_en_attente ?? 0)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-600">Primes validées</span><span className="text-lg font-bold text-emerald-600">{loading ? '…' : formatInt(stats?.primes_validees ?? 0)}</span></div>
          </div>
        </div>
        <div className="card p-5 border-l-4 border-l-emerald-500">
          <p className="kpi-label text-emerald-600">Performance</p>
          <div className="mt-3 space-y-2">
            <div className="flex justify-between"><span className="text-sm text-slate-600">Sell-out total</span><span className="text-lg font-bold text-slate-900">{loading ? '…' : formatInt(salesSummary?.sell_out?.cumul ?? 0)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-600">Loading total</span><span className="text-lg font-bold text-slate-900">{loading ? '…' : formatInt(salesSummary?.loading?.cumul ?? 0)}</span></div>
          </div>
        </div>
        <div className="card p-5 border-l-4 border-l-sky-500">
          <p className="kpi-label text-sky-600">Revenu global — objectif vs réalisé</p>
          <div className="mt-3 space-y-2">
            <div className="flex justify-between"><span className="text-sm text-slate-600">Objectif</span><span className="text-lg font-bold text-slate-900">{loading ? '…' : formatInt(salesSummary?.revenue_global?.objectif ?? 0)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-600">Réalisé (POSPerformance.revenue)</span><span className="text-lg font-bold text-slate-900">{loading ? '…' : salesSummary?.revenue_global?.realisation != null ? formatInt(salesSummary.revenue_global.realisation) : '—'}</span></div>
          </div>
        </div>
      </div>

      {/* Stocks */}
      <div className="card p-5">
        <h3 className="text-sm font-bold text-slate-900">Stocks & créations</h3>
        <p className="mt-1 text-xs text-slate-400">PartnerSalesTarget.creation_stock_initial — Stock émission − création mensuelle = Stock final</p>
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            ['Stock émission', stockInitialCreation, 'indigo'],
            ['Stock final', stockFinalCreation, 'slate'],
            ['Création mensuelle', creationMensuelle, 'emerald'],
            ['Redéploiement mensuel', redeploiementMensuel, 'amber'],
          ].map(([label, val, tone]) => (
            <div key={String(label)} className={`rounded-xl border p-4 ${tone === 'indigo' ? 'bg-indigo-50/50 border-indigo-100' : tone === 'emerald' ? 'bg-emerald-50/50 border-emerald-100' : tone === 'amber' ? 'bg-amber-50/50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-2 text-xl font-extrabold text-slate-900">{loading ? '…' : formatInt(val as number)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* SIM & Requêtes */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-900">SIM liées / déliées</h3>
          <p className="text-xs text-slate-400">POS.holder_user_id IS NOT NULL = liée • IS NULL = déliée</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Liées</p>
              <p className="mt-2 text-2xl font-extrabold text-emerald-900">{loading ? '…' : formatInt(simStats.linkedCount)}</p>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <div className="flex justify-between"><span>Sell-out</span><span className="font-semibold">{formatInt(simStats.linkedSellOut)}</span></div>
                <div className="flex justify-between"><span>Loading</span><span className="font-semibold">{formatInt(simStats.linkedLoading)}</span></div>
              </div>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Déliées</p>
              <p className="mt-2 text-2xl font-extrabold text-amber-900">{loading ? '…' : formatInt(simStats.unlinkedCount)}</p>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <div className="flex justify-between"><span>Sell-out</span><span className="font-semibold">{formatInt(simStats.unlinkedSellOut)}</span></div>
                <div className="flex justify-between"><span>Loading</span><span className="font-semibold">{formatInt(simStats.unlinkedLoading)}</span></div>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
          <div className="card p-5">
            <p className="kpi-label text-emerald-600">Requêtes traitées</p>
            <p className="kpi-value mt-2 text-emerald-700">{loading ? '…' : formatInt(stats?.requetes_terminees ?? 0)}</p>
            <p className="mt-1 text-xs text-slate-400">effectue + rejete ≥ demande</p>
          </div>
          <div className="card p-5">
            <p className="kpi-label text-amber-600">Requêtes non traitées</p>
            <p className="kpi-value mt-2 text-amber-700">{loading ? '…' : formatInt(stats?.requetes_ouvertes ?? 0)}</p>
            <p className="mt-1 text-xs text-slate-400">effectue + rejete &lt; demande</p>
          </div>
        </div>
      </div>

      {/* BTS */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BtsEtatCard loading={loading} btsEtat={btsEtat} />
        <BtsProductionCard loading={loading} production={btsProduction} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Création & Reconduction" subtitle={`Objectif vs Réalisation — ${periodLabel}`}>
          <POSObjectiveBarChart loading={loading} data={posRepartitionData} />
        </ChartCard>
        <ChartCard title="Saturation BTS" subtitle="Répartition par état">
          <SaturationChart loading={loading} btsTotal={btsCounts.total || (stats?.bts_saturees ?? 0)} btsSaturees={btsCounts.saturees || (stats?.bts_saturees ?? 0)} />
        </ChartCard>
      </div>

      {/* Top POS */}
      <div className="card overflow-hidden">
        <button type="button" onClick={() => setShowBestPos((v) => !v)} className="flex w-full items-center justify-between p-5 text-left hover:bg-slate-50/60 transition">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Meilleurs POS du partenaire</h3>
            <p className="text-xs text-slate-500">Classement par sell-out • {loading ? '…' : `${bestPos.length} / ${enrichedPos.length}`} affichés</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
            {showBestPos ? 'Masquer' : 'Voir le classement'}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${showBestPos ? 'rotate-180' : ''} transition-transform`}><path d="M6 9l6 6 6-6" /></svg>
          </span>
        </button>
        {showBestPos ? (
          <div className="border-t border-slate-100 overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  {['DSM', 'Numéro du POS', 'Moyenne de consommation'].map((col) => (
                    <th key={col} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? <tr><td colSpan={3} className="px-5 py-10 text-center"><div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" /></td></tr>
                  : bestPos.length === 0 ? <tr><td colSpan={3} className="px-5 py-10 text-center text-sm text-slate-400"><EmptyStatePremium compact title="Aucun POS" description="Aucun point de vente enregistré pour ce partenaire." /></td></tr>
                    : bestPos.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-5 py-3.5 text-sm text-slate-600">{p.dsm?.full_name ?? '—'}</td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-sm font-bold text-indigo-600">{p.code_pos}</td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-sm font-semibold text-slate-900">{formatInt(p.sell_out ?? 0)}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  )
}
