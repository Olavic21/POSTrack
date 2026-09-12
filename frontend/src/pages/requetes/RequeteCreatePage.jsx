import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/Common/PageHeader/PageHeader';
import Alert from '../../components/Common/Alert/Alert';
import requeteService from '../../services/requeteService';
import { ENTITES_EN_CHARGE } from '../../utils/constants';

const TYPES = [
  { value: 'AJOUT', label: 'Ajout POS' },
  { value: 'RECONDUCTION', label: 'Reconduction POS' },
  { value: 'DELINKAGE', label: 'Déliage POS' },
  { value: 'BASCULEMENT', label: 'Basculement POS' },
  { value: 'AUTRE', label: 'Autres' },
];

/**
 * Création d'une requête terrain (v3.4 §2.4) — avec menu déroulant
 * « Entité en charge » (valeur libre possible via « Autre… »).
 */
export default function RequeteCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    type_requete: 'AJOUT',
    titre: '',
    description: '',
    priorite: 'NORMALE',
    nombre_demande: 1,
    entite_en_charge: ENTITES_EN_CHARGE[0],
  });
  const [customEntite, setCustomEntite] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleEntiteChange = (value) => {
    if (value === '__autre__') {
      setCustomEntite(true);
      update('entite_en_charge', '');
    } else {
      setCustomEntite(false);
      setCustomValue('');
      update('entite_en_charge', value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const entiteFinale = customEntite ? customValue.trim() : form.entite_en_charge;
    if (!form.titre.trim()) {
      setError('Le titre de la requête est requis.');
      return;
    }
    if (!entiteFinale) {
      setError("L'entité en charge est requise.");
      return;
    }
    setSubmitting(true);
    try {
      await requeteService.create({
        type_requete: form.type_requete,
        titre: form.titre.trim(),
        description: form.description.trim() || null,
        priorite: form.priorite,
        nombre_demande: Number(form.nombre_demande) || 1,
        entite_en_charge: entiteFinale,
      });
      navigate('/requetes');
    } catch (err) {
      setError(err?.apiMessage || "Erreur lors de la création de la requête.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Ajouter nouvelle requête"
        subtitle="Remontée d'une demande terrain vers l'entité en charge."
        breadcrumbs={['Espace partenaire', 'Requêtes', 'Création']}
      />
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {error && <Alert type="error" message={error} onClose={() => setError('')} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Type de requête</span>
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.type_requete}
              onChange={(e) => update('type_requete', e.target.value)}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Priorité</span>
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.priorite}
              onChange={(e) => update('priorite', e.target.value)}>
              <option value="BASSE">Basse</option>
              <option value="NORMALE">Normale</option>
              <option value="HAUTE">Haute</option>
              <option value="URGENTE">Urgente</option>
            </select>
          </label>

          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Titre *</span>
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.titre} onChange={(e) => update('titre', e.target.value)}
              placeholder="Ex. Demande de reconduction" required />
          </label>

          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Description</span>
            <textarea rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.description} onChange={(e) => update('description', e.target.value)}
              placeholder="Détail de la demande (nombre de POS concernés, justification...)" />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Nombre demandé</span>
            <input type="number" min={1} className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.nombre_demande}
              onChange={(e) => update('nombre_demande', e.target.value)} />
          </label>

          {/* Entité en charge — menu déroulant (v3.4 §2.4) */}
          {!customEntite ? (
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Entité en charge *</span>
              <select className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={form.entite_en_charge}
                onChange={(e) => handleEntiteChange(e.target.value)}>
                {ENTITES_EN_CHARGE.map((entite) => (
                  <option key={entite} value={entite}>{entite}</option>
                ))}
                <option value="__autre__">Autre…</option>
              </select>
            </label>
          ) : (
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Entité en charge (libre)</span>
              <div className="flex gap-2">
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={customValue} onChange={(e) => setCustomValue(e.target.value)}
                  placeholder="Ex. AC Bonanjo" />
                <button type="button"
                  onClick={() => { setCustomEntite(false); update('entite_en_charge', ENTITES_EN_CHARGE[0]); }}
                  className="shrink-0 rounded-lg border border-slate-300 px-3 text-xs text-slate-600 hover:bg-slate-50">
                  Liste
                </button>
              </div>
            </label>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => navigate('/requetes')}
            className="rounded-lg border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Annuler
          </button>
          <button type="submit" disabled={submitting}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {submitting ? 'Envoi...' : 'Créer la requête'}
          </button>
        </div>
      </form>
    </div>
  );
}
