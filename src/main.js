import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './style.css';

const FALLBACK_CENTER = [51.1657, 10.4515];
const FALLBACK_ZOOM = 6;
const USER_ZOOM = 15;
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const ROUTING_URL = 'https://router.project-osrm.org/route/v1/driving';

const statusElement = document.getElementById('status');
const searchButton = document.getElementById('search-button');
const liveToggle = document.getElementById('live-toggle');
const followToggle = document.getElementById('follow-toggle');

const map = L.map('map');
const markerLayer = L.layerGroup().addTo(map);
const routeLayer = L.layerGroup().addTo(map);
let userLocationMarker;
let activeRequest;
let routeRequest;
let watchId = null;
let followEnabled = false;
const iconsCache = {};

function getIconForTags(tags = {}) {
  // simple mapping based on tags
  const base = import.meta.env.BASE_URL || '';
  const key = tags.amenity === 'vending_machine' ? 'vending'
    : tags.amenity === 'fuel' ? 'fuel'
    : tags.shop === 'kiosk' ? 'kiosk'
    : (tags.shop === 'convenience' || tags.shop === 'tobacco' || tags.shop === 'supermarket' || tags.shop === 'discount') ? 'store'
    : 'vending';

  if (iconsCache[key]) return iconsCache[key];

  const icon = L.icon({
    iconUrl: `${base}icons/${key}.svg`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });

  iconsCache[key] = icon;
  return icon;
}

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap-Mitwirkende',
}).addTo(map);

map.setView(FALLBACK_CENTER, FALLBACK_ZOOM);

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle('error', isError);
}

function centerMapOnUser(coords) {
  map.panTo(coords, { animate: false });
}

function clearRoute() {
  routeLayer.clearLayers();
}

async function drawRouteTo(targetLatLng) {
  if (!userLocationMarker) {
    setStatus('Kein aktueller Standort verfügbar, Route kann nicht gezeichnet werden.', true);
    return;
  }

  if (routeRequest) {
    routeRequest.abort();
  }

  const startLatLng = userLocationMarker.getLatLng();
  const abortController = new AbortController();
  routeRequest = abortController;

  routeLayer.clearLayers();

  setStatus('Straßenroute wird berechnet …');

  try {
    const url = `${ROUTING_URL}/${startLatLng.lng},${startLatLng.lat};${targetLatLng[1]},${targetLatLng[0]}?overview=full&geometries=geojson&steps=false`;
    const response = await fetch(url, { signal: abortController.signal });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const route = Array.isArray(payload.routes) ? payload.routes[0] : null;
    const coordinates = route?.geometry?.coordinates;

    if (!route || !Array.isArray(coordinates) || coordinates.length === 0) {
      throw new Error('Keine Route gefunden');
    }

    const latLngs = coordinates.map(([lon, lat]) => [lat, lon]);

    L.polyline(latLngs, {
      color: '#ef4444',
      weight: 5,
      opacity: 0.95,
      lineCap: 'round',
    }).addTo(routeLayer);

    const distanceKm = route.distance / 1000;
    const minutes = Math.max(1, Math.round(route.duration / 60));
    setStatus(`Straßenroute geladen: ${distanceKm.toFixed(1)} km, ca. ${minutes} Min.`);
  } catch (error) {
    if (error.name === 'AbortError') {
      return;
    }

    setStatus(`Straßenroute nicht verfügbar: ${error.message}`, true);
  } finally {
    if (routeRequest === abortController) {
      routeRequest = undefined;
    }
  }
}

function toOverpassQuery(bounds) {
  const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
  return `[out:json][timeout:25];
(
  node["amenity"="vending_machine"]["vending"="cigarettes"](${bbox});
  nwr["shop"="tobacco"](${bbox});
  nwr["shop"="kiosk"](${bbox});
  nwr["shop"="convenience"](${bbox});
  nwr["amenity"="fuel"](${bbox});
);
out center;`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return character;
    }
  });
}

function createPopupHtml(tags, id) {
  let typeName = 'Verkaufsstelle';
  if (tags.amenity === 'vending_machine') typeName = 'Zigarettenautomat';
  else if (tags.shop === 'tobacco') typeName = 'Tabakwarengeschäft';
  else if (tags.shop === 'kiosk') typeName = 'Kiosk';
  else if (tags.shop === 'convenience') typeName = 'Minimarkt / Späti';
  else if (tags.amenity === 'fuel') typeName = 'Tankstelle';

  const title = tags.name ? `${typeName}: ${tags.name}` : typeName;
  const lines = [`<strong>${escapeHtml(title)}</strong>`];

  if (tags.operator) {
    lines.push(`Betreiber: ${escapeHtml(tags.operator)}`);
  }

  if (tags.opening_hours) {
    lines.push(`Öffnungszeiten: ${escapeHtml(tags.opening_hours)}`);
  }

  lines.push(`<small>OSM-ID: ${id}</small>`);
  return lines.join('<br />');
}

