import React, { useCallback, useEffect, useState } from 'react';
import PageHeader from '../../components/Common/PageHeader/PageHeader';
import EmptyState from '../../components/Common/EmptyState/EmptyState';
import ErrorState from '../../components/Common/ErrorState/ErrorState';
import LoadingSpinner from '../../components/Common/LoadingSpinner/LoadingSpinner';
import ImportPreviewModal from '../../components/Import/ImportPreviewModal';
import ImportSetupStep from './ImportSetupStep';
import ImportPreviewStep from './ImportPreviewStep';
import ImportSuccessStep from './ImportSuccessStep';
import importService from '../../services/importService';
import { IMPORT_ENTITY_TYPES, IMPORT_STEPS, IMPORT_REAL_TYPES } from '../../utils/constants';

/**
 * Module A3 — Import Excel centralisé (ImportBatch) — Lead Frontend.
 * Ordonnanceur du parcours en 5 étapes (cf. TEAM_DEVELOPMENT §7) :
 * 1. Gabarit → 2. Type d'entité → 3. Dépôt & Validation → 4. Preview → 5. Commit.
 */
const ImportExportPage = () => {
  const [step, setStep] = useState(IMPORT_STEPS.SETUP);
  const [entityType, setEntityType] = useState(IMPORT_ENTITY_TYPES[0].value);
  const [file, setFile] = useState(null);
  const [batch, setBatch] = useState(null);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);
  const [realImportType, setRealImportType] = useState('ZONE');
  const [realFile, setRealFile] = useState(null);
  const [realImportResult, setRealImportResult] = useState(null);
  const [realImportError, setRealImportError] = useState(null);
  const [realImportLoading, setRealImportLoading] = useState(false);

  // Un changement de type d'entité invalide le lot en cours.
  useEffect(() => {
    setFile(null);
    setBatch(null);
    setResult(null);
    setError(null);
    if (step !== IMPORT_STEPS.SETUP && step !== IMPORT_STEPS.VALIDATING) {
      setStep(IMPORT_STEPS.SETUP);
    }
  }, [entityType]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleValidate = useCallback(async () => {
    if (!file) return;
    setError(null);
    setStep(IMPORT_STEPS.VALIDATING);
    try {
      const validated = await importService.validate(entityType, file);
      setBatch(validated);
      setStep(IMPORT_STEPS.PREVIEW);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Erreur lors de la validation du fichier.');
      setStep(IMPORT_STEPS.ERROR);
    }
  }, [entityType, file]);

  const handleApply = useCallback(async () => {
    setApplying(true);
    try {
      const applied = await importService.apply(batch.id);
      setResult(applied);
      setModalOpen(false);
      setStep(IMPORT_STEPS.SUCCESS);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Erreur lors de l'application du lot.");
      setModalOpen(false);
      setStep(IMPORT_STEPS.ERROR);
    } finally {
      setApplying(false);
    }
  }, [batch]);

  const reset = () => {
    setFile(null);
    setBatch(null);
    setResult(null);
    setError(null);
    setStep(IMPORT_STEPS.SETUP);
  };

  const handleRealImport = useCallback(async () => {
    if (!realFile) return;
    setRealImportLoading(true);
    setRealImportError(null);
    setRealImportResult(null);
    try {
      let res;
      if (realImportType === 'ZONE') {
        res = await importService.importZone(realFile);
      } else {
        res = await importService.importStock(realFile);
      }
      setRealImportResult(res);
    } catch (err) {
      setRealImportError(err?.response?.data?.detail || err?.message || "Erreur lors de l'import.");
    } finally {
      setRealImportLoading(false);
    }
  }, [realImportType, realFile]);

  const loading = step === IMPORT_STEPS.VALIDATING || step === IMPORT_STEPS.APPLYING;
  const isLoading = loading && !batch;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import Excel"
        subtitle="Canal central d'importation en masse (ImportBatch) — module A3 du Lead Frontend."
        breadcrumbs={['Administration', 'Import Excel']}
      />

      {!loading && step === IMPORT_STEPS.SETUP ? (
        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <ImportSetupStep
            entityType={entityType}
            setEntityType={setEntityType}
            file={file}
            setFile={setFile}
            onValidate={handleValidate}
            validating={step === IMPORT_STEPS.VALIDATING}
          />

          <aside className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Récapitulatif</h2>
              <p className="mt-1 text-sm text-slate-500">
                Vérifiez le type sélectionné et le fichier déposé avant de lancer la validation.
              </p>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                <span className="text-slate-500">Entité choisie</span>
                <span className="font-medium text-slate-900">{entityType}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                <span className="text-slate-500">Fichier</span>
                <span className="max-w-[14rem] truncate font-medium text-slate-900">
                  {file?.name || 'Aucun fichier'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                <span className="text-slate-500">Étape</span>
                <span className="font-medium text-slate-900">Préparation</span>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Assurez-vous que les colonnes du fichier correspondent bien au gabarit officiel avant validation.
            </div>
          </aside>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 shadow-sm">
          <LoadingSpinner
            size="md"
            label={step === IMPORT_STEPS.VALIDATING ? 'Validation du fichier…' : 'Application du lot en cours…'}
          />
        </div>
      ) : null}

      {step === IMPORT_STEPS.ERROR ? (
        <ErrorState title="L'import a échoué" message={error} onRetry={reset} retryLabel="Recommencer" />
      ) : null}

      {!loading && step === IMPORT_STEPS.PREVIEW ? (
        <ImportPreviewStep batch={batch} onOpenModal={() => setModalOpen(true)} onReset={reset} />
      ) : null}

      {!loading && step === IMPORT_STEPS.SUCCESS ? (
        <ImportSuccessStep batch={batch} result={result} onReset={reset} />
      ) : null}

      {!loading && step === IMPORT_STEPS.SETUP && !file ? (
        <EmptyState
          title="Prêt à importer"
          icon={(
            <svg className="mx-auto h-9 w-9" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          )}
          message="Sélectionnez un type d'entité puis déposez un fichier Excel pour lancer l'import dans le partenaire actif."
        />
      ) : null}

      <ImportPreviewModal
        batch={batch}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleApply}
        confirming={applying}
      />

      {/* Section Import Reel (ZONE / STOCK) */}
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Import de donnees reels</h2>
        <p className="mt-1 text-sm text-slate-500">
          Importez les fichiers Excel au format specifique du partenaire (ZONE geographique, STOCK DSM/POS).
          Ces imports sont directement appliques sans etape de preview.
        </p>

        <div className="mt-4 flex flex-wrap gap-4">
          {IMPORT_REAL_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => { setRealImportType(t.value); setRealFile(null); setRealImportResult(null); setRealImportError(null); }}
              className={`rounded-lg border px-4 py-3 text-sm transition ${
                realImportType === t.value
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
              }`}
            >
              <div className="font-medium">{t.label}</div>
              <div className="mt-1 text-xs opacity-70">{t.description}</div>
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-end gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">Fichier Excel</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setRealFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </div>
          <button
            onClick={handleRealImport}
            disabled={!realFile || realImportLoading}
            className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {realImportLoading ? 'Import en cours...' : `Importer ${realImportType}`}
          </button>
        </div>

        {realImportError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {realImportError}
          </div>
        )}

        {realImportResult && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <h3 className="text-sm font-semibold text-emerald-800">Import termine avec succes</h3>
            <pre className="mt-2 overflow-x-auto text-xs text-emerald-700">
              {JSON.stringify(realImportResult, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportExportPage;