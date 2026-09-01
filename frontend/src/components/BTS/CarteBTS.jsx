import { useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * Carte interactive de couverture des BTS — Module A4 (Lead Frontend).
 *
 * Implémentation professionnelle utilisant React-Leaflet + OpenStreetMap
 * (fond cartographique réel). Affiche les marqueurs des BTS, leur étendue de
 * couverture (rayon circulaire) et permet de sélectionner une BTS au clic.
 * Le clic remonte la BTS via `onSelect`.
 */
const DEFAULT_POSITION = [4.2, 10.0] // Cameroun par défaut
const DEFAULT_ZOOM = 7

const STATUS_STYLE = {
  ACTIF: { color: '#16a34a', fillColor: '#16a34a', label: 'Actif' },
  MAINTENANCE: { color: '#eab308', fillColor: '#eab308', label: 'Maintenance' },
  HORS_SERVICE: { color: '#dc2626', fillColor: '#dc2626', label: 'Hors service' },
}

// Palette de teintes distinctes attribuées aux étendues de couverture :
// chaque BTS reçoit une couleur propre (hachage stable par id) afin que
// les zones voisines ne fusionnent plus en une masse verte uniforme.
const COVERAGE_PALETTE = [
  '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#0d9488',
  '#65a30d', '#0284c7', '#9333ea', '#e11d48', '#ca8a04',
  '#059669', '#4f46e5',
]

const coverageColor = (bts, index) => {
  if (bts.couleur) return bts.couleur
  const seed = Number(bts.id)
  const rank = Number.isFinite(seed) && seed !== 0 ? Math.abs(seed) : index + 1
  return COVERAGE_PALETTE[rank % COVERAGE_PALETTE.length]
}

/** Convertit un rayon en km en mètres (Leaflet Circle utilise des mètres). */
const rayonKmToMeters = (km) => (km || 20) * 1000

export default function CarteBTS({ btsList = [], selectedId = null, onSelect = () => {}, rayonEnKm = 20 }) {
  const [hover, setHover] = useState(null)

  // Normalisation des BTS avec coordonnées valides
  const validBts = useMemo(
    () =>
      btsList
        .map((bts) => {
          const lat = parseFloat(bts.latitude ?? bts.lat)
          const lng = parseFloat(bts.longitude ?? bts.lng)
          if (Number.isNaN(lat) || Number.isNaN(lng)) return null
          return {
            ...bts,
            lat,
            lng,
            statut: (bts.statut || 'ACTIF').toUpperCase(),
            nom: bts.nom || bts.code_bts,
          }
        })
        .filter(Boolean),
    [btsList]
  )

  const center = validBts.length > 0
    ? [
        validBts.reduce((s, b) => s + b.lat, 0) / validBts.length,
        validBts.reduce((s, b) => s + b.lng, 0) / validBts.length,
      ]
    : DEFAULT_POSITION

  const rayonMeters = rayonKmToMeters(rayonEnKm)

  return (
    <div className="relative h-[320px] w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm sm:h-[420px] lg:h-[520px]">
      <MapContainer
        center={center}
        zoom={validBts.length > 0 ? 13 : DEFAULT_ZOOM}
        className="h-full w-full"
        scrollWheelZoom={true}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Étendues de couverture + marqueurs */}
        {validBts.map((bts, index) => {
          const style = STATUS_STYLE[bts.statut] || STATUS_STYLE.ACTIF
          const selected = bts.id === selectedId || bts.id === hover?.id
          const zoneColor = coverageColor(bts, index)
          return (
            <div key={bts.id}>
              {/* Étendue : teinte unique par BTS, très transparente pour que
                  les recouvrements restent lisibles ; contour fin pointillé
                  hors service/maintenance, plein pour les BTS actives. */}
              <Circle
                center={[bts.lat, bts.lng]}
                pathOptions={{
                  color: zoneColor,
                  fillColor: zoneColor,
                  fillOpacity: selected ? 0.16 : 0.07,
                  weight: selected ? 2 : 1.2,
                  opacity: 0.55,
                  dashArray: bts.statut === 'ACTIF' ? undefined : '5 4',
                }}
                radius={rayonMeters}
                interactive={false}
              />

              {/* Point central : porte la couleur du STATUT (cf. légende) */}
              <CircleMarker
                center={[bts.lat, bts.lng]}
                radius={6}
                pathOptions={{
                  color: '#ffffff',
                  weight: 2,
                  fillColor: style.fillColor,
                  fillOpacity: 1,
                }}
                interactive={false}
              />

              <Marker
                position={[bts.lat, bts.lng]}
                eventHandlers={{
                  click: () => onSelect(bts),
                  mouseover: () => setHover(bts),
                  mouseout: () => setHover(null),
                }}
                title={`${bts.nom} - ${style.label}`}
              >
                {selected && (
                  <Popup>
                    <div className="min-w-[200px] p-2 text-left">
                      <div className="font-medium text-gray-800">{bts.nom}</div>
                      <div className="text-sm text-gray-600">Opérateur : {bts.operateur || 'N/A'}</div>
                      <div className="text-sm text-gray-600">Technologie : {bts.technologie || 'N/A'}</div>
                      <div className="text-sm text-gray-600 mt-1">Région : {bts.region || 'N/A'} | Ville : {bts.ville || 'N/A'}</div>
                      <div className="text-sm text-gray-600 mt-1">Quartier : {bts.quartier || 'N/A'}</div>
                      <div className="text-sm text-gray-600 mt-1">Micro-zone : {bts.micro_zone || 'N/A'}</div>
                      <div className="text-sm text-gray-600 mt-1">Capacité : {bts.capacite_max ?? 'N/A'}</div>
                      <div className="text-sm mt-1">Statut : <span style={{ color: style.color }}>{style.label}</span></div>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${bts.lat},${bts.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs font-medium text-emerald-700 hover:underline"
                      >
                        Ouvrir dans le planificateur cartographique
                      </a>
                    </div>
                  </Popup>
                )}
              </Marker>
            </div>
          )
        })}
      </MapContainer>

      {btsList.some((bts) => Number.isNaN(parseFloat(bts.latitude ?? bts.lat)) || Number.isNaN(parseFloat(bts.longitude ?? bts.lng))) && (
        <div className="absolute right-3 top-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800 shadow-sm border border-amber-200">
          Certaines BTS n'ont pas de coordonnées et ne sont pas placées sur la carte.
        </div>
      )}

      {/* Légende : le statut est porté par le point central de chaque BTS,
          l'étendue circulaire reçoit une teinte propre à chaque BTS. */}
      <div className="absolute bottom-3 left-3 rounded bg-white/95 border border-gray-200 p-2 text-xs shadow-sm">
        <div className="mb-1 font-medium text-gray-700">Statut (point central)</div>
        {Object.entries(STATUS_STYLE).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: v.fillColor }} />
            <span className="text-gray-700">{v.label}</span>
          </div>
        ))}
        <div className="mt-1 border-t border-gray-100 pt-1 text-gray-500">
          Étendue : zone de teinte unique par BTS
        </div>
      </div>
    </div>
  )
}