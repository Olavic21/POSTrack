import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/Common/PageHeader/PageHeader';
import LoadingSpinner from '../../components/Common/LoadingSpinner/LoadingSpinner';
import ErrorState from '../../components/Common/ErrorState/ErrorState';
import SalesProgressCard from '../../components/Sales/SalesProgressCard';
import LoadingSummaryCard from '../../components/Sales/LoadingSummaryCard';
import MonthlyTableCard from '../../components/Sales/MonthlyTableCard';
import DSMSummaryCard from '../../components/Sales/DSMSummaryCard';
import MonthlyTrendChart from '../../components/Sales/MonthlyTrendChart';
import DSMPerformanceChart from '../../components/Sales/DSMPerformanceChart';
import SalesTableCard from '../../components/Sales/SalesTableCard';

import ChartCard from '../../components/Dashboard/ChartCard';
import analyticsService from '../../services/analyticsService';
import usePartner from '../../hooks/usePartner';

const formatInt = (value) =>
  value === null || value === undefined
    ? 'Non renseigné'
    : new Intl.NumberFormat('fr-FR').format(Number(value));

/**
 * Module « Suivi des ventes » — module indépendant de la sidebar
 * pour l'analyse détaillée des performances commerciales du partenaire actif.
 *
 * Ce module fournit une vue complète sur trois niveaux :
 *   - Niveau partenaire : objectifs, réalisations et progressions globales
 *   - Niveau DSM : analyse détaillée des performances par DSM
 *   - Niveau temporel : tableau mensuel des prévisions et réalisations
 *
 * Composition de composants existants :
 *   - SalesProgressCard  (progressions création/redéploiement/sell-out/loading)
 *   - LoadingSummaryCard (loading + détail par DSM, filtre période)
 *   - DSMSummaryCard     (performances complètes par DSM)
 *   - MonthlyTableCard   (tableau mensuel prévisions/réalisations)
 * et des objectifs mensuels issus de /analytics/sales-targets.
 */
