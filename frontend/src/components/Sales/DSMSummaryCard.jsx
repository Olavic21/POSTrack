import React, { useMemo } from 'react';

const formatValue = (value) => {
  if (value === null || value === undefined) return 'Non renseigné';
  return new Intl.NumberFormat('fr-FR').format(Number(value));
};

const formatPct = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'Non renseigné';
  return `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.min(100, Math.max(0, Number(value))))} %`;
};

const formatCurrency = (value) => {
  if (value === null || value === undefined) return 'Non renseigné';
  return `${new Intl.NumberFormat('fr-FR').format(Number(value))} FCFA`;
};

const DSMSummaryCard = ({ data }) => {
  const dsmRows = useMemo(() => Array.isArray(data?.by_dsm) ? data.by_dsm : [], [data]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Performances par DSM</h2>
        <p className="text-sm text-slate-500">
          Loading = montant vendu par les POS • Sell-out = montant doté par le DSM aux POS • Recettes = chiffre d'affaires des POS.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">DSM</th>
              <th className="px-4 py-3 text-left">Objectif création</th>
              <th className="px-4 py-3 text-left">Réalisation création</th>
              <th className="px-4 py-3 text-left">Objectif redéploiement</th>
              <th className="px-4 py-3 text-left">Réalisation redéploiement</th>
              <th className="px-4 py-3 text-left">Loading</th>
              <th className="px-4 py-3 text-left">Sell-out</th>
              <th className="px-4 py-3 text-left">Recettes</th>
              <th className="px-4 py-3 text-left">Progression globale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {dsmRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                  Aucune donnée DSM disponible
                </td>
              </tr>
            ) : (
              dsmRows.map((row) => (
                <tr key={row.dsm_id}>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                    {row.dsm_name || row.dsm_code || `DSM #${row.dsm_id}`}
                  </td>
                  <td className="px-4 py-3">{formatValue(row.objectif_creation)}</td>
                  <td className="px-4 py-3">{formatValue(row.realisation_creation)}</td>
                  <td className="px-4 py-3">{formatValue(row.objectif_redeploiement)}</td>
                  <td className="px-4 py-3">{formatValue(row.realisation_redeploiement)}</td>
                  <td className="px-4 py-3">{formatCurrency(row.loading)}</td>
                  <td className="px-4 py-3">{formatCurrency(row.sell_out)}</td>
                  <td className="px-4 py-3">
                    {row.recettes != null ? formatCurrency(row.recettes) : (
                      <span className="text-amber-600 italic">Donnée non disponible</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{formatPct(row.progression_globale)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 rounded-lg bg-sky-50 p-3 text-xs text-sky-800">
        <strong>Montants en FCFA :</strong> le loading correspond au montant vendu par les POS,
        le sell-out au montant que le DSM a donné aux POS, et les recettes au chiffre d'affaires
        réalisé par les POS sur la période.
      </div>
    </section>
  );
};

export default DSMSummaryCard;