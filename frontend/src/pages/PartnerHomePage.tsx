import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import usePartner from '../hooks/usePartner'
import analyticsService from '../services/analyticsService'
import partenaireService from '../services/partenaireService'
import posService from '../services/posService'
import PartnerIdentityCard from '../components/Partenaires/PartnerIdentityCard'
import POSMap from '../components/POS/POSMap'
import TerritoryMap from '../components/TerritoryMap'
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
  bts_saturees?: number
  sim_en_stock?: number
  sim_assignees?: number
}

type PartnerContext = {
  nom?: string
  name?: string
  code_partenaire?: string
  code?: string
}

type Identity = {
  id?: number
  code?: string | null
  name?: string | null
  address?: string | null
  is_active?: boolean | null
  contract_start_date?: string | null
  created_at?: string | null
  responsable_name?: string | null
  responsable_contact?: string | null
  responsable_user_id?: number | null
  responsable_username?: string | null
  commercial_name?: string | null
  commercial_contact?: string | null
  commercial_user_id?: number | null
  commercial_username?: string | null
  master_sim_number?: string | null
  nb_micro_zones?: number
  nb_pos_crees?: number
  nb_pos_actifs?: number
  nb_bts?: number
}

export default function PartnerHomePage() {
  const { partnerContextId, partner } = usePartner() as {
    partnerContextId: number | null
    partner: PartnerContext | null
  }
  const [stats, setStats] = useState<Stats | null>(null)
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [recentPos, setRecentPos] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    const load = async () => {
      if (!partnerContextId) {
        setLoading(false)
        return
      }
      try {
        const [statsRes, identityRes, posRes] = await Promise.all([
          analyticsService.getDashboard(partnerContextId),
          partenaireService.getIdentity(partnerContextId),
          posService.getEnriched({ limit: 100 }),
        ])
        const posData = posRes.data?.items ?? posRes.data?.data ?? posRes.data?.results ?? posRes.data ?? []
        if (!ignore) {
          setStats(statsRes.data)
          setIdentity(identityRes.data?.data ?? identityRes.data ?? null)
          setRecentPos(Array.isArray(posData) ? posData : [])
        }
      } catch {
        if (!ignore) {
          setStats(null)
          setIdentity(null)
          setRecentPos([])
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    void load()
    return () => { ignore = true }
  }, [partnerContextId])

  const partnerTitle = partner?.nom ?? partner?.code_partenaire ?? (partnerContextId ? `Partenaire #${partnerContextId}` : 'Partenaire')

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Accueil partenaire avec accès direct aux fonctionnalités métier — <span className="font-semibold text-brand-600">{partnerTitle}</span>.
        </p>
      </div>

      {/* Partner identity */}
      <div className="animate-fade-in stagger-1">
        <PartnerIdentityCard identity={identity} loading={loading} />
      </div>

      {/* ── Graphiques analytiques ── */}
      <div className="grid gap-6 lg:grid-cols-2 animate-fade-in stagger-3">
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
            btsTotal={stats?.pos_total ?? 0}
            btsSaturees={stats?.bts_saturees ?? 0}
          />
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 animate-fade-in stagger-4">
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

      {/* POS Map */}
      <div className="card overflow-hidden animate-fade-in stagger-5">
        <div className="card-header flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Carte géographique POS</h2>
            <p className="text-xs text-slate-500">Étendue des points de vente du partenaire sur le territoire.</p>
          </div>
          <Link to="/ventes" className="btn btn-secondary btn-sm">
            Suivi des ventes
          </Link>
        </div>
        <div className="h-[420px] overflow-hidden border-t border-slate-100">
          <POSMap pos={recentPos as never} partnerId={partnerContextId} dsmId={undefined} />
        </div>
      </div>

      {/* Territory Map */}
      <div className="card overflow-hidden animate-fade-in stagger-6">
        <div className="card-header flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Territoire partenaire</h2>
            <p className="text-xs text-slate-500">Représentation géographique du territoire commercial : BTS, micro-zones et quartiers couverts.</p>
          </div>
          <Link to="/bts" className="btn btn-secondary btn-sm">
            Gestion BTS
          </Link>
        </div>
        <div className="border-t border-slate-100 p-1">
          {partnerContextId && (
            <TerritoryMap partnerId={partnerContextId} onSelect={(bts: any) => console.log('BTS sélectionné:', bts)} />
          )}
        </div>
      </div>
    </div>
  )
}