const SuiviVentesPage = () => {
  const { partnerContextId } = usePartner();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [targets, setTargets] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(null);
  const [monthlyTable, setMonthlyTable] = useState(null);
  const [stats, setStats] = useState(null);
  const [loadingPeriod, setLoadingPeriod] = useState({});
  const [dsmSummary, setDsmSummary] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!partnerContextId) throw new Error('Aucun partenaire sélectionné.');
      const [summaryRes, targetsRes, loadingRes, monthlyRes, statsRes, dsmRes] =
        await Promise.all([
          analyticsService.getSalesSummary(partnerContextId),
          analyticsService.listSalesTargets(partnerContextId),
          analyticsService.getLoadingSummary(partnerContextId, loadingPeriod),
          analyticsService.getMonthlyTable(partnerContextId),
          analyticsService.getDashboard(partnerContextId),
          analyticsService.getDSMSummary(partnerContextId),
        ]);
      setSummary(summaryRes.data ?? null);
      setTargets(targetsRes.data?.items ?? []);
      setLoadingSummary(loadingRes.data ?? null);
      setMonthlyTable(monthlyRes.data ?? null);
      setStats(statsRes.data ?? null);
      setDsmSummary(dsmRes.data ?? null);
    } catch (err) {
      setError(err?.apiMessage || err?.message || 'Impossible de charger le suivi des ventes.');
    } finally {
      setLoading(false);
    }
  }, [loadingPeriod, partnerContextId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const stocksFinaux = useMemo(() => {
    const compute = (block) => {
      if (!block || block.stock_initial == null) return null;
      return Math.max(0, Number(block.stock_initial) - Number(block.cumul ?? 0));
    };
    return {
      creation: compute(summary?.creation),
      redeploiement: compute(summary?.redeploiement),
    };
  }, [summary]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Suivi des ventes" subtitle="Analyse détaillée des performances commerciales." />
        <LoadingSpinner label="Chargement du suivi des ventes…" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Suivi des ventes" subtitle="Analyse détaillée des performances commerciales." />
        <ErrorState title="Erreur de chargement" message={error} onRetry={fetchAll} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suivi des ventes"
        subtitle="Module indépendant d'analyse des performances commerciales par partenaire, DSM et période."
        breadcrumbs={['Espace partenaire', 'Suivi des ventes']}
      />

      {/* Objectifs mensuels (référentiel sales-targets) */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-slate-900">Objectifs de vente</h2>
          <p className="text-sm text-slate-500">
            Objectifs de création, de redéploiement SIM, sell-out, loading et stocks initiaux par mois.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Mois</th>
                <th className="px-4 py-3 text-left">Obj. création</th>
                <th className="px-4 py-3 text-left">Obj. redéploiement SIM</th>
                <th className="px-4 py-3 text-left">Sell-out</th>
                <th className="px-4 py-3 text-left">Loading</th>
                <th className="px-4 py-3 text-left">Stock initial création</th>
                <th className="px-4 py-3 text-left">Stock initial redéploiement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {targets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    Aucun objectif défini pour ce partenaire.
                  </td>
                </tr>
              ) : (
                [...targets]
                  .sort((a, b) => String(a.month).localeCompare(String(b.month)))
                  .map((t) => (
                    <tr key={t.id}>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{t.month}</td>
                      <td className="px-4 py-3">{formatInt(t.creation_target)}</td>
                      <td className="px-4 py-3">{formatInt(t.redeployment_target)}</td>
                      <td className="px-4 py-3">{formatInt(t.sell_out_target)}</td>
                      <td className="px-4 py-3">{formatInt(t.loading_target)}</td>
                      <td className="px-4 py-3">{formatInt(t.creation_stock_initial)}</td>
                      <td className="px-4 py-3">{formatInt(t.redeployment_stock_initial)}</td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Progressions par bloc (composant existant) */}
      <SalesProgressCard data={summary} />

      {/* Stocks finaux calculés (initial - cumul consommé) */}
      <section className="grid gap-3 sm:grid-cols-2">
        {[
          ['Stock final création', stocksFinaux.creation, 'Stock initial − cumul POS créés.'],
          ['Stock final redéploiement', stocksFinaux.redeploiement, 'Stock initial − cumul redéployés.'],
        ].map(([label, value, hint]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">{label}</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {value === null ? 'Non renseigné' : formatInt(value)}
            </div>
            <p className="mt-1 text-xs text-slate-400">{hint}</p>
          </div>
        ))}
      </section>

      {/* Recettes : distinction entre primes et recettes de vente */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Recettes</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Recettes de vente (chiffre d'affaires) - donnée manquante identifiée */}
          <div className="rounded-lg bg-blue-50 p-4">
            <div className="text-sm text-slate-500">Objectif vente global</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {summary?.revenue_global?.objectif != null
                ? `${formatInt(summary.revenue_global.objectif)} FCFA`
                : 'Non renseigné'}
            </div>
            <p className="mt-1 text-xs text-slate-400">Objectif de chiffre d'affaires</p>
          </div>
          <div className="rounded-lg bg-blue-50 p-4">
            <div className="text-sm text-slate-500">Réalisation vente</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {summary?.revenue_global?.realisation != null
                ? `${formatInt(summary.revenue_global.realisation)} FCFA`
                : 'Donnée non disponible'}
            </div>
            <p className="mt-1 text-xs text-slate-400">Chiffre d'affaires réalisé</p>
          </div>
          <div className="rounded-lg bg-blue-50 p-4">
            <div className="text-sm text-slate-500">Progression vente</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {summary?.revenue_global?.progression != null
                ? `${summary.revenue_global.progression.toFixed(1)}%`
                : 'Non calculable'}
            </div>
            <p className="mt-1 text-xs text-slate-400">Progression vs objectif</p>
          </div>
          
          {/* Primes (indicateur différent des recettes de vente) */}
          <div className="rounded-lg bg-emerald-50 p-4">
            <div className="text-sm text-slate-500">Montant primes période</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {stats?.montant_primes_periode != null
                ? `${Number(stats.montant_primes_periode).toLocaleString('fr-FR')} FCFA`
                : 'Non renseigné'}
            </div>
            <p className="mt-1 text-xs text-slate-400">Récompenses versées (différent du CA)</p>
          </div>
        </div>
        
        <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          <strong>Note :</strong> Les recettes de vente (chiffre d'affaires) sont actuellement non disponibles. 
          Voir <code>RECETTES_DATA_SOURCE.md</code> pour les données source nécessaires. 
          Les primes affichées sont des récompenses, pas le chiffre d'affaires.
        </div>
      </section>

      {/* ── Graphiques analytiques ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Tendance Sell-out" subtitle="Prévision vs réalisation mensuelle">
          <MonthlyTrendChart
            rows={monthlyTable?.sell_out?.rows}
            title="Sell-out"
          />
        </ChartCard>
        <ChartCard title="Tendance Création" subtitle="Prévision vs réalisation mensuelle">
          <MonthlyTrendChart
            rows={monthlyTable?.creation?.rows}
            title="Création"
          />
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Performance par DSM" subtitle="Objectifs vs réalisations">
          <DSMPerformanceChart data={dsmSummary} />
        </ChartCard>
        <ChartCard title="Tendance Loading" subtitle="Prévision vs réalisation mensuelle">
          <MonthlyTrendChart
            rows={monthlyTable?.loading?.rows}
            title="Loading"
          />
        </ChartCard>
      </div>

      {/* Loading + tableau mensuel (composants existants) */}
      <LoadingSummaryCard data={loadingSummary} onPeriodChange={setLoadingPeriod} />
      
      {/* Performances par DSM (tableau détaillé) */}
      <DSMSummaryCard data={dsmSummary} />
      
      <MonthlyTableCard data={monthlyTable} />

      {/* Tableau des ventes détaillé (backend /analytics/sales/table) */}
      <SalesTableCard />
    </div>
  );
};

export default SuiviVentesPage;
