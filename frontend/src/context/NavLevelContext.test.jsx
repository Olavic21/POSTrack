import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { NavLevelProvider, detectLevelFromPath } from './NavLevelContext'
import useNavigationLevel from '../hooks/useNavigationLevel'
import Sidebar from '../components/Layout/Sidebar'
import { AuthContext } from '../context/AuthContext'
import { PartnerContext } from '../context/PartnerContext'
import { I18nProvider } from '../i18n'
import { NAV_LEVELS, STORAGE_KEYS } from '../utils/constants'

const authValue = {
  isAuthenticated: true,
  user: { id: 1, role: 'ADMIN', nom_complet: 'Admin Demo' },
  logout: vi.fn(async () => {}),
}

const partnerValue = {
  partner: null,
  clearPartner: vi.fn(),
}

/** Sonde affichant le niveau courant + actions de navigation. */
function LevelFlow() {
  const { level, setLevel } = useNavigationLevel()
  const navigate = useNavigate()
  return (
    <div>
      <span data-testid="level">{level}</span>
      <button type="button" onClick={() => setLevel(NAV_LEVELS.DSM)}>
        entrer-dsm
      </button>
      <button type="button" onClick={() => navigate('/pos')}>
        aller-pos
      </button>
      <button type="button" onClick={() => setLevel(NAV_LEVELS.PARTNER)}>
        retour-partner
      </button>
    </div>
  )
}

function renderFlow() {
  return render(
    <I18nProvider>
      <AuthContext.Provider value={authValue}>
        <PartnerContext.Provider value={partnerValue}>
          <MemoryRouter initialEntries={['/dsm']}>
            <NavLevelProvider>
              <Routes>
                <Route path="*" element={<LevelFlow />} />
              </Routes>
            </NavLevelProvider>
          </MemoryRouter>
        </PartnerContext.Provider>
      </AuthContext.Provider>
    </I18nProvider>
  )
}

describe('detectLevelFromPath', () => {
  it('détecte le niveau depuis l’URL', () => {
    expect(detectLevelFromPath('/dsm')).toBe(NAV_LEVELS.DSM)
    expect(detectLevelFromPath('/dsm/3')).toBe(NAV_LEVELS.DSM)
    expect(detectLevelFromPath('/pos')).toBe(NAV_LEVELS.POS)
    expect(detectLevelFromPath('/pos/12')).toBe(NAV_LEVELS.POS)
    expect(detectLevelFromPath('/')).toBe(NAV_LEVELS.PARTNER)
    expect(detectLevelFromPath('/ventes')).toBe(NAV_LEVELS.PARTNER)
  })
})

describe('NavLevelProvider — niveau persistant', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('niveau Partenaire par défaut', () => {
    renderFlow()
    expect(screen.getByTestId('level')).toHaveTextContent(NAV_LEVELS.PARTNER)
  })

  it('reste au niveau DSM pendant les navigations suivantes (sticky)', () => {
    renderFlow()
    // Entrée explicite dans la navigation DSM.
    fireEvent.click(screen.getByRole('button', { name: 'entrer-dsm' }))
    expect(screen.getByTestId('level')).toHaveTextContent(NAV_LEVELS.DSM)
    expect(localStorage.getItem(STORAGE_KEYS.NAV_LEVEL)).toBe(NAV_LEVELS.DSM)

    // Navigation sur une route partagée (/pos) : on reste en niveau DSM.
    fireEvent.click(screen.getByRole('button', { name: 'aller-pos' }))
    expect(screen.getByTestId('level')).toHaveTextContent(NAV_LEVELS.DSM)

    // Retour explicite : on repasse au niveau Partenaire.
    fireEvent.click(screen.getByRole('button', { name: 'retour-partner' }))
    expect(screen.getByTestId('level')).toHaveTextContent(NAV_LEVELS.PARTNER)
    expect(localStorage.getItem(STORAGE_KEYS.NAV_LEVEL)).toBe(NAV_LEVELS.PARTNER)
  })

  it('survit au rechargement de la page (persistance localStorage)', () => {
    localStorage.setItem(STORAGE_KEYS.NAV_LEVEL, NAV_LEVELS.DSM)
    renderFlow()
    expect(screen.getByTestId('level')).toHaveTextContent(NAV_LEVELS.DSM)
  })

  it('revient au niveau Partenaire quand la session est absente', () => {
    localStorage.setItem(STORAGE_KEYS.NAV_LEVEL, NAV_LEVELS.DSM)
    render(
      <I18nProvider>
        <AuthContext.Provider value={{ ...authValue, isAuthenticated: false }}>
          <PartnerContext.Provider value={partnerValue}>
            <MemoryRouter>
              <NavLevelProvider>
                <LevelFlow />
              </NavLevelProvider>
            </MemoryRouter>
          </PartnerContext.Provider>
        </AuthContext.Provider>
      </I18nProvider>
    )
    expect(screen.getByTestId('level')).toHaveTextContent(NAV_LEVELS.PARTNER)
    expect(localStorage.getItem(STORAGE_KEYS.NAV_LEVEL)).toBeNull()
  })
})

