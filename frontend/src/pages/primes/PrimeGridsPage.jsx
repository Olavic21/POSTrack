import { useEffect, useState } from 'react';
import usePartner from '../../hooks/usePartner';
import primeService from '../../services/primeService';
import PrimeGridForm from '../../components/Primes/PrimeGridForm';

const formatCurrency = (v) => {
  if (v === null || v === undefined) return '0 FCFA';
  return `${new Intl.NumberFormat('fr-FR').format(Number(v))} FCFA`;
};

export default function PrimeGridsPage() {
  const { partnerContextId } = usePartner();
  const [grids, setGrids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editGrid, setEditGrid] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchGrids = async () => {
    if (!partnerContextId) return;
    try {
      const res = await primeService.getGrids(partnerContextId);
      const data = res.data?.items ?? res.data ?? [];
      setGrids(Array.isArray(data) ? data : []);
    } catch {
      setGrids([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrids();
  }, [partnerContextId]);

  const handleCreate = async (payload) => {
    setSaving(true);
    try {
      await primeService.createGrid(partnerContextId, payload);
      setShowForm(false);
      await fetchGrids();
    } catch (err) {
      alert(err?.response?.data?.detail || 'Erreur lors de la création.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (payload) => {
    if (!editGrid) return;
    setSaving(true);
    try {
      await primeService.updateGrid(partnerContextId, editGrid.id, payload);
      setEditGrid(null);
      await fetchGrids();
    } catch (err) {
      alert(err?.response?.data?.detail || 'Erreur lors de la mise à jour.');
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (gridId) => {
    try {
      await primeService.activateGrid(partnerContextId, gridId);
      await fetchGrids();
    } catch (err) {
      alert(err?.response?.data?.detail || "Erreur lors de l'activation.");
    }
  };

  const handleDelete = async (gridId) => {
    if (!window.confirm('Supprimer cette grille ?')) return;
    try {
      await primeService.deleteGrid(partnerContextId, gridId);
      await fetchGrids();
    } catch (err) {
      alert(err?.response?.data?.detail || 'Erreur lors de la suppression.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Grilles de primes</h1>
          <p className="mt-1 text-sm text-slate-500">Configuration des paliers de prime création (montant fixe) et revenus (% du revenu réel).</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm(true); setEditGrid(null); }}
          className="btn btn-primary btn-sm"
        >
          + Nouvelle grille
        </button>
      </div>

      {/* Form modal */}
      {(showForm || editGrid) && (
        <div className="card overflow-hidden animate-fade-in">
          <div className="card-header">
            <h3 className="text-lg font-bold text-slate-900">
              {editGrid ? `Modifier : ${editGrid.name}` : 'Nouvelle grille'}
            </h3>
          </div>
          <div className="p-5">
            <PrimeGridForm
              initialData={editGrid}
              onSubmit={editGrid ? handleUpdate : handleCreate}
              onCancel={() => { setShowForm(false); setEditGrid(null); }}
              loading={saving}
            />
          </div>
        </div>
      )}

      {/* Grids list */}
      <div className="card overflow-hidden animate-fade-in stagger-1">
        <div className="card-header">
          <h3 className="text-lg font-bold text-slate-900">Grilles configurées</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Nom</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Type</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Paliers</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">Chargement…</td>
                </tr>
              ) : grids.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                    Aucune grille configurée. Créez une nouvelle grille.
                  </td>
                </tr>
              ) : (
                grids.map((grid) => (
                  <tr key={grid.id} className="table-row-hover transition-colors">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{grid.name}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        grid.grid_type === 'CREATION' ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {grid.grid_type === 'CREATION' ? 'Création (FCFA)' : 'Revenus (%)'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">{grid.thresholds_count ?? grid.thresholds?.length ?? 0}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      {grid.is_active ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Active</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">Inactive</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!grid.is_active && (
                          <button onClick={() => handleActivate(grid.id)} className="text-xs font-medium text-emerald-600 hover:text-emerald-800">
                            Activer
                          </button>
                        )}
                        <button onClick={() => { setEditGrid(grid); setShowForm(false); }} className="text-xs font-medium text-blue-600 hover:text-blue-800">
                          Modifier
                        </button>
                        <button onClick={() => handleDelete(grid.id)} className="text-xs font-medium text-red-500 hover:text-red-700">
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
