import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';

/**
 * Carte interactive des POS — Module A4 (Lead Frontend).
 *
 * Affiche les Points de Vente sur une carte Leaflet avec des marqueurs
 * colorés selon la catégorie (Créé / Reconduit / Lié). Permet de
 * sélectionner un POS au clic pour le mettre en surbrille dans la table.
 *
 * @param {{pos: Array, selectedId: number|null, onSelect: function, partnerId: number, dsmId: number}} props
 */
const DEFAULT_POSITION = [4.2, 10.0]; // Cameroun par défaut
const DEFAULT_ZOOM = 7;

const CATEGORY_STYLE = {
  NOUVEAU: { color: '#16a34a', fillColor: '#16a34a', label: 'Créé' },
  RECONDUIT: { color: '#eab308', fillColor: '#eab308', label: 'Reconduit' },
  LIÉ: { color: '#2563eb', fillColor: '#2563eb', label: 'Lié' },
};

const STATUS_STYLE = {
  ACTIF: { color: '#16a34a', fillColor: '#16a34a', label: 'Actif' },
  SUSPENDU: { color: '#eab308', fillColor: '#eab308', label: 'Suspendu' },
  RENOUVELLEMENT: { color: '#3b82f6', fillColor: '#3b82f6', label: 'Renouvellement' },
  CLOTURE: { color: '#dc2626', fillColor: '#dc2626', label: 'Clôturé' },
};

// Délai (ms) avant fermeture du popup après sortie du curseur : laisse à
// l'utilisateur le temps de déplacer la souris dans le menu et de cliquer
// sur les liens (ex. « Voir les détails »).
const POPUP_CLOSE_DELAY = 1500;

