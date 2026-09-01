import { useEffect, useState, useMemo } from 'react'
import usePartner from '../hooks/usePartner'
import analyticsService from '../services/analyticsService'
import partenaireService from '../services/partenaireService'
import posService from '../services/posService'
import { getRoleLabel } from '../utils/roles'
import PartnerIdentityCard from '../components/Partenaires/PartnerIdentityCard'
import StatCard from '../components/Dashboard/StatCard'
import ChartCard from '../components/Dashboard/ChartCard'
import POSDistributionChart from '../components/Dashboard/POSDistributionChart'
import SaturationChart from '../components/Dashboard/SaturationChart'
import PrimeChart from '../components/Dashboard/PrimeChart'
import SIMStockChart from '../components/Dashboard/SIMStockChart'

type Stats = {
  partner_name?: string
  pos_total?: number
  pos_nouveau?: number
  pos_reconduit?: number
  primes_en_attente?: number
  primes_validees?: number
  montant_primes_periode?: string | number
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

type EnrichedPos = {
  id: number
  code_pos: string
  name: string
  linkage_status?: string
  loading?: number
  sell_out?: number
  recettes?: number
  dsm?: { id?: number; full_name?: string }
}

type PartnerContext = {
  nom?: string
  name?: string
  code_partenaire?: string
  code?: string
}

const formatInt = (v: number | null | undefined) => {
  if (v === null || v === undefined) return '0'
  return new Intl.NumberFormat('fr-FR').format(v)
}

function Dashboard() {
  const { partnerContextId, partner, user } = usePartner() as {
    partnerContextId: number | null
    partner: PartnerContext | null
    user: { role?: string } | null
  }
  const [stats, setStats] = useState<Stats | null>(null)
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null)
  const [enrichedPos, setEnrichedPos] = useState<EnrichedPos[]>([])
  const [identity, setIdentity] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    const load = async () => {
      if (!partnerContextId) {
        if (!ignore) {
          setStats(null)
          setSalesSummary(null)
          setEnrichedPos([])
          setIdentity(null)
          setLoading(false)
        }
        return
      }
      try {
        const [statsRes, salesRes, posRes, identityRes] = await Promise.all([
          analyticsService.getDashboard(partnerContextId),
          analyticsService.getSalesSummary(partnerContextId),
          posService.getEnriched({ limit: 100 }),
          partenaireService.getIdentity(partnerContextId),
        ])
        if (!ignore) {
          setStats(statsRes.data)
          setSalesSummary(salesRes.data)
          const posData = posRes.data?.items ?? posRes.data?.data ?? posRes.data?.results ?? posRes.data ?? []
          setEnrichedPos(Array.isArray(posData) ? posData : [])
          setIdentity(identityRes.data?.data ?? identityRes.data ?? null)
        }
      } catch {
        if (!ignore) {
          setStats(null)
          setSalesSummary(null)
          setEnrichedPos([])
          setIdentity(null)
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    void load()
    return () => { ignore = true }
  }, [partnerContextId])

  const simStats = useMemo(() => {
    const linked = enrichedPos.filter((p) => p.linkage_status === 'LINKED')
    const unlinked = enrichedPos.filter((p) => p.linkage_status === 'UNLINKED')
    return {
      linkedCount: linked.length,
      linkedSellOut: linked.reduce((sum, p) => sum + (p.sell_out ?? 0), 0),
      linkedLoading: linked.reduce((sum, p) => sum + (p.loading ?? 0), 0),
      unlinkedCount: unlinked.length,
      unlinkedSellOut: unlinked.reduce((sum, p) => sum + (p.sell_out ?? 0), 0),
      unlinkedLoading: unlinked.reduce((sum, p) => sum + (p.loading ?? 0), 0),
    }
  }, [enrichedPos])

  const bestPos = useMemo(() => {
    return [...enrichedPos]
      .sort((a, b) => (b.sell_out ?? 0) - (a.sell_out ?? 0))
      .slice(0, 20)
  }, [enrichedPos])

  const stockInitialCreation = salesSummary?.creation?.stock_initial ?? 0
  const stockInitialRedeploy = salesSummary?.redeploiement?.stock_initial ?? 0
  const creationMensuelle = salesSummary?.creation?.cumul ?? 0
  const redeploiementMensuel = salesSummary?.redeploiement?.cumul ?? 0
  const stockFinalCreation = Math.max(0, (stockInitialCreation ?? 0) - creationMensuelle)
  const stockFinalRedeploy = Math.max(0, (stockInitialRedeploy ?? 0) - redeploiementMensuel)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Vue d&apos;ensemble de l&apos;activité des terminaux de paiement.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 shadow-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Rôle : {getRoleLabel(user?.role)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/60 bg-indigo-50 px-3 py-1 text-indigo-700 shadow-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            {partner?.nom ?? partner?.code_partenaire ?? (partnerContextId ? `Partenaire #${partnerContextId}` : '—')}
          </span>
        </div>
      </div>

      {/* No partner selected */}
      {!loading && !partnerContextId ? (
        <div className="glass rounded-2xl border border-amber-200/60 bg-amber-50/50 px-5 py-4 text-sm text-amber-900 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-sm font-bold text-amber-600">
              !
            </span>
            <p className="font-medium">Sélectionnez un partenaire pour afficher les statistiques du dashboard.</p>
          </div>
        </div>
      ) : null}

      {/* Partner identity card */}
      {partnerContextId && (
        <div className="animate-fade-in stagger-1">
          <PartnerIdentityCard identity={identity as never} loading={loading} />
        </div>
      )}

      {/* Primary stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in stagger-2">
        <StatCard
          label="Parc POS"
          value={loading ? undefined : stats?.pos_total ?? 0}
          loading={loading}
        />
        <StatCard
          label="POS actifs"
          value={loading ? undefined : (stats?.pos_nouveau ?? 0) + (stats?.pos_reconduit ?? 0)}
          loading={loading}
          accent="green"
        />
        <StatCard
          label="SIM en stock"
          value={loading ? undefined : stats?.sim_en_stock ?? 0}
          loading={loading}
          accent="sky"
        />
        <StatCard
          label="Requêtes en cours"
          value={loading ? undefined : stats?.requetes_ouvertes ?? 0}
          loading={loading}
          accent="amber"
        />
      </div>

      {/* Secondary stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 animate-fade-in stagger-3">
        <StatCard
          label="BTS saturées"
          value={loading ? undefined : stats?.bts_saturees ?? 0}
          loading={loading}
          accent="red"
          small
        />
        <StatCard
          label="Montant primes période"
          value={loading ? undefined : stats?.montant_primes_periode ? `${Number(stats.montant_primes_periode).toLocaleString('fr-FR')} FCFA` : '0 FCFA'}
          loading={loading}
          accent="green"
          small
        />
        <StatCard
          label="Primes validées"
          value={loading ? undefined : stats?.primes_validees ?? 0}
          loading={loading}
          accent="green"
          small
        />
      </div>

      {/* ── Stocks initiaux ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 animate-fade-in stagger-4">
        <div className="card overflow-hidden border-l-[3px] border-l-sky-500">
          <div className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0d9dd1]">Stocks initiaux</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Stock initial POS création</span>
                <span className="text-lg font-bold text-slate-900">{loading ? '…' : formatInt(stockInitialCreation)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Stock initial POS reconduction</span>
                <span className="text-lg font-bold text-slate-900">{loading ? '…' : formatInt(stockInitialRedeploy)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="card overflow-hidden border-l-[3px] border-l-indigo-500">
          <div className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0176d3]">Activité mensuelle</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Création mensuelle</span>
                <span className="text-lg font-bold text-slate-900">{loading ? '…' : formatInt(creationMensuelle)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Redéploiement mensuel</span>
                <span className="text-lg font-bold text-slate-900">{loading ? '…' : formatInt(redeploiementMensuel)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stocks finaux ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 animate-fade-in stagger-5">
        <div className="card overflow-hidden border-l-[3px] border-l-emerald-500">
          <div className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#2e844a]">Stocks finaux</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Stock final création</span>
                <span className="text-lg font-bold text-slate-900">{loading ? '…' : formatInt(stockFinalCreation)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Stock final reconduction</span>
                <span className="text-lg font-bold text-slate-900">{loading ? '…' : formatInt(stockFinalRedeploy)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="card overflow-hidden border-l-[3px] border-l-amber-500">
          <div className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#dd7a01]">Requêtes en cours</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Requêtes traitées</span>
                <span className="text-lg font-bold text-emerald-700">{loading ? '…' : formatInt(stats?.requetes_terminees ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Requêtes non traitées</span>
                <span className="text-lg font-bold text-amber-700">{loading ? '…' : formatInt(stats?.requetes_ouvertes ?? 0)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SIM linkées / délinkées ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 animate-fade-in stagger-6">
        <div className="card overflow-hidden border-l-[3px] border-l-emerald-500">
          <div className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#2e844a]">SIM linkées</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">SIM linkées</span>
                <span className="text-lg font-bold text-slate-900">{loading ? '…' : formatInt(simStats.linkedCount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Sell-out</span>
                <span className="text-lg font-bold text-slate-900">{loading ? '…' : formatInt(simStats.linkedSellOut)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Loading</span>
                <span className="text-lg font-bold text-slate-900">{loading ? '…' : formatInt(simStats.linkedLoading)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="card overflow-hidden border-l-[3px] border-l-amber-500">
          <div className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#dd7a01]">SIM délinkées</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">SIM délinkées</span>
                <span className="text-lg font-bold text-slate-900">{loading ? '…' : formatInt(simStats.unlinkedCount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Sell-out</span>
                <span className="text-lg font-bold text-slate-900">{loading ? '…' : formatInt(simStats.unlinkedSellOut)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Loading</span>
                <span className="text-lg font-bold text-slate-900">{loading ? '…' : formatInt(simStats.unlinkedLoading)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Résumé Primes ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in stagger-7">
        <div className="card overflow-hidden border-l-[3px] border-l-indigo-500">
          <div className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0176d3]">Prime POS</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">POS réalisés</span>
                <span className="text-lg font-bold text-slate-900">{loading ? '…' : formatInt((stats?.pos_nouveau ?? 0))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Primes en attente</span>
                <span className="text-lg font-bold text-amber-600">{loading ? '…' : formatInt(stats?.primes_en_attente ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Primes validées</span>
                <span className="text-lg font-bold text-emerald-600">{loading ? '…' : formatInt(stats?.primes_validees ?? 0)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="card overflow-hidden border-l-[3px] border-l-emerald-500">
          <div className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#2e844a]">Performance</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Sell-out total</span>
                <span className="text-lg font-bold text-slate-900">{loading ? '…' : formatInt(salesSummary?.sell_out?.cumul ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Loading total</span>
                <span className="text-lg font-bold text-slate-900">{loading ? '…' : formatInt(salesSummary?.loading?.cumul ?? 0)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="card overflow-hidden border-l-[3px] border-l-sky-500">
          <div className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0d9dd1]">Revenus</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Objectif</span>
                <span className="text-lg font-bold text-slate-900">{loading ? '…' : formatInt(salesSummary?.revenue_global?.objectif ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Réalisé</span>
                <span className="text-lg font-bold text-slate-900">{loading ? '…' : salesSummary?.revenue_global?.realisation != null ? formatInt(salesSummary.revenue_global.realisation) : '—'}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="card overflow-hidden border-l-[3px] border-l-amber-500">
          <div className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#dd7a01]">Montant primes</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Total période</span>
                <span className="text-lg font-bold text-slate-900">{loading ? '…' : stats?.montant_primes_periode ? `${Number(stats.montant_primes_periode).toLocaleString('fr-FR')} FCFA` : '0 FCFA'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Graphiques analytiques ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 animate-fade-in stagger-7">
        <ChartCard title="Répartition des POS" subtitle="Distribution par statut">
          <POSDistributionChart
            loading={loading}
            data={[
              { name: 'Nouveaux', value: stats?.pos_nouveau ?? 0 },
              { name: 'Reconduits', value: stats?.pos_reconduit ?? 0 },
              { name: 'Total', value: stats?.pos_total ?? 0 },
            ]}
          />
        </ChartCard>

        <ChartCard title="Saturation BTS" subtitle="Ratio BTS normales vs saturées">
          <SaturationChart
            loading={loading}
            btsTotal={(stats?.pos_total ?? 0)}
            btsSaturees={stats?.bts_saturees ?? 0}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 animate-fade-in stagger-8">
        <ChartCard title="Statut des Primes" subtitle="Validation des primes">
          <PrimeChart
            loading={loading}
            primesEnAttente={stats?.primes_en_attente ?? 0}
            primesValidees={stats?.primes_validees ?? 0}
          />
        </ChartCard>

        <ChartCard title="Stock SIM" subtitle="Inventaire et affectation">
          <SIMStockChart
            loading={loading}
            simEnStock={stats?.sim_en_stock ?? 0}
            simAssignees={stats?.sim_assignees ?? 0}
          />
        </ChartCard>
      </div>

      {/* ── Meilleurs POS du partenaire ── */}
      <div className="card overflow-hidden animate-fade-in stagger-9">
        <div className="card-header flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Meilleurs POS du partenaire</h2>
            <p className="text-xs text-slate-500">Classement des 20 meilleurs points de vente par consommation moyenne.</p>
          </div>
          <span className="section-label text-slate-400">
            {loading ? '…' : `${bestPos.length} / ${enrichedPos.length}`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/80">
              <tr>
                {['DSM', 'Numéro du POS', 'Moyenne de consommation'].map((col) => (
                  <th
                    key={col}
                    className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-5 py-10 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                      <span className="text-sm text-slate-400">Chargement…</span>
                    </div>
                  </td>
                </tr>
              ) : bestPos.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-10 text-center text-sm text-slate-400">
                    Aucun POS enregistré
                  </td>
                </tr>
              ) : (
                bestPos.map((p) => (
                  <tr key={p.id} className="table-row-hover transition-colors">
                    <td className="whitespace-nowrap px-5 py-3.5 text-sm text-slate-500">
                      {p.dsm?.full_name ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-sm font-semibold text-brand-600">
                      {p.code_pos}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-sm font-medium text-slate-900">
                      {formatInt(p.sell_out ?? 0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
