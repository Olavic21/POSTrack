import React, { useMemo, useState, useEffect } from 'react';
import analyticsService from '../../services/analyticsService';
import usePartner from '../../hooks/usePartner';
import LoadingSpinner from '../Common/LoadingSpinner/LoadingSpinner';
import ErrorState from '../Common/ErrorState/ErrorState';

/**
 * « Meilleures POS » — 10 colonnes exactes :
 * N° | Numéro DSM | Numéro POS | Loading Janv | Loading Févr | Loading Mars | Total | Moyenne | Valeurs cumulées | % cumulé
 * Source : GET /api/partners/{id}/analytics/sales/table?months=N
 * Ordre = ranking par Total décroissant (meilleures en premier). Total/Moyenne/Cumul/% cumulé calculés backend.
 */
const MONTH_LABELS = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

const monthLabelFromIso = (iso) => {
  if (!iso) return '—';
  const m = Number(iso.slice(5, 7));
  const y = iso.slice(0, 4);
  const name = MONTH_LABELS[(m - 1) % 12] ?? iso;
  return `${name} ${y}`;
};

const formatVal = (v) =>
  v === null || v === undefined ? '—' : Number(v).toLocaleString('fr-FR');
const formatPct = (v) =>
  v === null || v === undefined ? '—' : `${Number(v).toFixed(1)}%`;

const SalesTableCard = () => {
  const { partnerContextId } = usePartner();
  const [rows, setRows] = useState([]);
  const [months, setMonths] = useState(3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      if (!partnerContextId) {
        if (!ignore) {
          setRows([]);
          setLoading(false);
        }
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const res = await analyticsService.getSalesTable(partnerContextId, { months });
        const data = res.data ?? [];
        if (!ignore) setRows(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!ignore) setError(err?.apiMessage || err?.response?.data?.detail || 'Impossible de charger le tableau des ventes.');
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    void load();
    return () => { ignore = true };
  }, [partnerContextId, months]);

  const monthKeys = useMemo(() => Array.from({ length: months }, (_, i) => `mois_${i + 1}`), [months]);
  const moisLabels = rows[0]?.mois_labels ?? [];

  return (
    <div className="card overflow-hidden animate-fade-in">
      <div className="card-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Meilleures POS</h2>
          <p className="text-xs text-slate-500">
            Classement par Loading (Total décroissant) — chaque colonne Loading affiche la valeur réelle du mois concerné.
            Total = somme, Moyenne = total / N, Valeurs cumulées &amp; % cumulé calculés dans l'ordre du classement.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <label htmlFor="sales-months" className="text-xs text-slate-500">Période</label>
          <select
            id="sales-months"
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          >
            {[3, 6, 9, 12].map((m) => (
              <option key={m} value={m}>{m} mois</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-10"><LoadingSpinner label="Chargement des meilleures POS…" /></div>
      ) : error ? (
        <div className="p-6"><ErrorState title="Erreur de chargement" message={error} onRetry={() => setMonths((m) => m)} /></div>
      ) : rows.length === 0 ? (
        <p className="p-8 text-center text-sm text-slate-400">Aucune donnée disponible pour la période sélectionnée.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">N°</th>
                <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Numéro DSM</th>
                <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Numéro POS</th>
                {monthKeys.map((k, i) => {
                  const label = moisLabels[i] ? `Loading ${monthLabelFromIso(moisLabels[i])}` : `Loading M${i + 1}`;
                  return (
                    <th key={k} className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {label}
                    </th>
                  );
                })}
                <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-indigo-600">Total</th>
                <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Moyenne</th>
                <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Valeurs cumulées</th>
                <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">% cumulé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((r) => (
                <tr key={r.numero} className="table-row-hover transition-colors">
                  <td className="whitespace-nowrap px-3 py-2.5 text-sm font-semibold tabular-nums text-slate-500">{r.numero}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-sm text-slate-600">{r.numero_dsm ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-sm font-medium text-slate-800">{r.numero_pos}</td>
                  {monthKeys.map((k) => (
                    <td key={k} className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums text-slate-600">{formatVal(r[k])}</td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm font-bold tabular-nums text-slate-900">{formatVal(r.total)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-slate-700">{formatVal(r.moyenne)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums font-medium text-slate-700">{formatVal(r.valeur_cumulee)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums text-slate-600">{formatPct(r.pct_cumule)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SalesTableCard;
