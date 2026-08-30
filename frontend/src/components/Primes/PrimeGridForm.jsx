import React, { useState } from 'react';

const PrimeGridForm = ({ initialData, onSubmit, onCancel, loading = false }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [gridType, setGridType] = useState(initialData?.grid_type || 'CREATION');
  const [thresholds, setThresholds] = useState(
    initialData?.thresholds?.length
      ? initialData.thresholds.map((t) => ({
          min_pct: t.min_pct ?? '',
          max_pct: t.max_pct ?? '',
          amount: t.amount ?? '',
        }))
      : [
          { min_pct: 0, max_pct: 74.99, amount: 0 },
          { min_pct: 75, max_pct: 84.99, amount: 10000 },
          { min_pct: 85, max_pct: 94.99, amount: 20000 },
          { min_pct: 95, max_pct: 99.99, amount: 30000 },
          { min_pct: 100, max_pct: '', amount: 40000 },
        ]
  );

  const addThreshold = () => {
    const lastMax = thresholds.length > 0 ? thresholds[thresholds.length - 1].max_pct : 0;
    setThresholds([...thresholds, { min_pct: lastMax || 0, max_pct: '', amount: 0 }]);
  };

  const removeThreshold = (index) => {
    setThresholds(thresholds.filter((_, i) => i !== index));
  };

  const updateThreshold = (index, field, value) => {
    const updated = [...thresholds];
    updated[index] = { ...updated[index], [field]: value };
    setThresholds(updated);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      name,
      grid_type: gridType,
      thresholds: thresholds.map((t) => ({
        min_pct: parseFloat(t.min_pct) || 0,
        max_pct: t.max_pct !== '' && t.max_pct !== null ? parseFloat(t.max_pct) : null,
        amount: parseFloat(t.amount) || 0,
      })),
    };
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nom de la grille</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            placeholder="Ex: Grille standard 2026"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Type de grille</label>
          <select
            value={gridType}
            onChange={(e) => setGridType(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          >
            <option value="CREATION">Création de POS (montant fixe FCFA)</option>
            <option value="REVENUE">Revenus (% du revenu réel)</option>
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-semibold text-slate-700">Paliers de prime</label>
          <button type="button" onClick={addThreshold} className="text-xs font-medium text-brand-600 hover:text-brand-800">
            + Ajouter un palier
          </button>
        </div>
        <div className="space-y-2">
          {thresholds.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="number"
                value={t.min_pct}
                onChange={(e) => updateThreshold(i, 'min_pct', e.target.value)}
                className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="Min %"
                step="0.01"
              />
              <span className="text-slate-400">à</span>
              <input
                type="number"
                value={t.max_pct}
                onChange={(e) => updateThreshold(i, 'max_pct', e.target.value)}
                className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="Max %"
                step="0.01"
              />
              <span className="text-slate-400">→</span>
              <input
                type="number"
                value={t.amount}
                onChange={(e) => updateThreshold(i, 'amount', e.target.value)}
                className="w-32 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                placeholder={gridType === 'REVENUE' ? '% du revenu' : 'Montant FCFA'}
                step="0.01"
              />
              <span className="text-xs text-slate-400 w-16">
                {gridType === 'REVENUE' ? '%' : 'FCFA'}
              </span>
              {thresholds.length > 1 && (
                <button type="button" onClick={() => removeThreshold(i)} className="text-red-400 hover:text-red-600 text-sm">
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-secondary btn-sm">
            Annuler
          </button>
        )}
        <button type="submit" disabled={loading || !name} className="btn btn-primary btn-sm">
          {loading ? 'Enregistrement…' : initialData ? 'Mettre à jour' : 'Créer la grille'}
        </button>
      </div>
    </form>
  );
};

export default PrimeGridForm;
