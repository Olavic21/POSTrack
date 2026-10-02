/**
 * Pont d'API Vitest — contournement d'un bug d'environnement Vite 8 / Vitest 4.
 *
 * Contexte : avec cette combinaison de versions, le paquet « vitest » importé
 * depuis un fichier de test est chargé en tant que dépendance externe (instance
 * Node) au lieu d'être remplacé par le module du runner. L'instance obtenue ne
 * partage pas l'état du worker et `describe()` échoue avec :
 *
 *   TypeError: Cannot read properties of undefined (reading 'config')
 *
 * Les globales Vitest (`globals: true`) sont, elles, correctement injectées par
 * le runner : ce module réexpose donc l'API publique depuis `globalThis`, en
 * relayant fidèlement propriétés et méthodes (`vi.fn`, `it.each`,
 * `expect.extend`, `expect.soft`, ...).
 *
 * Il est branché via `test.alias` dans `vitest.config.ts` (specifier « vitest »),
 * ce qui laisse les types TypeScript inchangés.
 */
const delegate = (name) =>
  new Proxy(function () {}, {
    apply: (_target, _thisArg, args) => globalThis[name](...args),
    get: (_target, prop) => globalThis[name]?.[prop],
    has: (_target, prop) => prop in (globalThis[name] ?? {}),
    set: (_target, prop, value) => {
      if (globalThis[name]) globalThis[name][prop] = value;
      return true;
    },
  });

/**
 * `vi` : delegate paresseuse.
 *
 * Le pont ci-dessus utilise un Proxy. Or Vitest repere les appels `vi.mock(...)`
 * via l'AST (avant execution) et les HOISTE en tete de module : le Proxy n'est
 * evalue qu'a l'execution de la factory. Or le probleme observe est precisement
 * que la factory n'est jamais executee au bon moment / jamais appliquee
 * (le module reel est importe : « __isMockFactory » undefined,
 * « post.mockResolvedValueOnce is not a function »).
 *
 * On expose donc `vi` comme un objet REEL deleguant au global du runner
 * (le meme objet que `globalThis.vi`), ce qui laisse Vitest appliquer
 * normalement son hoisting et sa resolution de mock.
 */
export const vi = globalThis.vi;

export const describe = delegate('describe');
export const suite = delegate('suite');
export const it = delegate('it');
export const test = delegate('test');
export const expect = delegate('expect');
export const assert = delegate('assert');
export const beforeAll = delegate('beforeAll');
export const afterAll = delegate('afterAll');
export const beforeEach = delegate('beforeEach');
export const afterEach = delegate('afterEach');
export const onTestFailed = delegate('onTestFailed');
export const onTestFinished = delegate('onTestFinished');

export default {
  describe,
  suite,
  it,
  test,
  expect,
  assert,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  onTestFailed,
  onTestFinished,
};
