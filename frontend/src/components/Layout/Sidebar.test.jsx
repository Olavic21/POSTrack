import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import Sidebar from './Sidebar'
import { AuthContext } from '../../context/AuthContext'
import { PartnerContext } from '../../context/PartnerContext'

function renderSidebar(role) {
  return render(
    <AuthContext.Provider
      value={{
        user: { role, nom_complet: 'Test' },
        loading: false,
        isAuthenticated: true,
        token: 'tok',
        login: vi.fn(),
        logout: vi.fn(async () => {}),
      }}
    >
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
          <Sidebar open onClose={vi.fn()} />
        </MemoryRouter>
      </PartnerContext.Provider>
    </AuthContext.Provider>
  )
}

describe('Sidebar', () => {
  it('montre Partenaires pour ADMIN', () => {
    renderSidebar('ADMIN')
    expect(screen.getByRole('link', { name: 'Partenaires' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Audit' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Accès refusé' })).not.toBeInTheDocument()
  })

  it('cache Admin items pour OPERATIONNEL au niveau Partenaire', () => {
    renderSidebar('OPERATIONNEL')
    expect(screen.getByRole('link', { name: 'Points de vente' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'DSM' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Partenaires' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Import Excel' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Audit' })).not.toBeInTheDocument()
    // Stock SIM retiré de la navigation (demande métier) — route /sims reste accessible directe mais non listée
    expect(screen.queryByRole('link', { name: /Stock SIM/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Requêtes' })).toBeInTheDocument()
  })

  it('affiche un bouton de déconnexion dans le menu mobile', () => {
    renderSidebar('ADMIN')
    expect(screen.getByRole('button', { name: /Déconnexion/ })).toBeInTheDocument()
  })
})
