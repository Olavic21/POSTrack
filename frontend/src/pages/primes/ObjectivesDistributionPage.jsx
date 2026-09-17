import { useEffect, useState } from 'react';
import usePartner from '../../hooks/usePartner';
import primeService from '../../services/primeService';
import PageHeader from '../../components/Common/PageHeader/PageHeader';

const formatInt = (v) => {
  if (v === null || v === undefined) return '0';
  return new Intl.NumberFormat('fr-FR').format(v);
};

const formatCurrency = (v) => {
  if (v === null || v === undefined) return '—';
  return `${new Intl.NumberFormat('fr-FR').format(Number(v))} FCFA`;
};

export default function ObjectivesDistributionPage() {
  const { partnerContextId } = usePartner();
  const [objectives, setObjectives] = useState([]);
  const [summary, setSummary] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [distributing, setDistributing] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!partnerContextId) return;
    let ignore = false;
    const load = async () => {
      try {
        const res = await primeService.getPeriods(partnerContextId);
        const data = res.data?.items ?? res.data ?? [];
        if (!ignore) setPeriods(Array.isArray(data) ? data : []);
      } catch {
        if (!ignore) setPeriods([]);
      }
    };
    void load();
    return () => { ignore = true; };
  }, [partnerContextId]);

  const fetchObjectives = async () => {
    if (!partnerContextId || !selectedPeriod) {
      setObjectives([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await primeService.getObjectives(partnerContextId, { prime_period_id: selectedPeriod.id });
      const data = res.data?.items ?? res.data ?? [];
      setObjectives(Array.isArray(data) ? data : []);
    } catch {
      setObjectives([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    if (!partnerContextId || !selectedPeriod) {
      setSummary(null);
      return;
    }
    try {
      const res = await primeService.getObjectivesSummary(partnerContextId, { prime_period_id: selectedPeriod.id });
      setSummary(res.data);
    } catch {
      setSummary(null);
    }
  };

  useEffect(() => {
    fetchObjectives();
    fetchSummary();
  }, [partnerContextId, selectedPeriod]);

  const handleDistribute = async () => {
    if (!selectedPeriod) {
      alert('Veuillez sélectionner une période.');
      return;
    }
    setDistributing(true);
    try {
      const currentDsmCount = summary?.dsm_count || objectives.length || 59;
      const globalCreation = summary?.global_creation_target ?? summary?.total_creation_target ?? currentDsmCount * 2;
      const globalRevenue = summary?.global_revenue_target ?? summary?.total_revenue_target ?? 500000 * currentDsmCount;
      await primeService.distributeObjectives(partnerContextId, {
        prime_period_id: selectedPeriod.id,
        global_creation_target: globalCreation,
        global_revenue_target: globalRevenue,
      });
      await fetchObjectives();
      await fetchSummary();
    } catch (err) {
      alert(err?.response?.data?.detail || 'Erreur lors de la distribution.');
    } finally {
      setDistributing(false);
    }
  };

  const handleEditStart = (obj, field) => {
    setEditing({ id: obj.id, field });
    setEditValue(String(obj[field] ?? ''));
  };

  const handleEditSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const reason = window.prompt('Motif de la modification (optionnel) :', '') || undefined;
      const payload = { [editing.field]: parseFloat(editValue) || 0, ...(reason ? { reason } : {}) };
      await primeService.updateObjective(partnerContextId, editing.id, payload);
      setEditing(null);
      await fetchObjectives();
      await fetchSummary();
    } catch (err) {
      alert(err?.response?.data?.detail || 'Erreur lors de la mise à jour.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditCancel = () => {
    setEditing(null);
    setEditValue('');
  };

  const totalCreationObj = objectives.reduce((s, o) => s + (o.creation_objective || 0), 0);
  const totalRevenueObj = objectives.reduce((s, o) => s + (o.revenue_objective || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Objectifs DSM par période"
        subtitle="Distribution pondérée par micro-zone — 2 POS / DSM et 500 000 FCFA / DSM. Objectif final éditable avec traçabilité."
        breadcrumbs={['Primes', 'Objectifs DSM']}
        eyebrow="Administration"
        actions={
          selectedPeriod ? (
            <button type="button" onClick={handleDistribute} disabled={distributing} className="btn btn-primary">
              {distributing ? 'Distribution…' : 'Distribuer automatiquement'}
            </button>
          ) : null
        }
      />

      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">Période</p>
          <p className="text-xs text-slate-500">Sélectionnez une période pour gérer les objectifs</p>
        </div>
        <select
          value={selectedPeriod?.id || ''}
          onChange={(e) => {
            const p = periods.find((pp) => pp.id === Number(e.target.value));
            setSelectedPeriod(p || null);
          }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm"
        >
          <option value="">— Sélectionner —</option>
          {periods.map((p) => (
            <option key={p.id} value={p.id}>{p.code} — {p.label}</option>
          ))}
        </select>
      </div>

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="card p-5">
            <p className="kpi-label text-indigo-600">Création — objectif global</p>
            <p className="kpi-value mt-2 text-slate-900">{formatInt(summary.global_creation_target)} POS</p>
            <p className="kpi-sub">Réalisé : {formatInt(summary.global_creation_realized)}</p>
          </div>
          <div className="card p-5">
            <p className="kpi-label text-emerald-600">Revenus — objectif global</p>
            <p className="kpi-value mt-2 text-slate-900">{formatCurrency(summary.global_revenue_target)}</p>
            <p className="kpi-sub">Réalisé : {formatCurrency(summary.global_revenue_realized)}</p>
          </div>
          <div className="card p-5 flex flex-col justify-center">
            <p className="kpi-label text-slate-500">DSM concernés</p>
            <p className="kpi-value mt-2 text-slate-900">{objectives.length}</p>
            <p className="kpi-sub">{formatInt(totalCreationObj)} POS • {formatCurrency(totalRevenueObj)}</p>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="p-5 flex items-center justify-between border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Objectifs par DSM</h3>
            <p className="text-xs text-slate-500">Cliquez sur une valeur pour la modifier • Badge AUTO / MANUEL</p>
          </div>
          <span className="rounded-full bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">{objectives.length} DSM</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">DSM</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Micro Zone</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Coefficient</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Création</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Revenus 1ère recharge</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">Chargement…</td>
                </tr>
              ) : objectives.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <p className="text-sm font-semibold text-slate-700">Aucun objectif distribué</p>
                    <p className="mt-1 text-xs text-slate-500">Sélectionnez une période et lancez la distribution automatique.</p>
                  </td>
                </tr>
              ) : (
                <>
                  {objectives.map((obj) => {
                    const isManual = obj.updated_at && obj.created_at && new Date(obj.updated_at).getTime() - new Date(obj.created_at).getTime() > 1000;
                    return (
                    <tr key={obj.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                        {obj.dsm_name || `DSM #${obj.dsm_id}`}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{obj.micro_zone_name || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{obj.potential_coefficient ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {editing?.id === obj.id && editing.field === 'creation_objective' ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-24 rounded-xl border border-indigo-300 px-2 py-1.5 text-sm text-right focus:ring-2 focus:ring-indigo-100"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleEditSave();
                                if (e.key === 'Escape') handleEditCancel();
                              }}
                            />
                            <button onClick={handleEditSave} disabled={saving} className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white">OK</button>
                            <button onClick={handleEditCancel} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">✕</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEditStart(obj, 'creation_objective')}
                            className="rounded-xl px-2 py-1 text-right tabular-nums hover:bg-indigo-50 font-semibold text-slate-900"
                          >
                            {formatInt(obj.creation_objective)} POS
                          </button>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {editing?.id === obj.id && editing.field === 'revenue_objective' ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-32 rounded-xl border border-indigo-300 px-2 py-1.5 text-sm text-right focus:ring-2 focus:ring-indigo-100"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleEditSave();
                                if (e.key === 'Escape') handleEditCancel();
                              }}
                            />
                            <button onClick={handleEditSave} disabled={saving} className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white">OK</button>
                            <button onClick={handleEditCancel} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">✕</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEditStart(obj, 'revenue_objective')}
                            className="rounded-xl px-2 py-1 text-right tabular-nums hover:bg-indigo-50 font-semibold text-slate-900"
                          >
                            {formatCurrency(obj.revenue_objective)}
                          </button>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        {isManual ? <span className="inline-flex rounded-full bg-amber-100 border border-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-700">MANUEL</span> : <span className="inline-flex rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-600">AUTO</span>}
                      </td>
                    </tr>
                    );
                  })}
                  <tr className="bg-slate-50 font-bold">
                    <td colSpan={3} className="px-4 py-3 text-right text-xs uppercase tracking-wide text-slate-500">Total distribué</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatInt(totalCreationObj)} POS</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(totalRevenueObj)}</td>
                    <td></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
