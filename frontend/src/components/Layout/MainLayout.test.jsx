import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import MainLayout from './MainLayout'
import { AuthContext } from '../../context/AuthContext'
import { PartnerContext } from '../../context/PartnerContext'
import { I18nProvider } from '../../i18n'

const authValue = {
  user: { id: 1, nom_complet: 'Admin Demo', role: 'ADMIN' },
  token: 'tok',
  login: vi.fn(),
  logout: vi.fn(async () => {}),
  isAuthenticated: true,
  loading: false,
}

const partnerValue = {
  partnerContextId: 1,
  partner: {
    id: 1,
    nom: 'Master Color',
    code_partenaire: 'PART-MC',
    ville: 'Douala',
  },
  hasPartner: true,
  setPartner: vi.fn(),
  clearPartner: vi.fn(),
}

function renderLayout() {
  return render(
    <I18nProvider>
      <AuthContext.Provider value={authValue}>
        <PartnerContext.Provider value={partnerValue}>
          <MemoryRouter initialEntries={['/']}>
            <Routes>
              <Route element={<MainLayout />}>
                <Route path="/" element={<div>Contenu du layout</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </PartnerContext.Provider>
      </AuthContext.Provider>
    </I18nProvider>
  )
}

describe('MainLayout — Module A2', () => {
  it('affiche le header, le contexte partenaire et le contenu du Outlet', () => {
    renderLayout()
    expect(screen.getAllByText('POSTrack').length).toBeGreaterThan(0)
    expect(screen.getByText('Contenu du layout')).toBeInTheDocument()
    expect(screen.getAllByText('Master Color').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Changer' })).toBeInTheDocument()
  })

  it('affiche la navigation latérale filtrée par rôle (ADMIN)', () => {
    renderLayout()
    // Stock SIM retiré de la navigation — vérifier que les items ADMIN restent présents
    expect(screen.queryByText('Stock SIM')).not.toBeInTheDocument()
    expect(screen.getByText('Partenaires')).toBeInTheDocument()
    expect(screen.getByText('Audit')).toBeInTheDocument()
  })
})