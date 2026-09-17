// @ts-nocheck
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import usePartner from '../../hooks/usePartner';
import dsmService from '../../services/dsmService';
import PageHeader from '../../components/Common/PageHeader/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import EmptyStatePremium from '../../components/ui/EmptyStatePremium';
import { useI18n } from '../../i18n';

const DSMRow = ({ dsm, onClick, onViewDetails, t }) => (
  <div
    onClick={() => onClick(dsm.id)}
    className="card card-hover cursor-pointer p-5"
  >
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100 text-xs font-extrabold text-indigo-700">
            {(dsm.full_name || dsm.nom || 'D').slice(0,2).toUpperCase()}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 truncate">{dsm.full_name || dsm.nom || `DSM #${dsm.id}`}</h3>
            <p className="text-xs text-slate-500">{dsm.matricule || '—'} • {dsm.zone || dsm.micro_zone || t('common_no_data')}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={(e) => { e.stopPropagation(); onViewDetails(dsm.id); }} className="btn btn-secondary btn-sm">{t('dsm_detail')}</button>
        <span className="text-xs font-bold text-indigo-600">POS →</span>
      </div>
    </div>
    <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
      {[
        [t('dsm_pos_created'), dsm.nb_pos_crees ?? 0],
        [t('dsm_pos_active'), dsm.nb_pos_actifs ?? 0],
        [t('dsm_pos_linked'), dsm.nb_pos_linkes ?? 0],
        [t('dsm_pos_unlinked'), dsm.nb_pos_delinkes ?? 0],
        [t('dsm_loading'), dsm.loading ?? 0],
        [t('dsm_sellout'), dsm.sell_out ?? 0],
      ].map(([label, val]) => (
        <div key={label} className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-sm font-extrabold text-slate-900">{new Intl.NumberFormat('fr-FR').format(val)}</p>
        </div>
      ))}
    </div>
    {dsm.progression != null ? (
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1"><span>{t('dsm_progress')}</span><span className="font-bold text-slate-700">{dsm.progression}%</span></div>
        <div className="progress-track"><div className="progress-fill bg-indigo-500" style={{ width: `${Math.min(100, dsm.progression)}%` }} /></div>
      </div>
    ) : null}
  </div>
);

const formatInt = (v) => v == null ? '0' : new Intl.NumberFormat('fr-FR').format(v);
const formatCurrency = (v) => v == null ? '—' : `${new Intl.NumberFormat('fr-FR').format(v)} FCFA`;

