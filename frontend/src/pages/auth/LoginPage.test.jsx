import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LoginPage from './LoginPage'
import { AuthContext } from '../../context/AuthContext'
import { PartnerContext } from '../../context/PartnerContext'
import { I18nProvider } from '../../i18n'

describe('LoginPage', () => {
  it('rend le formulaire même si le contexte partenaire est indisponible', () => {
    render(
      <AuthContext.Provider
        value={{
          user: null,
          loading: false,
          isAuthenticated: false,
          token: null,
          login: vi.fn(),
          logout: vi.fn(),
        }}
      >
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    expect(screen.getByRole('img', { name: 'POSTrack' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument()
  })

  it('rend le formulaire avec un partenaire fourni', () => {
    render(
      <AuthContext.Provider
        value={{
          user: null,
          loading: false,
          isAuthenticated: false,
          token: null,
          login: vi.fn(),
          logout: vi.fn(),
        }}
      >
        <PartnerContext.Provider
          value={{
            hasPartner: true,
            partner: { id: 1, nom: 'Partenaire test' },
            setPartner: vi.fn(),
            clearPartner: vi.fn(),
            partnerContextId: 1,
          }}
        >
          <MemoryRouter>
            <LoginPage />
          </MemoryRouter>
        </PartnerContext.Provider>
      </AuthContext.Provider>
    )

    expect(screen.getByRole('img', { name: 'POSTrack' })).toBeInTheDocument()
  })

  it('préremplit le formulaire depuis l aide de démo et conserve le submit manuel', async () => {
    const login = vi.fn().mockResolvedValue({ access_token: 'token', user: { id: 1, role: 'ADMIN' } })
    render(
      <AuthContext.Provider
        value={{
          user: null,
          loading: false,
          isAuthenticated: false,
          token: null,
          login,
          logout: vi.fn(),
        }}
      >
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    fireEvent.click(screen.getByRole('button', { name: /Admin/ }))
    expect(screen.getByDisplayValue('admin')).toBeInTheDocument()
    expect(screen.getByDisplayValue('admin123')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Se connecter/ }))

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({ username: 'admin', password: 'admin123' })
    })
  })
})