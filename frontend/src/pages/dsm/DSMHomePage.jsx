import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import usePartner from '../../hooks/usePartner';
import analyticsService from '../../services/analyticsService';
import dsmService from '../../services/dsmService';

const Tile = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
    <div className="mt-2 text-sm font-semibold text-slate-900">{value ?? '—'}</div>
  </div>
);

export default function DSMHomePage() {
  const navigate = useNavigate();
  const { partnerContextId } = usePartner();
  const [dsm, setDsm] = useState(null);
  const [stats, setStats] = useState(null);
  const [dsms, setDsms] = useState([]);
  const [selectedDsmId, setSelectedDsmId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError('');

        const dsmsRes = await dsmService.getAll({ limit: 100 });
        const list = dsmsRes?.data?.items || [];

        if (!list.length) {
          setDsms([]);
          setSelectedDsmId('');
          setDsm(null);
          setStats(null);
          setError('Aucun DSM n’est disponible pour ce partenaire.');
          return;
        }

        if (!active) return;
        setDsms(list);

        const rawDsmId = localStorage.getItem('dsm_id');
        const defaultMatch = rawDsmId
          ? list.find((item) => String(item.id) === String(rawDsmId) || item.matricule === rawDsmId || item.full_name === rawDsmId || item.nom === rawDsmId)
          : null;

        const initialDsm = defaultMatch || list[0];
        setSelectedDsmId(String(initialDsm.id));

        const [dsmRes, dashboardRes] = await Promise.all([
          dsmService.getById(initialDsm.id),
          analyticsService.getDashboard(partnerContextId, initialDsm.id),
        ]);

        if (!active) return;
        setDsm(dsmRes.data);
        setStats(dashboardRes.data);
      } catch (e) {
        if (!active) return;
        setError(e?.apiMessage || e?.message || 'Impossible de charger le tableau de bord DSM.');
        setDsm(null);
        setStats(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, [partnerContextId]);

  const handleSelectDsm = async (event) => {
    const nextId = event.target.value;
    setSelectedDsmId(nextId);
    setLoading(true);
    setError('');
    try {
      const [dsmRes, dashboardRes] = await Promise.all([
        dsmService.getById(nextId),
        analyticsService.getDashboard(partnerContextId, nextId),
      ]);
      setDsm(dsmRes.data);
      setStats(dashboardRes.data);
    } catch (e) {
      setError(e?.apiMessage || e?.message || 'Impossible de charger ce DSM.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-slate-600">Chargement du DSM...</div>;
  if (error || !dsm) return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error || 'DSM introuvable.'}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dsm.nom}</h1>
          <p className="mt-1 text-sm text-slate-600">Vue DSM filtrée sur son périmètre.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-700">
            DSM
            <select
              value={selectedDsmId}
              onChange={handleSelectDsm}
              className="ml-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {dsms.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nom || item.full_name || `DSM #${item.id}`}{item.matricule ? ` — ${item.matricule}` : ''}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => navigate('/dsm')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Retour</button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Parc POS" value={stats?.pos_total} />
        <Tile label="POS actifs" value={(stats?.pos_nouveau || 0) + (stats?.pos_reconduit || 0)} />
        <Tile label="BTS" value={stats?.bts_saturees} />
        <Tile label="Requêtes en cours" value={stats?.requetes_ouvertes} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Données DSM</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Tile label="Nom" value={dsm.nom} />
          <Tile label="Matricule" value={dsm.matricule} />
          <Tile label="Email" value={dsm.email} />
          <Tile label="Micro-zone" value={dsm.micro_zone || dsm.region || dsm.zone} />
          <Tile label="Statut" value={dsm.statut} />
          <Tile label="Téléphone" value={dsm.telephone} />
        </div>
      </div>
    </div>
  );
}