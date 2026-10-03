/// <reference types="vitest" />
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    // Certains tests de rendu attendent un chunk lazy + plusieurs appels API
    // mockés via waitFor({ timeout: 8000 }). Avec le testTimeout par défaut (5s),
    // le test expirait AVANT l'expiration de son propre waitFor dès que la
    // machine est chargée (suites lancées en parallèle) : timeout aléatoire.
    // On aligne testTimeout au-dessus du plus grand timeout de waitFor employé.
    testTimeout: 20000,
    // Contournement Vitest 4 + Vite 7/8 : l'import « vitest » depuis un
    // fichier de test est resolu comme dependance EXTERNE, donc il ne partage
    // pas l'etat du worker et describe() echoue avec :
    //   TypeError: Cannot read properties of undefined (reading 'config')
    // Options ELIMINEES car verifiees inefficaces :
    //   - server.deps.inline: ['vitest'] puis [/^vitest$/, /^@vitest\//]
    //   - ssr.noExternal: ['vitest', '@vitest/*']
    // Les globales Vitest sont, elles, correctement injectees par le runner :
    // on branche donc le specifier « vitest » sur un pont qui reexpose l'API
    // runner depuis globalThis.
    alias: [
      {
        find: /^vitest$/,
        replacement: fileURLToPath(new URL('./src/test/vitestRuntime.js', import.meta.url)),
      },
    ],
    server: {
      deps: {
        // jest-dom est externalise par defaut : son `import { expect } from 'vitest'`
        // interne ne passe alors pas par l'alias ci-dessus et enregistre les
        // matchers (toBeInTheDocument, ...) sur une instance d'expect que les
        // tests n'utilisent pas. On l'inline pour qu'il partage l'expect reel.
        inline: ['@testing-library/jest-dom'],
      },
    },
  },
})
