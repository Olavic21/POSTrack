import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/Common/PageHeader/PageHeader';
import LoadingSpinner from '../../components/Common/LoadingSpinner/LoadingSpinner';
import ErrorState from '../../components/Common/ErrorState/ErrorState';
import analyticsService from '../../services/analyticsService';
import { dsmService } from '../../services/dsmService';
import usePartner from '../../hooks/usePartner';

/**
 * « Suivi quotidien » — consultation (lecture seule).
 * Source : GET /api/partners/{id}/analytics/tracking/daily?date=&dsm_id=
 * Filtrable par date et par DSM. Les données proviennent de POSPerformance.
 * Aucune saisie : l'API ne fournit pour l'instant que la lecture.
 */
const todayIso = () => new Date().toISOString().slice(0, 10);

const fmtInt = (v) => {
  if (v === null || v === undefined) return '—';
  return Number(v).toLocaleString('fr-FR');
};

const SuiviQuotidienPage = () => {
  const { partnerContextId } = usePartner();
  const [date, setDate] = useState(todayIso());
  const [dsmId, setDsmId] = useState('');
  const [dsms, setDsms] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Liste des DSM (sélecteur) — si aucune donnée, on reste sur « Tous les DSM ».
  useEffect(() => {
    let ignore = false;
    const load = async () => {
      if (!partnerContextId) return;
      try {
        const res = await dsmService.getAll({ limit: 500 });
        if (!ignore) setDsms(res.data?.items ?? []);
      } catch {
        if (!ignore) setDsms([]);
      }
    };
    void load();
    return () => { ignore = true };
  }, [partnerContextId]);

  const fetchDaily = useCallback(async () => {
    if (!partnerContextId) {
      setRows([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const params = { date };
      if (dsmId) params.dsm_id = Number(dsmId);
      const res = await analyticsService.getDailyTracking(partnerContextId, params);
      const data = res.data ?? [];
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.apiMessage || err?.response?.data?.detail || 'Impossible de charger le suivi quotidien.');
    } finally {
      setLoading(false);
    }
  }, [partnerContextId, date, dsmId]);

  useEffect(() => {
    void fetchDaily();
  }, [fetchDaily]);

  // Statistiques du jour (somme des lignes retournées par le backend).
  const totals = useMemo(() => {
    const sum = (k) => rows.reduce((acc, r) => acc + (Number(r[k]) || 0), 0);
    return {
      sell_out: sum('sell_out'),
      loading: sum('loading'),
      creation: sum('creation'),
      reconduction: sum('reconduction'),
      fiab_creation: sum('fiabilisation_creation'),
      fiab_redeploiement: sum('fiabilisation_redeploiement'),
      cumul_achat: sum('cumul_achat'),
      realisation: sum('realisation'),
      cumul_realisation: sum('cumul_realisation'),
    };
  }, [rows]);

  if (error) {
    return (
      <div>
        <PageHeader title="Suivi quotidien" subtitle="Consultation des données quotidiennes par date et par DSM." breadcrumbs={['Espace partenaire', 'Suivi quotidien']} />
        <ErrorState title="Erreur de chargement" message={error} onRetry={fetchDaily} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suivi quotidien"
        subtitle="Consultation des données quotidiennes (lecture seule) par date et par DSM."
        breadcrumbs={['Espace partenaire', 'Suivi quotidien']}
      />

      {/* Filtres */}
      <div className="card overflow-hidden animate-fade-in">
        <div className="card-header">
          <h2 className="text-lg font-bold text-slate-900">Filtres</h2>
        </div>
        <div className="flex flex-wrap items-end gap-4 p-4">
          <div>
            <label htmlFor="track-date" className="block text-xs font-medium text-slate-500">Date</label>
            <input
              id="track-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label htmlFor="track-dsm" className="block text-xs font-medium text-slate-500">DSM</label>
            <select
              id="track-dsm"
              value={dsmId}
              onChange={(e) => setDsmId(e.target.value)}
              className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            >
              <option value="">Tous les DSM</option>
              {dsms.map((d) => (
                <option key={d.id} value={String(d.id)}>{d.full_name || d.zone || `DSM #${d.id}`}</option>
              ))}
            </select>
          </div>
          <div className="ml-auto">
            <button
              type="button"
              onClick={() => void fetchDaily()}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Actualiser
            </button>
          </div>
        </div>
      </div>

      {/* Consultation seule */}
      <div className="rounded-lg border border-amber-200/60 bg-amber-50/60 px-4 py-3 text-xs text-amber-800">
        <strong>Consultation seule :</strong> l'API actuelle fournit uniquement la lecture du suivi quotidien
        (<code>/analytics/tracking/daily</code>). Il n'existe pas encore d'endpoint POST/PUT de saisie — aucune
        saisie n'est donc possible dans cette version.
      </div>

      {/* Synthèse du jour */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 animate-fade-in">
        {[
          ['Sell-out', totals.sell_out],
          ['Loading', totals.loading],
          ['Création', totals.creation],
          ['Reconduction', totals.reconduction],
          ['Fiab. création', totals.fiab_creation],
          ['Fiab. redéploiement', totals.fiab_redeploiement],
          ['Cumul achat', totals.cumul_achat],
          ['Réalisation', totals.realisation],
          ['Cumul réalisation', totals.cumul_realisation],
        ].map(([label, value]) => (
          <div key={label} className="card overflow-hidden border-l-[3px] border-l-sky-500 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0d9dd1]">{label}</p>
            <p className="mt-2 text-xl font-extrabold text-slate-900">{loading ? '…' : fmtInt(value)}</p>
          </div>
        ))}
      </div>

      {/* Détail par ligne */}
      <div className="card overflow-hidden animate-fade-in">
        <div className="card-header">
          <h2 className="text-lg font-bold text-slate-900">Détail</h2>
          <span className="text-xs text-slate-400">{loading ? '…' : `${rows.length} ligne(s) pour le ${date}`}</span>
        </div>

        {loading ? (
          <div className="p-10"><LoadingSpinner label="Chargement du suivi quotidien…" /></div>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">Aucune donnée disponible pour cette date.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/80">
                <tr>
                  {['DSM', 'Sell-out', 'Loading', 'Création', 'Reconduction', 'Fiab. création', 'Fiab. redép.', 'Cumul achat', 'Réalisation', 'Cumul réalisation', 'Statut'].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((r, idx) => (
                  <tr key={`${r.dsm_id}-${idx}`} className="table-row-hover transition-colors">
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm text-slate-600">{r.dsm_id ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums">{fmtInt(r.sell_out)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums">{fmtInt(r.loading)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums">{fmtInt(r.creation)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums">{fmtInt(r.reconduction)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums">{fmtInt(r.fiabilisation_creation)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums">{fmtInt(r.fiabilisation_redeploiement)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums">{fmtInt(r.cumul_achat)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums">{fmtInt(r.realisation)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums">{fmtInt(r.cumul_realisation)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm text-slate-500">{r.statut ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuiviQuotidienPage;