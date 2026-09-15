import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { CheckIcon } from '@heroicons/react/24/outline';
import useAuth from '../../hooks/useAuth';
import usePartner from '../../hooks/usePartner';
import { partnerContextService } from '../../services/partnerContextService';
import { ROLE_LABELS } from '../../utils/constants';
import Button from '../../components/Common/Button/Button';
import Alert from '../../components/Common/Alert/Alert';
import DemoDataBanner from '../../components/Common/DemoDataBanner/DemoDataBanner';
import Logo from '../../assets/logos/LOGO.jpeg';
import { envFlag } from '../../utils/envFlags';

const SelectPartnerPage = () => {
  const { user, logout, loading: authLoading, isAuthenticated } = useAuth();
  const { setPartner, hasPartner, partner } = usePartner();
  const navigate = useNavigate();

  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectingId, setSelectingId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (!user || !isAuthenticated) return;
    let cancelled = false;

    const loadPartners = async () => {
      setLoading(true);
      setError('');
      try {
        const list = await partnerContextService.getAvailable(user);
        if (cancelled) return;
        setPartners(list);

        if ((list.length === 1 || (!hasPartner && list.length > 0)) && list[0]) {
          setPartner(list[0]);
          setSelectedId(list[0].id);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.detail ||
              'Impossible de charger les partenaires autorisés.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPartners();

    return () => {
      cancelled = true;
    };
  }, [user, isAuthenticated, setPartner, hasPartner]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mesh-pattern">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">Chargement…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const handleSelect = (item) => {
    setSelectingId(item.id);
    setPartner(item);
    setSelectedId(item.id);
    setSelectingId(null);
  };

  const handleConfirmSelection = () => {
    if (!selectedId) return;
    navigate('/dashboard', { replace: true });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-mesh-pattern px-4 py-12">
      {/* Background orbs */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-brand-400/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-2xl animate-fade-in-scale">
        <div className="glass-strong overflow-hidden rounded-3xl border border-white/60 shadow-xl">
          {/* Header */}
          <div className="bg-gradient-brand relative overflow-hidden px-8 pb-6 pt-8">
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <img src={Logo} alt="POSTrack" className="h-8 w-auto rounded-lg opacity-90" />
                <h1 className="mt-3 text-2xl font-extrabold text-white">Sélection du partenaire</h1>
                <p className="mt-1 text-sm font-medium text-indigo-100">
                  Choisissez le contexte avant d&apos;accéder aux modules métier.
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="shrink-0 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20"
              >
                Déconnexion
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-8 py-6">
            {user && (
              <div className="mb-5 flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                  {(user.nom_complet || user.full_name || user.email || '?')[0]?.toUpperCase()}
                </span>
                <p className="text-slate-700">
                  Connecté en tant que{' '}
                  <span className="font-semibold text-slate-900">
                    {user.nom_complet || user.full_name || user.email}
                  </span>
                  {user.role && (
                    <>
                      {' '}&mdash;{' '}
                      <span className="inline-flex rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                        {ROLE_LABELS[user.role] || user.role}
                      </span>
                    </>
                  )}
                </p>
              </div>
            )}

            {hasPartner && partner && (
              <div className="mb-5">
                <Alert
                  type="info"
                  message={`Contexte actuel : ${partner.nom || partner.code_partenaire || partner.id}. Vous pouvez en choisir un autre.`}
                />
              </div>
            )}

            {error && (
              <div className="mb-5">
                <Alert type="error" message={error} />
              </div>
            )}

            {(partners.some((p) => p.__mock) || partner?.__mock) && !envFlag(import.meta.env.VITE_DISABLE_DEMO_BANNER) && (
              <div className="mb-5">
                <DemoDataBanner message="Mode de démonstration activé : les partenaires affichés sont des exemples temporaires." />
              </div>
            )}

            {loading ? (
              <div className="py-12 text-center">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                <p className="mt-3 text-sm text-slate-500">Chargement des partenaires…</p>
              </div>
            ) : partners.filter((item) => item?.id && (item?.nom || item?.name || item?.code_partenaire || item?.code)).length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400">
                Aucun partenaire autorisé pour ce compte.
              </div>
            ) : (
              <div className="space-y-4">
                <ul className="space-y-2.5">
                  {partners
                    .filter((item) => item?.id && (item?.nom || item?.name || item?.code_partenaire || item?.code))
                    .map((item) => {
                      const partnerName = item.nom || item.name || item.raison_sociale || `Partenaire #${item.id}`;
                      const partnerCode = item.code_partenaire || item.code || '';
                      const isSelected = selectedId === item.id;

                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => handleSelect(item)}
                            disabled={selectingId === item.id}
                            className={`group flex w-full items-center gap-4 rounded-xl border px-4 py-4 text-left transition-all duration-200 ${
                              isSelected
                                ? 'border-brand-300 bg-brand-50/80 shadow-sm shadow-brand-500/5'
                                : 'border-slate-200 bg-white hover:border-brand-200 hover:bg-brand-50/30 hover:shadow-sm'
                            }`}
                          >
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-bold transition-all duration-200 ${
                                isSelected
                                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                                  : 'bg-slate-100 text-slate-500 group-hover:bg-brand-100 group-hover:text-brand-600'
                              }`}
                            >
                              {partnerName[0]?.toUpperCase() || '?'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`font-semibold transition-colors ${isSelected ? 'text-brand-700' : 'text-slate-900'}`}>
                                {partnerName}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {partnerCode}
                                {item.ville ? ` · ${item.ville}` : ''}
                                {item.region ? ` · ${item.region}` : ''}
                              </p>
                            </div>
                            <span
                              className={`text-xs font-semibold transition-colors ${
                                isSelected ? 'text-brand-600' : 'text-slate-400 group-hover:text-brand-500'
                              }`}
                            >
                              {isSelected ? (
                                <span className="inline-flex items-center gap-1">
                                  <CheckIcon className="h-3 w-3" aria-hidden="true" />
                                  Sélectionné
                                </span>
                              ) : (
                                'Sélectionner'
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                </ul>

                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    variant="success"
                    onClick={handleConfirmSelection}
                    disabled={!selectedId}
                    className="px-6"
                  >
                    Continuer
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          POSTrack · Gestion de la chaîne Partenaire → DSM → BTS → POS
        </p>
      </div>
    </div>
  );
};

export default SelectPartnerPage;
