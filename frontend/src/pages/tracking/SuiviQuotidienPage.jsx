import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/Common/PageHeader/PageHeader';
import LoadingSpinner from '../../components/Common/LoadingSpinner/LoadingSpinner';
import ErrorState from '../../components/Common/ErrorState/ErrorState';
import analyticsService from '../../services/analyticsService';
import { dsmService } from '../../services/dsmService';
import posService from '../../services/posService';
import usePartner from '../../hooks/usePartner';
import EmptyStatePremium from '../../components/ui/EmptyStatePremium';

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
  const [posList, setPosList] = useState([]);
  const [formPosId, setFormPosId] = useState('');
  const [formRevenue, setFormRevenue] = useState('');
  const [formStockValue, setFormStockValue] = useState('');
  const [formActiveSims, setFormActiveSims] = useState('');
  const [formClients, setFormClients] = useState('');
  const [formDate, setFormDate] = useState(todayIso());
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      if (!partnerContextId) return;
      try {
        const res = await dsmService.getAll({ limit: 500 });
        if (!ignore) setDsms(res.data?.items ?? []);
      } catch { if (!ignore) setDsms([]); }
    };
    void load();
    return () => { ignore = true };
  }, [partnerContextId]);

  useEffect(() => {
    let ignore = false;
    const loadPos = async () => {
      if (!partnerContextId) { setPosList([]); return; }
      try {
        const params = { limit: 200 };
        if (dsmId) params.dsm_id = Number(dsmId);
        const res = await posService.getAll(params);
        const items = res.data?.items ?? res.data ?? [];
        if (!ignore) setPosList(Array.isArray(items) ? items : []);
      } catch { if (!ignore) setPosList([]); }
    };
    void loadPos();
    return () => { ignore = true };
  }, [partnerContextId, dsmId]);

  const fetchDaily = useCallback(async () => {
    if (!partnerContextId) { setRows([]); setLoading(false); return; }
    try {
      setLoading(true); setError(null);
      const params = { date };
      if (dsmId) params.dsm_id = Number(dsmId);
      const res = await analyticsService.getDailyTracking(partnerContextId, params);
      const data = res.data ?? [];
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.apiMessage || err?.response?.data?.detail || 'Impossible de charger le suivi quotidien.');
    } finally { setLoading(false); }
  }, [partnerContextId, date, dsmId]);

  useEffect(() => { void fetchDaily(); }, [fetchDaily]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null); setFormSuccess(null);
    if (!formPosId) { setFormError('Veuillez sélectionner un POS.'); return; }
    if (!formDate) { setFormError('La date est obligatoire.'); return; }
    const payload = {
      pos_id: Number(formPosId),
      date: formDate,
      revenue: formRevenue === '' ? 0 : Number(formRevenue),
      stock_value: formStockValue === '' ? 0 : Number(formStockValue),
      active_sims_count: formActiveSims === '' ? 0 : Number(formActiveSims),
      clients_count: formClients === '' ? 0 : Number(formClients),
    };
    if (Number.isNaN(payload.revenue) || payload.revenue < 0) { setFormError('Revenus invalide.'); return; }
    if (Number.isNaN(payload.stock_value) || payload.stock_value < 0) { setFormError('Sell-out invalide.'); return; }
    try {
      setFormLoading(true);
      if (editingId) {
        await analyticsService.updateDailyTracking(partnerContextId, editingId, {
          revenue: payload.revenue, stock_value: payload.stock_value, active_sims_count: payload.active_sims_count, clients_count: payload.clients_count,
        });
        setFormSuccess('Saisie mise à jour.');
        setEditingId(null);
      } else {
        await analyticsService.createDailyTracking(partnerContextId, payload);
        setFormSuccess('Saisie enregistrée.');
      }
      setFormPosId(''); setFormRevenue(''); setFormStockValue(''); setFormActiveSims(''); setFormClients('');
      setFormDate(todayIso());
      await fetchDaily();
    } catch (err) {
      setFormError(err?.apiMessage || err?.response?.data?.detail || 'Erreur lors de l\'enregistrement.');
    } finally { setFormLoading(false); }
  };

  const handleEdit = (row) => {
    setEditingId(row.id);
    setFormPosId(String(row.pos_id ?? ''));
    setFormDate(row.date ?? row.period_start ?? todayIso());
    setFormRevenue(String(row.revenue ?? row.loading ?? ''));
    setFormStockValue(String(row.stock_value ?? row.sell_out ?? ''));
    setFormActiveSims(String(row.active_sims_count ?? ''));
    setFormClients(String(row.clients_count ?? ''));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const handleDelete = async (row) => {
    if (!confirm(`Supprimer la saisie du POS #${row.pos_id} du ${row.date} ?`)) return;
    try {
      await analyticsService.deleteDailyTracking(partnerContextId, row.id);
      setFormSuccess('Saisie supprimée.');
      await fetchDaily();
    } catch (err) { setFormError(err?.apiMessage || err?.response?.data?.detail || 'Erreur suppression.'); }
  };
  const cancelEdit = () => {
    setEditingId(null); setFormPosId(''); setFormRevenue(''); setFormStockValue(''); setFormActiveSims(''); setFormClients(''); setFormDate(todayIso()); setFormError(null); setFormSuccess(null);
  };

  if (error) {
    return (
      <div>
        <PageHeader title="Suivi quotidien" subtitle="Données quotidiennes par POS et par date." breadcrumbs={['Espace partenaire', 'Suivi quotidien']} />
        <ErrorState title="Erreur de chargement" message={error} onRetry={fetchDaily} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Suivi quotidien" subtitle="Saisie et consultation des données quotidiennes." breadcrumbs={['Espace partenaire', 'Suivi quotidien']} eyebrow="Opérations" />

      <div className="card p-4 flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="track-date" className="label">Date</label>
          <input id="track-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        </div>
        <div className="min-w-[180px]">
          <label htmlFor="track-dsm" className="label">DSM</label>
          <select id="track-dsm" value={dsmId} onChange={(e) => setDsmId(e.target.value)} className="select">
            <option value="">Tous les DSM</option>
            {dsms.map((d) => <option key={d.id} value={String(d.id)}>{d.full_name || d.zone || `DSM #${d.id}`}</option>)}
          </select>
        </div>
        <div className="ml-auto">
          <button type="button" onClick={() => void fetchDaily()} className="btn btn-secondary">Actualiser</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{editingId ? 'Modifier la saisie' : 'Nouvelle saisie'}</h3>
            <p className="text-xs text-slate-500">Une saisie par POS et par date.</p>
          </div>
          {editingId ? <button type="button" onClick={cancelEdit} className="text-xs font-semibold text-slate-500 hover:text-slate-700">Annuler</button> : null}
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="form-pos" className="label">POS *</label>
              <select id="form-pos" value={formPosId} onChange={(e) => setFormPosId(e.target.value)} disabled={!!editingId} className="select disabled:bg-slate-100" required>
                <option value="">Sélectionner un POS…</option>
                {posList.map((p) => <option key={p.id} value={String(p.id)}>{p.code_pos} — {p.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="form-date" className="label">Date *</label>
              <input id="form-date" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} disabled={!!editingId} className="input disabled:bg-slate-100" required />
            </div>
            <div>
              <label htmlFor="form-revenue" className="label">Revenu (FCFA)</label>
              <input id="form-revenue" type="number" min="0" step="0.01" value={formRevenue} onChange={(e) => setFormRevenue(e.target.value)} placeholder="0" className="input" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="form-stock" className="label">Sell-out (FCFA)</label>
              <input id="form-stock" type="number" min="0" step="0.01" value={formStockValue} onChange={(e) => setFormStockValue(e.target.value)} placeholder="0" className="input" />
            </div>
            <div>
              <label htmlFor="form-sims" className="label">SIM actives</label>
              <input id="form-sims" type="number" min="0" step="1" value={formActiveSims} onChange={(e) => setFormActiveSims(e.target.value)} placeholder="0" className="input" />
            </div>
            <div>
              <label htmlFor="form-clients" className="label">Clients</label>
              <input id="form-clients" type="number" min="0" step="1" value={formClients} onChange={(e) => setFormClients(e.target.value)} placeholder="0" className="input" />
            </div>
          </div>
          {formError ? <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{formError}</div> : null}
          {formSuccess ? <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">{formSuccess}</div> : null}
          <div className="flex gap-2">
            <button type="submit" disabled={formLoading} className="btn btn-primary">{formLoading ? 'Enregistrement…' : editingId ? 'Mettre à jour' : 'Enregistrer'}</button>
            {editingId ? <button type="button" onClick={cancelEdit} className="btn btn-secondary">Annuler</button> : null}
          </div>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
        {[
          ['Sell-out', totals.sell_out],
          ['Loading', totals.loading],
          ['Création', totals.creation],
          ['Reconduction', totals.reconduction],
          ['Fiab. création', totals.fiab_creation],
          ['Fiab. redéploiem.', totals.fiab_redeploiement],
          ['Cumul achat', totals.cumul_achat],
          ['Réalisation', totals.realisation],
          ['Cumul réal.', totals.cumul_realisation],
        ].map(([label, value]) => (
          <div key={label} className="card p-4">
            <p className="kpi-label text-slate-500">{label}</p>
            <p className="kpi-value mt-1 text-slate-900">{loading ? '…' : fmtInt(value)}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Détail — {date}</h3>
          <span className="rounded-full bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">{loading ? '…' : `${rows.length} lignes`}</span>
        </div>
        {loading ? (
          <div className="p-10"><LoadingSpinner label="Chargement…" /></div>
        ) : rows.length === 0 ? (
          <div className="p-8"><EmptyStatePremium compact title="Aucune donnée" description="Aucune saisie pour cette date. Créez une nouvelle saisie ci-dessus." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {['POS', 'DSM', 'Sell-out', 'Loading', 'Création', 'Reconduction', 'Fiab. création', 'Fiab. redépl.', 'Cumul achat', 'Réalisation', 'Cumul réal.', 'Statut', 'Actions'].map((h) => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={`${r.id ?? r.pos_id}-${idx}`}>
                    <td className="font-semibold text-slate-900">{r.pos_id ?? '—'}</td>
                    <td className="text-slate-600">{r.dsm_id ?? '—'}</td>
                    <td className="text-right tabular-nums">{fmtInt(r.sell_out)}</td>
                    <td className="text-right tabular-nums">{fmtInt(r.loading)}</td>
                    <td className="text-right tabular-nums">{fmtInt(r.creation)}</td>
                    <td className="text-right tabular-nums">{fmtInt(r.reconduction)}</td>
                    <td className="text-right tabular-nums">{fmtInt(r.fiabilisation_creation ?? r.fiab_creation)}</td>
                    <td className="text-right tabular-nums">{fmtInt(r.fiabilisation_redeploiement ?? r.fiab_redeploiement)}</td>
                    <td className="text-right tabular-nums">{fmtInt(r.cumul_achat)}</td>
                    <td className="text-right tabular-nums">{fmtInt(r.realisation)}</td>
                    <td className="text-right tabular-nums">{fmtInt(r.cumul_realisation)}</td>
                    <td><span className="badge badge-gray badge-sm">{r.statut ?? '—'}</span></td>
                    <td>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => handleEdit(r)} className="btn btn-secondary btn-sm">Modifier</button>
                        <button type="button" onClick={() => void handleDelete(r)} className="btn btn-ghost btn-sm text-red-600 hover:bg-red-50">Supprimer</button>
                      </div>
                    </td>
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
