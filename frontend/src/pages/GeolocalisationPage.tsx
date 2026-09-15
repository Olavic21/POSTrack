import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import usePartner from '../hooks/usePartner'
import posService from '../services/posService'
import POSMap from '../components/POS/POSMap'
import TerritoryMap from '../components/TerritoryMap'

export default function GeolocalisationPage() {
  const { partnerContextId, partner } = usePartner() as {
    partnerContextId: number | null
    partner: { nom?: string; code_partenaire?: string } | null
  }
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
        const posRes = await posService.getEnriched({ limit: 500 })
        const posData = posRes.data?.items ?? posRes.data?.data ?? posRes.data?.results ?? posRes.data ?? []
        if (!ignore) setRecentPos(Array.isArray(posData) ? posData : [])
      } catch {
        if (!ignore) setRecentPos([])
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    void load()
    return () => { ignore = true }
  }, [partnerContextId])

  const partnerTitle = partner?.nom ?? partner?.code_partenaire ?? (partnerContextId ? `Partenaire #${partnerContextId}` : '—')

  if (!partnerContextId) {
    return (
      <div className="glass rounded-2xl border border-amber-200/60 bg-amber-50/50 px-5 py-4 text-sm text-amber-900">
        Sélectionnez un partenaire pour afficher la géolocalisation.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Géolocalisation</h1>
        <p className="mt-1 text-sm text-slate-500">
          Cartes géographiques — <span className="font-semibold text-brand-600">{partnerTitle}</span>
        </p>
      </div>

      <div className="card overflow-hidden animate-fade-in stagger-1">
        <div className="card-header flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Carte géographique POS</h2>
            <p className="text-xs text-slate-500">Étendue des points de vente du partenaire sur le territoire.</p>
          </div>
          <Link to="/dashboard" className="btn btn-secondary btn-sm">
            Retour Dashboard
          </Link>
        </div>
        <div className="h-[520px] overflow-hidden border-t border-slate-100">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
          ) : (
            <POSMap pos={recentPos as never} partnerId={partnerContextId} dsmId={undefined} />
          )}
        </div>
      </div>

      <div className="card overflow-hidden animate-fade-in stagger-2">
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
          <TerritoryMap partnerId={partnerContextId} onSelect={(bts: unknown) => console.log('BTS sélectionné:', bts)} />
        </div>
      </div>
    </div>
  )
}