export default function DSMDashboardPage() {
  const navigate = useNavigate();
  const { partnerContextId } = usePartner();
  const { t } = useI18n();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('nb_pos_crees');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      try {
        setLoading(true); setError('');
        const response = await dsmService.getDashboard();
        if (!active) return;
        setDashboardData(response.data);
      } catch (e) {
        if (!active) return;
        setError(e?.apiMessage || e?.message || 'Erreur');
        setDashboardData(null);
      } finally { if (active) setLoading(false); }
    };
    void loadDashboard();
    return () => { active = false; };
  }, [partnerContextId]);

  const handleDSMClick = (dsmId) => navigate(`/dsm/${dsmId}/pos`);
  const handleViewDetails = (dsmId) => navigate(`/dsm/${dsmId}`);
  const handleSort = (field) => {
    if (sortBy === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortOrder('desc'); }
  };

  const filteredAndSortedDSMs = () => {
    if (!dashboardData?.dsms) return [];
    let filtered = [...dashboardData.dsms];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(dsm => (dsm.full_name || '').toLowerCase().includes(term) || (dsm.matricule || '').toLowerCase().includes(term) || (dsm.zone || '').toLowerCase().includes(term));
    }
    filtered.sort((a, b) => {
      let c = 0;
      switch (sortBy) {
        case 'full_name': c = (a.full_name || '').localeCompare(b.full_name || ''); break;
        case 'matricule': c = (a.matricule || '').localeCompare(b.matricule || ''); break;
        case 'nb_pos_crees': c = (a.nb_pos_crees || 0) - (b.nb_pos_crees || 0); break;
        case 'nb_pos_actifs': c = (a.nb_pos_actifs || 0) - (b.nb_pos_actifs || 0); break;
        case 'loading': c = (a.loading || 0) - (b.loading || 0); break;
        case 'sell_out': c = (a.sell_out || 0) - (b.sell_out || 0); break;
        case 'recettes': c = (a.recettes || 0) - (b.recettes || 0); break;
        case 'requetes': c = (a.requetes_total || a.requetes || 0) - (b.requetes_total || b.requetes || 0); break;
        default: c = 0;
      }
      return sortOrder === 'asc' ? c : -c;
    });
    return filtered;
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" /></div>;
  }
  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800"><p className="font-bold">Erreur</p><p className="mt-1 text-sm">{error}</p></div>;
  }
  if (!dashboardData) return null;

  const filteredDSMs = filteredAndSortedDSMs();
  const gs = dashboardData.global_stats || {};
  const si = dashboardData.stocks_initiaux || {};
  const am = dashboardData.activite_mensuelle || {};
  const sf = dashboardData.stocks_finaux || {};
  const rq = dashboardData.requetes || {};
  const sim = dashboardData.sim || {};
  const perf = dashboardData.performance || {};
  const prime = dashboardData.prime || {};

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('dsm_dashboard')}
        subtitle={`${t('common_partner')} — ${dashboardData.total_dsm || 0} DSM`}
        breadcrumbs={[t('nav_dsm'), t('dsm_dashboard')]}
        eyebrow={t('nav_dsm')}
        actions={<button type="button" onClick={() => navigate('/dsm/new')} className="btn btn-primary">+ {t('dsm_new')}</button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={t('dsm_pos_created')} value={formatInt(gs.total_pos_crees)} tone="brand" />
        <KpiCard label={t('dsm_pos_active')} value={formatInt(gs.total_pos_actifs)} tone="success" />
        <KpiCard label="Loading" value={formatInt(gs.total_loading)} tone="info" />
        <KpiCard label="Sell-out" value={formatInt(gs.total_sell_out)} tone="warning" />
      </div>

      {/* Stocks initiaux — restauré reconduction */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card p-5 border-l-4 border-l-sky-500">
          <p className="kpi-label text-sky-600">Stocks initiaux</p>
          <div className="mt-3 space-y-2">
            <div className="flex justify-between"><span className="text-sm text-slate-600">Stock initial POS création</span><span className="font-bold">{formatInt(si.creation)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-600">Stock initial POS reconduction</span><span className="font-bold">{formatInt(si.reconduction)}</span></div>
          </div>
        </div>
        <div className="card p-5 border-l-4 border-l-indigo-500">
          <p className="kpi-label text-indigo-600">Activité mensuelle</p>
          <div className="mt-3 space-y-2">
            <div className="flex justify-between"><span className="text-sm text-slate-600">Création mensuelle</span><span className="font-bold">{formatInt(am.creation)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-600">Redéploiement mensuel</span><span className="font-bold">{formatInt(am.redeploiement)}</span></div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card p-5 border-l-4 border-l-emerald-500">
          <p className="kpi-label text-emerald-600">Stocks finaux</p>
          <div className="mt-3 space-y-2">
            <div className="flex justify-between"><span className="text-sm text-slate-600">Stock final création</span><span className="font-bold">{formatInt(sf.creation)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-600">Stock final reconduction</span><span className="font-bold">{formatInt(sf.reconduction)}</span></div>
          </div>
        </div>
        <div className="card p-5 border-l-4 border-l-amber-500">
          <p className="kpi-label text-amber-600">Requêtes en cours</p>
          <div className="mt-3 space-y-2">
            <div className="flex justify-between"><span className="text-sm text-slate-600">Requêtes traitées</span><span className="font-bold text-emerald-700">{formatInt(rq.traitees)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-600">Requêtes non traitées</span><span className="font-bold text-amber-700">{formatInt(rq.non_traitees)}</span></div>
          </div>
          <p className="mt-2 text-[10px] text-slate-400">traitée = effectue+rejete ≥ demande</p>
        </div>
      </div>

      {/* SIM linkées / délinkées — restauré */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card p-5 border-l-4 border-l-emerald-500">
          <p className="kpi-label text-emerald-600">SIM linkées</p>
          <p className="mt-3 text-2xl font-extrabold text-slate-900">{formatInt(sim['linkées'] ?? sim.linkees ?? sim.linked ?? 0)}</p>
          <p className="mt-1 text-xs text-slate-400">POS.holder_user_id IS NOT NULL</p>
        </div>
        <div className="card p-5 border-l-4 border-l-amber-500">
          <p className="kpi-label text-amber-600">SIM délinkées</p>
          <p className="mt-3 text-2xl font-extrabold text-slate-900">{formatInt(sim['delinkées'] ?? sim.delinkees ?? sim.unlinked ?? 0)}</p>
          <p className="mt-1 text-xs text-slate-400">POS.holder_user_id IS NULL</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <h3 className="text-sm font-bold text-slate-900">Performance</h3>
          <div className="mt-4 space-y-3">
            <div className="flex justify-between"><span className="text-sm text-slate-500">Sell-out</span><span className="font-bold">{formatInt(perf.sell_out)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">Loading</span><span className="font-bold">{formatInt(perf.loading)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">Recettes</span><span className="font-bold">{formatCurrency(gs.total_recettes)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">Prime période</span><span className="font-bold text-indigo-700">{formatCurrency(prime.periode)}</span></div>
          </div>
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-bold text-slate-900">Prime validée</h3>
          <div className="mt-4 space-y-3">
            <div className="flex justify-between"><span className="text-sm text-slate-500">Prime validée</span><span className="font-bold text-emerald-700">{formatCurrency(prime.validee)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">Prime période</span><span className="font-bold">{formatCurrency(prime.periode)}</span></div>
          </div>
        </div>
      </div>
      {/* Indicateurs globaux — 6 colonnes restaurées (total_requetes inclus) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="card p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total POS créés</p><p className="mt-2 text-xl font-bold text-slate-900">{gs.total_pos_crees ?? '—'}</p></div>
        <div className="card p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total POS actifs</p><p className="mt-2 text-xl font-bold text-slate-900">{gs.total_pos_actifs ?? '—'}</p></div>
        <div className="card p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Loading</p><p className="mt-2 text-xl font-bold text-slate-900">{gs.total_loading ?? '—'}</p></div>
        <div className="card p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Sell-out</p><p className="mt-2 text-xl font-bold text-slate-900">{gs.total_sell_out ?? '—'}</p></div>
        <div className="card p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Recettes</p><p className="mt-2 text-xl font-bold text-slate-900">{formatCurrency(gs.total_recettes)}</p></div>
        <div className="card p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Requêtes</p><p className="mt-2 text-xl font-bold text-slate-900">{gs.total_requetes ?? '—'}</p></div>
      </div>

      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px]">
          <label className="label">{t('common_search')}</label>
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={t('dsm_search_placeholder')} className="input" />
        </div>
        <div>
          <label className="label">{t('dsm_sort_by')}</label>
          <div className="flex gap-2">
            <select value={sortBy} onChange={(e) => handleSort(e.target.value)} className="select">
              <option value="nb_pos_crees">{t('dsm_pos_created')}</option>
              <option value="nb_pos_actifs">{t('dsm_pos_active')}</option>
              <option value="loading">Loading</option>
              <option value="sell_out">Sell-out</option>
              <option value="recettes">Recettes</option>
              <option value="requetes">Requêtes</option>
              <option value="full_name">Nom</option>
              <option value="matricule">Code</option>
            </select>
            <button type="button" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="btn btn-secondary">{sortOrder === 'asc' ? '↑' : '↓'}</button>
          </div>
        </div>
        <div className="ml-auto text-xs text-slate-500">{filteredDSMs.length} DSM</div>
      </div>

      {filteredDSMs.length === 0 ? (
        <EmptyStatePremium title={searchTerm ? t('dsm_no_search') : t('dsm_no_data')} description={searchTerm ? '' : 'Créez un nouveau DSM pour commencer.'} />
      ) : (
        <div className="space-y-3">
          {filteredDSMs.map((dsm) => <DSMRow key={dsm.id} dsm={dsm} onClick={handleDSMClick} onViewDetails={handleViewDetails} t={t} />)}
        </div>
      )}
    </div>
  );
}
