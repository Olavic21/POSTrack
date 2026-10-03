import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // Heritage : ces 3 fichiers ont ete ecrits en JS puis "convertis" en
    // TypeScript avec un @ts-nocheck, sans jamais avoir ete retypes. Les
    // assumer tels quels ici permet de brancher `npm run lint` sur la CI sans
    // blocking, tout en continuant d'appliquer les regles a TOUT le reste du
    // code (donc de bloquer la nouvelle dette).
    // TODO dette: typer Dashboard.tsx, PartnersList.tsx et UsersPage.tsx, puis
    // supprimer ce bloc. Voir la section « Dette technique » du README.
    files: [
      'src/pages/Dashboard.tsx',
      'src/pages/PartnersList.tsx',
      'src/pages/admin/UsersPage.tsx',
    ],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
])
