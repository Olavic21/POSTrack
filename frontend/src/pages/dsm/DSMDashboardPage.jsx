import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import usePartner from '../../hooks/usePartner';
import dsmService from '../../services/dsmService';

const StatCard = ({ label, value, subLabel, accent = 'slate' }) => {
  const accents = {
    slate: 'border-l-slate-400',
    sky: 'border-l-sky-500',
    indigo: 'border-l-indigo-500',
    emerald: 'border-l-emerald-500',
    amber: 'border-l-amber-500',
    red: 'border-l-red-500',
  };
  return (
    <div className={`rounded-xl border border-slate-200 border-l-[3px] ${accents[accent]} bg-white p-4 shadow-sm`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value ?? '—'}</div>
      {subLabel && <div className="mt-1 text-xs text-slate-600">{subLabel}</div>}
    </div>
  );
};

const SectionCard = ({ title, accent = 'sky', children }) => {
  const accents = {
    sky: 'border-l-sky-500',
    indigo: 'border-l-indigo-500',
    emerald: 'border-l-emerald-500',
    amber: 'border-l-amber-500',
  };
  return (
    <div className={`card overflow-hidden border-l-[3px] ${accents[accent]}`}>
      <div className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0d9dd1]">{title}</p>
        <div className="mt-3 space-y-2">{children}</div>
      </div>
    </div>
  );
};

const DSMRow = ({ dsm, onClick, onViewDetails }) => (
  <div
    onClick={() => onClick(dsm.id)}
    className="cursor-pointer rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all"
  >
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <h3 className="text-lg font-semibold text-slate-900">
          {dsm.full_name || dsm.nom || `DSM #${dsm.id}`}
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Code: {dsm.matricule || 'N/A'} • Zone: {dsm.zone || dsm.micro_zone || 'Non renseigné'}
        </p>
      </div>
      <div className="ml-4 flex items-center gap-3">
        <button
          onClick={(e) => { e.stopPropagation(); onViewDetails(dsm.id); }}
          className="text-sm font-medium text-slate-600 hover:text-indigo-600"
        >
          Dashboard
        </button>
        <span className="text-indigo-600 hover:text-indigo-900 text-sm font-medium">
          POS →
        </span>
      </div>
    </div>
    
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      <div>
        <div className="text-xs text-slate-500">POS créés</div>
        <div className="text-sm font-semibold text-slate-900">{dsm.nb_pos_crees ?? 0}</div>
      </div>
      <div>
        <div className="text-xs text-slate-500">POS actifs</div>
        <div className="text-sm font-semibold text-slate-900">{dsm.nb_pos_actifs ?? 0}</div>
      </div>
      <div>
        <div className="text-xs text-slate-500">POS linkés</div>
        <div className="text-sm font-semibold text-emerald-600">{dsm.nb_pos_linkes ?? 0}</div>
      </div>
      <div>
        <div className="text-xs text-slate-500">POS délinkés</div>
        <div className="text-sm font-semibold text-amber-600">{dsm.nb_pos_delinkes ?? 0}</div>
      </div>
      <div>
        <div className="text-xs text-slate-500">Loading</div>
        <div className="text-sm font-semibold text-slate-900">{dsm.loading ?? 0}</div>
      </div>
      <div>
        <div className="text-xs text-slate-500">Sell-out</div>
        <div className="text-sm font-semibold text-slate-900">{dsm.sell_out ?? 0}</div>
      </div>
    </div>
    
    {dsm.progression !== null && dsm.progression !== undefined && (
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
          <span>Progression objectifs</span>
          <span>{dsm.progression}%</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div 
            className="bg-indigo-600 h-2 rounded-full transition-all"
            style={{ width: `${Math.min(100, dsm.progression)}%` }}
          />
        </div>
      </div>
    )}
  </div>
);

const formatInt = (v) => {
  if (v === null || v === undefined) return '0';
  return new Intl.NumberFormat('fr-FR').format(v);
};

const formatCurrency = (v) => {
  if (v === null || v === undefined) return '0 FCFA';
  return `${new Intl.NumberFormat('fr-FR').format(v)} FCFA`;
};

