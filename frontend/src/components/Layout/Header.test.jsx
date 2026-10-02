import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Header from './Header'
import { AuthContext } from '../../context/AuthContext'
import { PartnerContext } from '../../context/PartnerContext'
import { I18nProvider } from '../../i18n'

const authValue = (overrides = {}) => ({
  user: { id: 1, nom_complet: 'Admin Demo', role: 'ADMIN' },
  token: 'tok',
  login: vi.fn(),
  logout: vi.fn(async () => {}),
  isAuthenticated: true,
  loading: false,
  ...overrides,
})

describe('Header — Module A2', () => {
  it("affiche le nom de l'utilisateur, son rôle et le bouton Déconnexion", () => {
    render(
      <I18nProvider>
        <AuthContext.Provider value={authValue()}>
          <PartnerContext.Provider
            value={{
              partner: null,
              partnerContextId: null,
              setPartner: vi.fn(),
              clearPartner: vi.fn(),
              hasPartner: false,
            }}
          >
            <MemoryRouter>
              <Header onToggleSidebar={vi.fn()} />
            </MemoryRouter>
          </PartnerContext.Provider>
        </AuthContext.Provider>
      </I18nProvider>
    )
    expect(screen.getByText('Admin Demo')).toBeInTheDocument()
    expect(screen.getByText('Administrateur')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Déconnexion' })).toBeInTheDocument()
  })

  it('affiche la marque POSTrack', () => {
    render(
      <I18nProvider>
        <AuthContext.Provider value={authValue()}>
          <PartnerContext.Provider
            value={{
              partner: null,
              partnerContextId: null,
              setPartner: vi.fn(),
              clearPartner: vi.fn(),
              hasPartner: false,
            }}
          >
            <MemoryRouter>
              <Header onToggleSidebar={vi.fn()} />
            </MemoryRouter>
          </PartnerContext.Provider>
        </AuthContext.Provider>
      </I18nProvider>
    )
    expect(screen.getAllByText('POSTrack').length).toBeGreaterThan(0)
  })

  it('redirige vers /login après la déconnexion', async () => {
    const logout = vi.fn(async () => {})
    render(
      <I18nProvider>
        <AuthContext.Provider value={authValue({ logout })}>
          <PartnerContext.Provider
            value={{
              partner: null,
              partnerContextId: null,
              setPartner: vi.fn(),
              clearPartner: vi.fn(),
              hasPartner: false,
            }}
          >
            <MemoryRouter initialEntries={['/']}>
              <Routes>
                <Route path="/" element={<Header onToggleSidebar={vi.fn()} />} />
                <Route path="/login" element={<div>Page de connexion</div>} />
              </Routes>
            </MemoryRouter>
          </PartnerContext.Provider>
        </AuthContext.Provider>
      </I18nProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Déconnexion' }))
    // La déconnexion est asynchrone : on attend la navigation vers /login
    await waitFor(() => {
      expect(screen.getByText('Page de connexion')).toBeInTheDocument()
    })
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('affiche un libellé de rôle inconnu si le rôle est absent', () => {
    render(
      <I18nProvider>
        <AuthContext.Provider value={authValue({ user: { email: 'x@y.z' } })}>
          <PartnerContext.Provider
            value={{
              partner: null,
              partnerContextId: null,
              setPartner: vi.fn(),
              clearPartner: vi.fn(),
              hasPartner: false,
            }}
          >
            <MemoryRouter>
              <Header onToggleSidebar={vi.fn()} />
            </MemoryRouter>
          </PartnerContext.Provider>
        </AuthContext.Provider>
      </I18nProvider>
    )
    expect(screen.getByText('Rôle inconnu')).toBeInTheDocument()
  })
})