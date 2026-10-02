import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import PartnerSelectorBar from './PartnerSelectorBar'
import { PartnerContext } from '../../context/PartnerContext'

describe('PartnerSelectorBar', () => {
  it('ne rend rien quand un partenaire est sélectionné (le Header affiche le contexte)', () => {
    const { container } = render(
      <PartnerContext.Provider
        value={{
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
        }}
      >
        <MemoryRouter>
          <PartnerSelectorBar />
        </MemoryRouter>
      </PartnerContext.Provider>
    )

    expect(container).toBeEmptyDOMElement()
  })

  it("affiche l'alerte d'invitation à sélectionner un partenaire lorsqu'aucun n'est actif", () => {
    render(
      <PartnerContext.Provider
        value={{
          partnerContextId: null,
          partner: null,
          hasPartner: false,
          setPartner: vi.fn(),
          clearPartner: vi.fn(),
        }}
      >
        <MemoryRouter>
          <PartnerSelectorBar />
        </MemoryRouter>
      </PartnerContext.Provider>
    )

    expect(screen.getByText('Sélectionnez un partenaire pour afficher les données du tableau de bord.')).toBeInTheDocument()
  })

  it("ne rend rien pour un partenaire réel avec hasPartner à true", () => {
    const { container } = render(
      <PartnerContext.Provider
        value={{
          partnerContextId: 1,
          partner: {
            id: 1,
            nom: 'Master Color',
            code_partenaire: 'PART-MC',
          },
          hasPartner: true,
          setPartner: vi.fn(),
          clearPartner: vi.fn(),
        }}
      >
        <MemoryRouter>
          <PartnerSelectorBar />
        </MemoryRouter>
      </PartnerContext.Provider>
    )

    expect(container).toBeEmptyDOMElement()
  })
})

