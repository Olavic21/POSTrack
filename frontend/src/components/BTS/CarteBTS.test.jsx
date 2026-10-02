import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children, eventHandlers, position, title }) => (
    <button
      type="button"
      data-testid="marker"
      data-position={JSON.stringify(position)}
      title={title}
      onClick={() => eventHandlers?.click?.()}
    >
      {children}
    </button>
  ),
  Popup: ({ children }) => <div data-testid="popup">{children}</div>,
  Circle: ({ center }) => <div data-testid="circle" data-center={JSON.stringify(center)} />,
  CircleMarker: ({ children, center }) => (
    <div data-testid="circle-marker" data-center={JSON.stringify(center)}>{children}</div>
  ),
}))

import CarteBTS from './CarteBTS'

describe('CarteBTS', () => {
  it('normalise et affiche une BTS avec coordonnées valides', () => {
    const onSelect = vi.fn()
    const btsList = [
      {
        id: 1,
        nom: 'Antenne Akwa',
        code_bts: 'BTS-DLA-01',
        latitude: '4.0511',
        longitude: '9.7679',
        operateur: 'CAMTEL',
        technologie: '4G',
        ville: 'Douala',
        region: 'Littoral',
        capacite_max: 1000,
        statut: 'ACTIF',
      },
      {
        id: 2,
        nom: 'BTS sans coords',
        code_bts: 'BTS-NULL',
      },
    ]

    render(<CarteBTS btsList={btsList} selectedId={1} onSelect={onSelect} rayonEnKm={10} />)

    expect(screen.getByTestId('map-container')).toBeInTheDocument()
    const markers = screen.getAllByTestId('marker')
    expect(markers).toHaveLength(1)
    expect(markers[0]).toHaveAttribute('title', 'Antenne Akwa - Actif')
    expect(markers[0]).toHaveAttribute('data-position', JSON.stringify([4.0511, 9.7679]))

    markers[0].click()
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0][0]).toMatchObject({
      id: 1,
      nom: 'Antenne Akwa',
      lat: 4.0511,
      lng: 9.7679,
    })
  })
})