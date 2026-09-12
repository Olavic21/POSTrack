import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import posService from '../../services/posService';
import StatusBadge from '../../components/Common/StatusBadge';
import api from '../../services/api';

// Onglets qui pointent vers des modules intégrés à l'application.
const LIENS_EXTERNES = [
  { label: 'Primes', href: () => '/primes' },
  { label: 'SIM', href: () => '/sims' },
];

export default function POSDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [pos, setPos] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [reconductionDate, setReconductionDate] = useState('');
  const [reconductionMotif, setReconductionMotif] = useState('');
  const [simIccid, setSimIccid] = useState('');
  const [simLoading, setSimLoading] = useState(false);
  const [simStatus, setSimStatus] = useState('EN_STOCK');
  const [links, setLinks] = useState(null);
  const [linkUserId, setLinkUserId] = useState('');
  const [posSims, setPosSims] = useState([]);
  const [targetSimId, setTargetSimId] = useState('');
  const mapSectionId = 'pos-map-section';

  useEffect(() => {
    setStatus('loading');
    posService
      .getById(id)
      .then((res) => { setPos(res.data); setStatus('success'); })
      .catch(() => { setError('POS introuvable.'); setStatus('error'); });
  }, [id]);

  // Liens detenteur (User <-> POS) et SIMs rattachees a ce POS.
  const refreshLinkedData = useCallback(async () => {
    try {
      const linksRes = await api.get(`/pos/${id}/link`);
      setLinks(linksRes.data ?? null);
    } catch {
      setLinks(null);
    }
    try {
      const simsRes = await api.get('/sim', { params: { pos_id: Number(id), limit: 100 } });
      const list = simsRes.data?.items ?? simsRes.data?.data ?? [];
      setPosSims(list);
      setTargetSimId((current) =>
        list.some((s) => String(s.id) === String(current))
          ? current
          : (list[0]?.id != null ? String(list[0].id) : '')
      );
    } catch {
      setPosSims([]);
    }
  }, [id]);

  useEffect(() => { void refreshLinkedData(); }, [refreshLinkedData]);

  const handleStatusChange = async (statut) => {
    setChangingStatus(true);
    try {
      const res = await posService.changeStatus(id, statut);
      setPos(res.data);
    } finally {
      setChangingStatus(false);
    }
  };

  const handleReconduction = async () => {
    if (!reconductionDate) return;
    setActionError(null);
    setActionMessage(null);
    setChangingStatus(true);
    try {
      const res = await api.post(`/pos/${id}/reconduction`, {
        new_expiration: reconductionDate,
        motif: reconductionMotif || null,
      });
      setPos((current) => ({ ...current, type_pos: 'RECONDUIT', date_expiration: res.data?.new_expiration ?? reconductionDate }));
      setActionMessage('POS reconduit avec succès.');
    } catch (err) {
      setActionError(err?.apiMessage || err?.response?.data?.detail || 'Impossible de reconduire ce POS.');
    } finally {
      setChangingStatus(false);
    }
  };

  const handleCreateSim = async () => {
    if (!simIccid.trim()) return;
    setSimLoading(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await api.post('/sim', { pos_id: Number(id), iccid: simIccid.trim() });
      setActionMessage('SIM créée et liée à ce POS.');
      setSimIccid('');
      void refreshLinkedData();
    } catch (err) {
      setActionError(err?.apiMessage || err?.response?.data?.detail || 'Impossible de créer la SIM.');
    } finally {
      setSimLoading(false);
    }
  };

  const handleUpdateSimStatus = async (simId, status) => {
    setSimLoading(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await api.patch(`/sim/${simId}/status`, { status });
      setActionMessage(`SIM ${status.toLowerCase()} avec succès.`);
      void refreshLinkedData();
    } catch (err) {
      setActionError(err?.apiMessage || err?.response?.data?.detail || 'Impossible de modifier le statut de la SIM.');
    } finally {
      setSimLoading(false);
    }
  };

  const handleLink = async () => {
    if (!linkUserId.trim()) return;
    setActionError(null);
    setActionMessage(null);
    try {
      const res = await api.post(`/pos/${id}/link`, { user_id: Number(linkUserId) });
      setLinks(res.data ?? null);
      setActionMessage(`Utilisateur #${linkUserId} lié au POS (détenteur).`);
      setLinkUserId('');
    } catch (err) {
      setActionError(err?.apiMessage || err?.response?.data?.detail || 'Impossible de lier cet utilisateur au POS.');
    }
  };

  const handleUnlink = async () => {
    setActionError(null);
    setActionMessage(null);
    try {
      const res = await api.post(`/pos/${id}/unlink`, linkUserId.trim() ? { user_id: Number(linkUserId) } : {});
      setLinks(res.data ?? null);
      setActionMessage('Lien utilisateur ↔ POS retiré.');
      setLinkUserId('');
    } catch (err) {
      setActionError(err?.apiMessage || err?.response?.data?.detail || 'Impossible de délier ce POS.');
    }
  };

  const canReconduction = useMemo(() => pos?.type_pos !== 'RECONDUIT', [pos]);

  if (status === 'loading') return <p className="text-gray-400">Chargement...</p>;
  if (status === 'error') return <p className="text-red-600">{error}</p>;
  if (!pos) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400">Détail POS</p>
          <h1 className="text-2xl font-semibold text-gray-900">{pos.code_pos} — {pos.nom}</h1>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge statut={pos.statut} />
            <span className={`text-xs font-medium ${(pos.type_pos ?? pos.type) === 'RECONDUIT' ? 'text-gray-500' : 'text-emerald-700'}`}>
              {pos.type_pos ?? pos.type}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => document.getElementById(mapSectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="rounded-md border border-sky-300 px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50"
          >
            Ouvrir dans la carte
          </button>
          <button onClick={() => navigate(`/pos/${id}/edit`)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Modifier
          </button>
          {pos.statut === 'ACTIF' && (
            <button disabled={changingStatus} onClick={() => handleStatusChange('SUSPENDU')} className="rounded-md border border-amber-300 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50">
              Suspendre
            </button>
          )}
          {pos.statut !== 'CLOTURE' && (
            <button disabled={changingStatus} onClick={() => handleStatusChange('CLOTURE')} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
              Clôturer
            </button>
          )}
        </div>
      </div>

      {(actionMessage || actionError) && (
        <div className={`rounded-md px-4 py-3 text-sm ${actionError ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {actionError || actionMessage}
        </div>
      )}

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <InfoCard label="Partenaire" value={pos.partenaire?.nom ?? '—'} />
        <InfoCard label="DSM" value={pos.dsm?.nom_complet ?? '—'} />
        <InfoCard
          label="Coordonnées"
          value={<CoordinateBadge latitude={pos.latitude} longitude={pos.longitude} />}
        />
        <InfoCard label="Date de prise en portefeuille" value={pos.date_prise_en_portefeuille ?? pos.date_creation} />
        <InfoCard label="Date d'expiration" value={pos.date_expiration} />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Reconduction POS</h2>
          <div className="mt-4 space-y-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Nouvelle expiration</span>
              <input type="date" value={reconductionDate} onChange={(e) => setReconductionDate(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Motif</span>
              <input value={reconductionMotif} onChange={(e) => setReconductionMotif(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <button disabled={!canReconduction || changingStatus || !reconductionDate} onClick={handleReconduction} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              Reconduire le POS
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Actions SIM</h2>
          <div className="mt-4 space-y-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">ICCID</span>
              <input value={simIccid} onChange={(e) => setSimIccid(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <button disabled={simLoading || !simIccid.trim()} onClick={handleCreateSim} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              Créer SIM sur ce POS
            </button>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">SIM du POS ({posSims.length})</span>
              <select value={targetSimId} onChange={(e) => setTargetSimId(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="">— Aucune SIM —</option>
                {posSims.map((sim) => (
                  <option key={sim.id} value={String(sim.id)}>
                    {sim.iccid} · {sim.status ?? sim.statut}
                  </option>
                ))}
              </select>
            </label>
            <select value={simStatus} onChange={(e) => setSimStatus(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="EN_STOCK">EN_STOCK</option>
              <option value="ASSIGNEE">ASSIGNEE</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="RETOURNEE">RETOURNEE</option>
              <option value="PERDUE">PERDUE</option>
            </select>
            <button disabled={simLoading || !targetSimId} onClick={() => handleUpdateSimStatus(targetSimId, simStatus)} className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">
              Appliquer le statut à la SIM sélectionnée
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Lien / Délink (détenteur)</h2>
        <p className="mt-2 text-sm text-gray-600">
          Détenteur actuel : {links?.holder_user_id ? `utilisateur #${links.holder_user_id}` : 'aucun'}
          {links?.linked_users?.length ? ` · Liens UserPOS : ${links.linked_users.join(', ')}` : ''}
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">ID utilisateur cible</span>
            <input type="number" min="1" value={linkUserId} onChange={(e) => setLinkUserId(e.target.value)} placeholder="ex. 12" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <button disabled={!linkUserId.trim()} onClick={handleLink} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Linker</button>
          <button onClick={handleUnlink} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Délinker{linkUserId.trim() ? '' : ' (tous)'}</button>
        </div>
      </section>

      <section id={mapSectionId} className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Localisation</h2>
        <div className="mt-3 rounded-2xl border border-sky-100 bg-sky-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-sky-700">Position GPS</p>
          <div className="mt-2 text-lg font-semibold text-slate-900">
            {pos.latitude != null && pos.longitude != null
              ? <CoordinateBadge latitude={pos.latitude} longitude={pos.longitude} compact />
              : 'Aucune coordonnée GPS disponible pour ce POS.'}
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Ces coordonnées servent à l’affichage cartographique, au suivi et aux exports.
          </p>
        </div>
      </section>

      {/* Points d'ancrage vers les modules d'autres devs — pas de logique métier ici */}
      <div className="flex gap-3 border-t border-gray-200 pt-4">
        {LIENS_EXTERNES.map((lien) => (
          <button
            key={lien.label}
            onClick={() => navigate(lien.href(id))}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Voir {lien.label} →
          </button>
        ))}
      </div>
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <div className="mt-1 text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function CoordinateBadge({ latitude, longitude, compact = false }) {
  if (latitude == null || longitude == null) {
    return <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">Non renseignées</span>;
  }

  if (compact) {
    return <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">{latitude}, {longitude}</span>;
  }

  return <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">{latitude}, {longitude}</span>;
}
