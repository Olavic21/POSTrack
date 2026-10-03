import '@testing-library/jest-dom/vitest'

// I18nProvider détermine la langue via localStorage puis, à défaut,
// navigator.language (jsdom expose 'en-US' -> tous les libellés passaient en
// anglais). Les tests font souvent localStorage.clear() en beforeEach, ce qui
// vide la langue mémorisée : on fixe donc la locale de l'environnement une
// seule fois, ici, plutôt que via un afterEach.
// NOTE (Vitest 4) : un hook (afterEach/beforeEach) déclaré dans un setupFile
// s'exécute hors suite courante et fait échouer la collecte de tous les fichiers
// (« Vitest failed to find the current suite »). D'où cette approche sans hook.
try {
  Object.defineProperty(globalThis.navigator, 'language', {
    value: 'fr-FR',
    configurable: true,
  })
} catch {
  /* jsdom sans navigator mutable : la locale reste celle de jsdom. */
}

try {
  if (!localStorage.getItem('postrack_lang')) localStorage.setItem('postrack_lang', 'fr')
} catch {
  /* localStorage indisponible (mode prive) : l'i18n retombe sur navigator. */
}
