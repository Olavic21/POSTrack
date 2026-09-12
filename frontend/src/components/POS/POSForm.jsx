import { useState, useEffect } from 'react';

const STATUTS = ['ACTIF', 'RENOUVELLEMENT', 'SUSPENDU', 'CLOTURE'];

const EMPTY_POS = {
  code_pos: '',
  nom: '',
  adresse: '',
  ville: '',
  region: '',
  latitude: '',
  longitude: '',
  partenaire_id: '',
  dsm_id: '',
  type: 'NOUVEAU', // toujours NOUVEAU à la création — jamais un choix utilisateur
  statut: 'ACTIF',
  date_creation: '',
  date_expiration: '',
  contact_principal: '',
  telephone: '',
  email_contact: '',
  notes: '',
};

/**
 * POSForm — création/édition d'un POS.
 *
 * Règle métier : le type (NOUVEAU/RECONDUIT) n'est JAMAIS un champ éditable
 * ici. À la création il vaut toujours NOUVEAU. En édition il est affiché en
 * lecture seule — seul le module Reconductions peut le faire passer à
 * RECONDUIT (hors périmètre de ce formulaire).
 */
export default function POSForm({
  initialData,
  partenaires = [],
  dsms = [],
  onSubmit,
  onCancel,
  submitting = false,
}) {
  const [form, setForm] = useState({ ...EMPTY_POS, ...initialData });
  const [errors, setErrors] = useState({});
  const isEdit = Boolean(initialData?.code_pos);

  useEffect(() => {
    if (initialData) setForm({ ...EMPTY_POS, ...initialData });
  }, [initialData]);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const validate = () => {
    const next = {};
    if (!form.nom.trim()) next.nom = 'Le nom du POS est requis.';
    if (!form.partenaire_id) next.partenaire_id = 'Sélectionnez un Partenaire actif.';
    if (!form.dsm_id) next.dsm_id = 'Sélectionnez un DSM actif.';
    if (!form.adresse.trim()) next.adresse = "L'adresse est requise.";
    if (!form.ville.trim()) next.ville = 'La ville est requise.';
    if (form.latitude !== '' && Number.isNaN(Number(form.latitude))) next.latitude = 'Latitude invalide.';
    if (form.longitude !== '' && Number.isNaN(Number(form.longitude))) next.longitude = 'Longitude invalide.';
    if (!form.date_creation) next.date_creation = 'La date de prise en portefeuille est requise.';
    if (!form.date_expiration) next.date_expiration = "La date d'expiration est requise.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    // Le type n'est jamais envoyé en édition — le backend le gère via /reconductions
    const { type, ...payload } = form;
    const normalized = {
      ...payload,
      latitude: payload.latitude === '' ? null : Number(payload.latitude),
      longitude: payload.longitude === '' ? null : Number(payload.longitude),
    };
    onSubmit?.(isEdit ? normalized : normalized);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Informations POS
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isEdit && (
            <Field label="Identifiant POS">
              <input value={form.code_pos} disabled className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm text-gray-500" />
            </Field>
          )}

          <Field label="Nom du POS" error={errors.nom}>
            <input
              value={form.nom}
              onChange={(e) => update('nom', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </Field>

          <Field label="Partenaire" error={errors.partenaire_id}>
            <select
              value={form.partenaire_id}
              onChange={(e) => update('partenaire_id', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Sélectionner...</option>
              {partenaires.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </Field>

          <Field label="DSM" error={errors.dsm_id}>
            <select
              value={form.dsm_id}
              onChange={(e) => update('dsm_id', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Sélectionner...</option>
              {dsms.map((d) => <option key={d.id} value={d.id}>{d.nom_complet}</option>)}
            </select>
          </Field>

          <Field label="Type">
            {/* Lecture seule : le type n'est modifiable que via une reconduction */}
            <div className="flex items-center gap-2">
              <span className={`w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm ${form.type === 'RECONDUIT' ? 'text-gray-500' : 'font-medium text-emerald-700'}`}>
                {form.type}
              </span>
            </div>
          </Field>

          <Field label="Statut">
            <select
              value={form.statut}
              onChange={(e) => update('statut', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          <Field label="Date de prise en portefeuille" error={errors.date_creation}>
            <input
              type="date"
              value={form.date_creation}
              onChange={(e) => update('date_creation', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </Field>

          <Field label="Date d'expiration" error={errors.date_expiration}>
            <input
              type="date"
              value={form.date_expiration}
              onChange={(e) => update('date_expiration', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </Field>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Localisation
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Adresse" error={errors.adresse}>
            <input
              value={form.adresse}
              onChange={(e) => update('adresse', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </Field>
          <Field label="Ville" error={errors.ville}>
            <input
              value={form.ville}
              onChange={(e) => update('ville', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </Field>
          <Field label="Micro-zone">
            <input
              value={form.region}
              onChange={(e) => update('region', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </Field>
          <Field label="Latitude" error={errors.latitude}>
            <input
              type="number"
              step="any"
              value={form.latitude}
              onChange={(e) => update('latitude', e.target.value)}
              placeholder="Ex: 4.0511"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </Field>
          <Field label="Longitude" error={errors.longitude}>
            <input
              type="number"
              step="any"
              value={form.longitude}
              onChange={(e) => update('longitude', e.target.value)}
              placeholder="Ex: 9.7679"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </Field>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Champs complémentaires
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Contact principal">
            <input
              value={form.contact_principal}
              onChange={(e) => update('contact_principal', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </Field>
          <Field label="Téléphone">
            <input
              value={form.telephone}
              onChange={(e) => update('telephone', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </Field>
          <Field label="Email contact">
            <input
              type="email"
              value={form.email_contact}
              onChange={(e) => update('email_contact', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </Field>
          <Field label="Notes">
            <input
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </Field>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-gray-700">{label}</span>
      {children}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  );
}