async function searchInCurrentBounds() {
  if (activeRequest) {
    activeRequest.abort();
  }

  // Nutze AbortSignal.any um sowohl auf manuellen Abbruch als auch auf einen Timeout (15 Sekunden) zu reagieren
  const abortController = new AbortController();
  const timeoutSignal = AbortSignal.timeout(15000);
  const combinedSignal = AbortSignal.any([abortController.signal, timeoutSignal]);
  
  activeRequest = abortController;
  const bounds = map.getBounds();
  const query = toOverpassQuery(bounds);

  markerLayer.clearLayers();
  clearRoute();
  setStatus('Suche Verkaufsstellen im sichtbaren Bereich …');
  searchButton.disabled = true;

  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: new URLSearchParams({ data: query }).toString(),
      signal: combinedSignal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const elements = Array.isArray(payload.elements) ? payload.elements : [];

    for (const element of elements) {
      const lat = typeof element.lat === 'number' ? element.lat : element.center?.lat;
      const lon = typeof element.lon === 'number' ? element.lon : element.center?.lon;
      if (typeof lat !== 'number' || typeof lon !== 'number') {
        continue;
      }

      const tags = element.tags || {};
      // use an icon marker for POIs, fallback to circleMarker if icon not available
      try {
        const icon = getIconForTags(tags);
        // add a visible background ring to make icons stand out on the map
        const bg = L.circleMarker([lat, lon], {
          radius: 14,
          fillColor: '#fff5f5',
          color: '#ef4444',
          weight: 2,
          fillOpacity: 0.75,
          interactive: false,
        }).addTo(markerLayer);

        L.marker([lat, lon], { icon })
          .bindPopup(createPopupHtml(tags, element.id))
          .on('click', () => drawRouteTo([lat, lon]))
          .addTo(markerLayer);
      } catch (e) {
        L.circleMarker([lat, lon], {
          radius: 8,
          fillColor: '#ef4444',
          color: '#991b1b',
          weight: 2,
          fillOpacity: 0.9,
        })
          .bindPopup(createPopupHtml(tags, element.id))
          .addTo(markerLayer);
      }
    }

    setStatus(
      elements.length
        ? `${elements.length} Verkaufsstelle(n) gefunden.`
        : 'Keine Verkaufsstellen im sichtbaren Bereich gefunden.',
    );
  } catch (error) {
    if (error.name === 'AbortError') {
      return;
    }

    const errorMessage = error.name === 'TimeoutError' ? 'Zeitüberschreitung bei der Anfrage.' : error.message;
    setStatus(`Fehler bei der Suche: ${errorMessage}`, true);
  } finally {
    if (activeRequest === abortController) {
      activeRequest = null;
    }
    searchButton.disabled = false;
  }
}

function locateUser() {
  if (!('geolocation' in navigator)) {
    setStatus('Geolocation nicht verfügbar. Verwende Deutschland-Mitte.');
    searchInCurrentBounds();
    return;
  }

  setStatus('Standort wird ermittelt …');

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const coords = [position.coords.latitude, position.coords.longitude];

      if (!userLocationMarker) {
        userLocationMarker = L.circleMarker(coords, {
          radius: 7,
          weight: 2,
          color: '#2563eb',
          fillColor: '#60a5fa',
          fillOpacity: 0.85,
        }).addTo(map);
      } else {
        userLocationMarker.setLatLng(coords);
      }

      userLocationMarker.bindPopup(
        `Dein Standort (±${Math.round(position.coords.accuracy)} m)`,
      );

      map.setView(coords, USER_ZOOM);
      searchInCurrentBounds();
    },
    (error) => {
      setStatus(`Standort nicht verfügbar (${error.message}). Verwende Deutschland-Mitte.`, true);
      map.setView(FALLBACK_CENTER, FALLBACK_ZOOM);
      searchInCurrentBounds();
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    },
  );
}

function startWatch() {
  if (!('geolocation' in navigator) || watchId !== null) return;
  setStatus('Live-Tracking aktiviert');
  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const coords = [position.coords.latitude, position.coords.longitude];
      if (!userLocationMarker) {
        userLocationMarker = L.circleMarker(coords, {
          radius: 7,
          weight: 2,
          color: '#2563eb',
          fillColor: '#60a5fa',
          fillOpacity: 0.85,
        }).addTo(map);
      } else {
        userLocationMarker.setLatLng(coords);
      }
      userLocationMarker.bindPopup(`Dein Standort (±${Math.round(position.coords.accuracy)} m)`);
      if (followEnabled) {
        centerMapOnUser(coords);
      }
    },
    (error) => {
      setStatus(`Live-Tracking Fehler: ${error.message}`, true);
    },
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
  );
}

function stopWatch() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    setStatus('Live-Tracking deaktiviert');
  }
}

// UI handlers for live/follow toggles
if (liveToggle) {
  liveToggle.addEventListener('click', () => {
    const on = liveToggle.getAttribute('aria-pressed') !== 'true';
    liveToggle.setAttribute('aria-pressed', String(on));
    liveToggle.textContent = `Live: ${on ? 'An' : 'Aus'}`;
    if (on) startWatch(); else stopWatch();
  });
}

if (followToggle) {
  followToggle.addEventListener('click', () => {
    followEnabled = followToggle.getAttribute('aria-pressed') !== 'true';
    followToggle.setAttribute('aria-pressed', String(followEnabled));
    followToggle.textContent = `Follow: ${followEnabled ? 'An' : 'Aus'}`;
    if (followEnabled && userLocationMarker) {
      centerMapOnUser(userLocationMarker.getLatLng());
    }
  });
}

searchButton.addEventListener('click', () => {
  searchInCurrentBounds();
});

locateUser();
