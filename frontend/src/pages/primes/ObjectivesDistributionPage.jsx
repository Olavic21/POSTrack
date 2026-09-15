import { useEffect, useState } from 'react';
import usePartner from '../../hooks/usePartner';
import primeService from '../../services/primeService';

const formatInt = (v) => {
  if (v === null || v === undefined) return '0';
  return new Intl.NumberFormat('fr-FR').format(v);
};

const formatCurrency = (v) => {
  if (v === null || v === undefined) return '0 FCFA';
  return `${new Intl.NumberFormat('fr-FR').format(Number(v))} FCFA`;
};

const formatPct = (v) => {
  if (v === null || v === undefined || isNaN(Number(v))) return '—';
  return `${Number(v).toFixed(1)} %`;
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

  // Fetch periods
  useEffect(() => {
    if (!partnerContextId) return;
    let ignore = false;
    const load = async () => {
      try {
        const res = await primeService.getPeriods(partnerContextId);
        const data = res.data?.items ?? res.data ?? [];
        if (!ignore) {
          setPeriods(Array.isArray(data) ? data : []);
        }
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
      // Objectifs globaux : si aucun objectif encore distribué, utiliser les défauts métier 200* nbDSM / 500k* nbDSM
      // Sinon, répartir à partir des totaux déjà en base via summary ; fallback 200/500k par DSM si vide
      const dsmCountFallback = 1;
      const globalCreation = summary?.global_creation_target || summary?.total_creation_target || 200 * dsmCountFallback;
      const globalRevenue = summary?.global_revenue_target || summary?.total_revenue_target || 500000 * dsmCountFallback;
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
      const reason = window.prompt('Motif de la modification manuelle (optionnel) :', '') || undefined;
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
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Objectifs DSM par période</h1>
        <p className="mt-1 text-sm text-slate-500">
          Objectif global (ex : 200 POS × nb DSM, 500 000 FCFA × nb DSM) → distribution automatique pondérée par coefficient de micro-zone → objectif final par DSM (éditable avec traçabilité).
        </p>
        <p className="mt-1 text-xs text-amber-600">Objectif final retenu = valeur affichée ci-dessous. Badge <span className="inline-flex rounded bg-slate-100 px-1 font-semibold">AUTO</span> = issu de la distribution ; <span className="inline-flex rounded bg-amber-100 px-1 font-semibold text-amber-700">MANUEL</span> = écrasé manuellement (conserve valeur auto dans audit).</p>
      </div>

      {/* Period selector */}
      <div className="card overflow-hidden animate-fade-in stagger-1">
        <div className="card-header flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Période</h2>
            <p className="text-xs text-slate-500">Sélectionnez une période pour gérer les objectifs.</p>
          </div>
          <select
            value={selectedPeriod?.id || ''}
            onChange={(e) => {
              const p = periods.find((pp) => pp.id === Number(e.target.value));
              setSelectedPeriod(p || null);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">— Sélectionner —</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>{p.code} — {p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary + distribute button */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 animate-fade-in stagger-2">
          <div className="card overflow-hidden border-l-[3px] border-l-indigo-500 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0176d3]">Obj. Création Global</p>
            <p className="mt-1 text-xl font-extrabold text-slate-900">{formatInt(summary.global_creation_target)} POS</p>
            <p className="text-xs text-slate-400">Réalisé : {formatInt(summary.global_creation_realized)}</p>
          </div>
          <div className="card overflow-hidden border-l-[3px] border-l-emerald-500 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#2e844a]">Obj. Revenus Global</p>
            <p className="mt-1 text-xl font-extrabold text-slate-900">{formatCurrency(summary.global_revenue_target)}</p>
            <p className="text-xs text-slate-400">Réalisé : {formatCurrency(summary.global_revenue_realized)}</p>
          </div>
          <div className="card overflow-hidden border-l-[3px] border-l-amber-500 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#c23934]">Total Objectifs DSM</p>
            <p className="mt-1 text-xl font-extrabold text-slate-900">{objectives.length} DSM</p>
            <div className="mt-2">
              <button
                type="button"
                onClick={handleDistribute}
                disabled={distributing || !selectedPeriod}
                className="btn btn-primary btn-sm w-full"
              >
                {distributing ? 'Distribution…' : 'Distribuer automatiquement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Objectives table */}
      <div className="card overflow-hidden animate-fade-in stagger-3">
        <div className="card-header">
          <h3 className="text-lg font-bold text-slate-900">Objectifs par DSM — objectif final retenu</h3>
          <p className="text-xs text-slate-500">
            Cliquez sur une valeur pour la modifier manuellement (motif demandé, badge MANUEL, audit conservé).
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">DSM</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Micro Zone</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Coefficient</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Obj. Création (final)</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Obj. Revenus 1ère recharge (final)</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">Chargement…</td>
                </tr>
              ) : objectives.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                    Aucun objectif distribué. Sélectionnez une période et cliquez « Distribuer automatiquement ». Formule : objectif DSM = global × coef / Σcoef (arrondi, dernier DSM ajuste).
                  </td>
                </tr>
              ) : (
                <>
                  {objectives.map((obj) => {
                    const isManual = obj.updated_at && obj.created_at && new Date(obj.updated_at).getTime() - new Date(obj.created_at).getTime() > 1000;
                    return (
                    <tr key={obj.id} className="table-row-hover transition-colors">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
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
                              className="w-24 rounded border border-blue-300 px-2 py-1 text-sm text-right"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleEditSave();
                                if (e.key === 'Escape') handleEditCancel();
                              }}
                            />
                            <button onClick={handleEditSave} disabled={saving} className="text-xs font-medium text-emerald-600">OK</button>
                            <button onClick={handleEditCancel} className="text-xs font-medium text-slate-400">✕</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEditStart(obj, 'creation_objective')}
                            className="cursor-pointer rounded px-2 py-0.5 text-right tabular-nums hover:bg-blue-50"
                            title="Cliquer pour modifier"
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
                              className="w-32 rounded border border-blue-300 px-2 py-1 text-sm text-right"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleEditSave();
                                if (e.key === 'Escape') handleEditCancel();
                              }}
                            />
                            <button onClick={handleEditSave} disabled={saving} className="text-xs font-medium text-emerald-600">OK</button>
                            <button onClick={handleEditCancel} className="text-xs font-medium text-slate-400">✕</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEditStart(obj, 'revenue_objective')}
                            className="cursor-pointer rounded px-2 py-0.5 text-right tabular-nums hover:bg-blue-50"
                            title="Cliquer pour modifier — motif demandé"
                          >
                            {formatCurrency(obj.revenue_objective)}
                          </button>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        {isManual ? <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700" title={obj.updated_at ? `Modifié le ${new Date(obj.updated_at).toLocaleString('fr-FR')}` : ''}>MANUEL</span> : <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">AUTO</span>}
                      </td>
                    </tr>
                    );
                  })}
                  <tr className="bg-slate-50 font-semibold">
                    <td colSpan={3} className="px-4 py-3 text-right text-xs uppercase tracking-wider text-slate-500">Total distribué (Σ objectifs finaux)</td>
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