export default function DSMDashboardPage() {
  const navigate = useNavigate();
  const { partnerContextId } = usePartner();
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
        setLoading(true);
        setError('');
        const response = await dsmService.getDashboard();
        if (!active) return;
        setDashboardData(response.data);
      } catch (e) {
        if (!active) return;
        setError(e?.apiMessage || e?.message || 'Impossible de charger le dashboard DSM.');
        setDashboardData(null);
      } finally {
        if (active) setLoading(false);
      }
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
      filtered = filtered.filter(dsm =>
        (dsm.full_name || '').toLowerCase().includes(term) ||
        (dsm.matricule || '').toLowerCase().includes(term) ||
        (dsm.zone || '').toLowerCase().includes(term)
      );
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
        case 'requetes': c = (a.requetes_total || 0) - (b.requetes_total || 0); break;
        default: c = 0;
      }
      return sortOrder === 'asc' ? c : -c;
    });
    return filtered;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <span className="text-sm text-slate-400">Chargement du dashboard DSM...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
        <p className="font-medium">Erreur</p>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    );
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
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard DSM</h1>
          <p className="mt-1 text-sm text-slate-600">
            Vue globale des DSM du partenaire — {dashboardData.total_dsm || 0} DSM(s)
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/dsm/new')}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          + Nouveau DSM
        </button>
      </div>

      {/* ── Stocks initiaux ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 animate-fade-in stagger-1">
        <SectionCard title="Stocks initiaux" accent="sky">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Stock initial POS création</span>
            <span className="text-lg font-bold text-slate-900">{formatInt(si.creation)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Stock initial POS reconduction</span>
            <span className="text-lg font-bold text-slate-900">{formatInt(si.reconduction)}</span>
          </div>
        </SectionCard>
        <SectionCard title="Activité mensuelle" accent="indigo">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Création mensuelle</span>
            <span className="text-lg font-bold text-slate-900">{formatInt(am.creation)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Redéploiement mensuel</span>
            <span className="text-lg font-bold text-slate-900">{formatInt(am.redeploiement)}</span>
          </div>
        </SectionCard>
      </div>

      {/* ── Stocks finaux ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 animate-fade-in stagger-2">
        <SectionCard title="Stocks finaux" accent="emerald">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Stock final création</span>
            <span className="text-lg font-bold text-slate-900">{formatInt(sf.creation)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Stock final reconduction</span>
            <span className="text-lg font-bold text-slate-900">{formatInt(sf.reconduction)}</span>
          </div>
        </SectionCard>
        <SectionCard title="Requêtes en cours" accent="amber">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Requêtes traitées</span>
            <span className="text-lg font-bold text-emerald-700">{formatInt(rq.traitees)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Requêtes non traitées</span>
            <span className="text-lg font-bold text-amber-700">{formatInt(rq.non_traitees)}</span>
          </div>
        </SectionCard>
      </div>

      {/* ── SIM linkées / délinkées ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 animate-fade-in stagger-3">
        <SectionCard title="SIM linkées" accent="emerald">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">SIM linkées</span>
            <span className="text-lg font-bold text-slate-900">{formatInt(sim['linkées'])}</span>
          </div>
        </SectionCard>
        <SectionCard title="SIM délinkées" accent="amber">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">SIM délinkées</span>
            <span className="text-lg font-bold text-slate-900">{formatInt(sim['delinkées'])}</span>
          </div>
        </SectionCard>
      </div>

      {/* ── Performance ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 animate-fade-in stagger-4">
        <StatCard label="Sell-out global" value={formatInt(perf.sell_out)} accent="emerald" />
        <StatCard label="Loading global" value={formatInt(perf.loading)} accent="sky" />
      </div>

      {/* ── Primes ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 animate-fade-in stagger-5">
        <StatCard label="Prime période" value={formatCurrency(prime.periode)} accent="indigo" />
        <StatCard label="Prime validée" value={formatCurrency(prime.validee)} accent="emerald" />
      </div>

      {/* ── Indicateurs globaux ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 animate-fade-in stagger-6">
        <StatCard label="Total POS créés" value={gs.total_pos_crees} />
        <StatCard label="Total POS actifs" value={gs.total_pos_actifs} />
        <StatCard label="Total Loading" value={gs.total_loading} />
        <StatCard label="Total Sell-out" value={gs.total_sell_out} />
        <StatCard label="Total Recettes" value={formatCurrency(gs.total_recettes)} />
        <StatCard label="Total Requêtes" value={gs.total_requetes} />
      </div>

      {/* Filtres et recherche */}
      <div className="flex flex-wrap gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex-1 min-w-64">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par nom, code ou zone..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700">Trier par:</label>
          <select
            value={sortBy}
            onChange={(e) => handleSort(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="nb_pos_crees">POS créés</option>
            <option value="nb_pos_actifs">POS actifs</option>
            <option value="loading">Loading</option>
            <option value="sell_out">Sell-out</option>
            <option value="recettes">Recettes</option>
            <option value="requetes">Requêtes</option>
            <option value="full_name">Nom</option>
            <option value="matricule">Code</option>
          </select>
          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Liste des DSM */}
      {filteredDSMs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-slate-600">
            {searchTerm ? 'Aucun DSM ne correspond à votre recherche.' : 'Aucun DSM disponible pour ce partenaire.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDSMs.map((dsm) => (
            <DSMRow
              key={dsm.id}
              dsm={dsm}
              onClick={handleDSMClick}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      )}
    </div>
  );
}