export default function POSMap({ pos = [], selectedId = null, onSelect = () => {}, partnerId, dsmId }) {
  const markerRefs = useRef({});
  const closeTimers = useRef({});
  const pinnedIdRef = useRef(null);

  // Normalisation des POS avec coordonnées valides
  const validPos = useMemo(() => {
    return pos
      .map((p) => {
        const lat = parseFloat(p.latitude ?? p.lat);
        const lng = parseFloat(p.longitude ?? p.lng);
        if (isNaN(lat) || isNaN(lng)) return null;
        return {
          ...p,
          lat,
          lng,
          type_pos: p.type_pos ?? p.type ?? 'NOUVEAU',
          statut: p.statut ?? p.status ?? 'ACTIF',
          nom: p.nom ?? p.name ?? '',
          code_pos: p.code_pos ?? p.code ?? '',
          adresse: p.adresse ?? '',
          ville: p.ville ?? '',
          partenaire: p.partenaire ?? (p.partenaire_id ? { id: p.partenaire_id } : null),
          dsm: p.dsm ?? (p.dsm_id ? { id: p.dsm_id } : null),
        };
      })
      .filter(Boolean);
  }, [pos]);

  // POS avec coordonnées invalides (pour affichage des alertes)
  const invalidPos = useMemo(() => {
    return pos.filter((p) => {
      const lat = parseFloat(p.latitude ?? p.lat);
      const lng = parseFloat(p.longitude ?? p.lng);
      return isNaN(lat) || isNaN(lng);
    });
  }, [pos]);

  // Centre de la carte (moyenne des coordonnées)
  const center = useMemo(() => {
    if (validPos.length === 0) return DEFAULT_POSITION;
    
    const avgLat = validPos.reduce((sum, p) => sum + p.lat, 0) / validPos.length;
    const avgLng = validPos.reduce((sum, p) => sum + p.lng, 0) / validPos.length;
    return [avgLat, avgLng];
  }, [validPos]);

  const zoomLevel = validPos.length > 0 ? 12 : DEFAULT_ZOOM;

  // --- Gestion du popup ---------------------------------------------------
  // Survol d'un marqueur  -> ouverture immédiate.
  // Sortie du marqueur    -> fermeture différée (POPUP_CLOSE_DELAY).
  // Survol du popup       -> fermeture annulée (on peut cliquer dedans).
  // Clic sur le marqueur  -> popup « épinglé » (pas de fermeture auto).
  const openPopup = (id) => {
    window.clearTimeout(closeTimers.current[id]);
    markerRefs.current[id]?.openPopup();
  };

  const scheduleClose = (id) => {
    if (pinnedIdRef.current === id) return;
    window.clearTimeout(closeTimers.current[id]);
    closeTimers.current[id] = window.setTimeout(() => {
      markerRefs.current[id]?.closePopup();
    }, POPUP_CLOSE_DELAY);
  };

  const cancelClose = (id) => {
    window.clearTimeout(closeTimers.current[id]);
  };

  const pinPopup = (id) => {
    pinnedIdRef.current = id;
    cancelClose(id);
    openPopup(id);
  };

  // Ouvre (et épingle) le popup du POS sélectionné depuis la table.
  useEffect(() => {
    if (selectedId != null) pinPopup(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <div className="relative h-[320px] w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm sm:h-[420px] lg:h-[520px]">
      <MapContainer
        center={center}
        zoom={zoomLevel}
        className="h-full w-full"
        scrollWheelZoom={true}
        doubleClickZoom={true}
        dragging={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Marqueurs POS */}
        {validPos.map((p) => {
          const catStyle = CATEGORY_STYLE[p.type_pos] || CATEGORY_STYLE.NOUVEAU;
          const statStyle = STATUS_STYLE[p.statut] || STATUS_STYLE.ACTIF;

          return (
            <div key={p.id}>
              <Marker
                ref={(ref) => { if (ref) markerRefs.current[p.id] = ref; }}
                position={[p.lat, p.lng]}
                eventHandlers={{
                  click: () => { onSelect(p); pinPopup(p.id); },
                  mouseover: () => openPopup(p.id),
                  mouseout: () => scheduleClose(p.id),
                }}
                title={`${p.code_pos} - ${p.nom}`}
              >
                <Popup
                  className="z-[1000]"
                  keepInView
                  eventHandlers={{
                    mouseover: () => cancelClose(p.id),
                    mouseout: () => scheduleClose(p.id),
                    remove: () => { if (pinnedIdRef.current === p.id) pinnedIdRef.current = null; },
                  }}
                >
                    <div className="min-w-[200px] p-2 text-left">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="h-3 w-3 rounded-full" style={{ background: catStyle.fillColor }} />
                        <div>
                          <div className="font-medium text-gray-800">{p.code_pos}</div>
                          <div className="text-sm text-gray-600">{p.nom}</div>
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-600 mt-1">
                        Catégorie : <span style={{ color: catStyle.color }}>{catStyle.label}</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        Statut : <span style={{ color: statStyle.color }}>{statStyle.label}</span>
                      </div>
                      
                      {p.adresse && (
                        <div className="text-sm text-gray-600 mt-1">
                          Adresse : {p.adresse}
                        </div>
                      )}
                      {p.ville && (
                        <div className="text-sm text-gray-600">
                          Ville : {p.ville}
                        </div>
                      )}
                      {p.partenaire?.nom && (
                        <div className="text-sm text-gray-600 mt-1">
                          Partenaire : {p.partenaire.nom}
                        </div>
                      )}
                      <div className="text-sm text-gray-600 mt-1">
                        <Link 
                          to={`/pos/${p.id}`} 
                          className="text-blue-600 hover:underline font-medium"
                        >
                          Voir les détails
                        </Link>
                      </div>
                    </div>
                  </Popup>
              </Marker>
            </div>
          );
        })}

        {/* POS sans coordonnées — affichage sous forme de liste dans une légende */}
        {invalidPos.length > 0 && (
          <div className="absolute top-3 right-3 z-[1000] max-w-xs rounded bg-white/95 border border-red-200 p-3 text-xs shadow-sm">
            <div className="flex items-start space-x-2 mb-1">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <div className="font-medium text-red-700">POS sans coordonnées</div>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-red-600">
              {invalidPos.slice(0, 5).map((p) => (
                <li key={p.id}>
                  {p.code_pos} — {p.nom}
                </li>
              ))}
              {invalidPos.length > 5 && (
                <li key="more" className="text-red-600">
                  + {invalidPos.length - 5} autres
                </li>
              )}
            </ul>
          </div>
        )}
      </MapContainer>

      {/* Légende */}
      <div className="absolute bottom-3 left-3 z-[1000] rounded bg-white/95 border border-gray-200 p-2 text-xs shadow-sm">
        <div className="mb-1 font-medium text-gray-700">Catégories</div>
        {Object.entries(CATEGORY_STYLE).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5 text-sm">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: v.fillColor }} />
            <span className="text-gray-700">{v.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}