describe('Sidebar — bouton de retour au niveau Partenaire', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  function renderSidebarAtDsm(onClose) {
    localStorage.setItem(STORAGE_KEYS.NAV_LEVEL, NAV_LEVELS.DSM)
    // Forcer le français : les beforeEach font localStorage.clear() ce qui
    // fait retomber I18nProvider sur navigator.language (en en jsdom).
    localStorage.setItem('postrack_lang', 'fr')
    return render(
      <I18nProvider>
        <AuthContext.Provider value={authValue}>
          <PartnerContext.Provider value={partnerValue}>
            <MemoryRouter initialEntries={['/']}>
              <NavLevelProvider>
                <Routes>
                  <Route path="/dashboard" element={<div>Dashboard partenaire</div>} />
                  <Route path="*" element={<Sidebar open onClose={onClose} />} />
                </Routes>
              </NavLevelProvider>
            </MemoryRouter>
          </PartnerContext.Provider>
        </AuthContext.Provider>
      </I18nProvider>
    )
  }

  it('affiche la navigation DSM et le bouton de retour quand le niveau est DSM', () => {
    renderSidebarAtDsm(vi.fn())
    // Niveau DSM : labels spécifiques DSM (fr/en) — le libellé exact dépend de la
    // langue active (setup.ts force 'fr' via afterEach) :
    // FR = "Tableau de bord DSM", EN = "DSM Dashboard".
    expect(
      screen.getByRole('link', { name: /Tableau de bord DSM|DSM Dashboard/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Retour|Back/ })
    ).toBeInTheDocument()
  })

  it('ramène au niveau Partenaire et vers /dashboard au clic sur le retour', () => {
    const onClose = vi.fn()
    renderSidebarAtDsm(onClose)

    fireEvent.click(screen.getByRole('button', { name: /Retour|Back/ }))

    expect(screen.getByText('Dashboard partenaire')).toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEYS.NAV_LEVEL)).toBe(NAV_LEVELS.PARTNER)
    expect(onClose).toHaveBeenCalled()
  })

  it("n'affiche pas de bouton de retour au niveau Partenaire", () => {
    localStorage.setItem('postrack_lang', 'fr')
    render(
      <I18nProvider>
        <AuthContext.Provider value={authValue}>
          <PartnerContext.Provider value={partnerValue}>
            <MemoryRouter initialEntries={['/dashboard']}>
              <NavLevelProvider>
                <Routes>
                  <Route path="/dashboard" element={<Sidebar open onClose={vi.fn()} />} />
                  <Route path="*" element={<div>Autre page</div>} />
                </Routes>
              </NavLevelProvider>
            </MemoryRouter>
          </PartnerContext.Provider>
        </AuthContext.Provider>
      </I18nProvider>
    )
    expect(
      screen.queryByRole('button', { name: /Retour|Back/ })
    ).not.toBeInTheDocument()
    // Niveau Partenaire i18n FR : nav_dashboard = "Tableau de bord"
    expect(screen.getByRole('link', { name: 'Tableau de bord' })).toBeInTheDocument()
  })
})