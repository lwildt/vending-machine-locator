import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2xUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import './style.css';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2xUrl,
  iconUrl: markerIconUrl,
  shadowUrl: markerShadowUrl,
});

const FALLBACK_CENTER = [51.1657, 10.4515];
const FALLBACK_ZOOM = 6;
const USER_ZOOM = 15;
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const statusElement = document.getElementById('status');
const searchButton = document.getElementById('search-button');

const map = L.map('map');
const markerLayer = L.layerGroup().addTo(map);
let userLocationMarker;
let activeRequest;

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap-Mitwirkende',
}).addTo(map);

map.setView(FALLBACK_CENTER, FALLBACK_ZOOM);

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle('error', isError);
}

function toOverpassQuery(bounds) {
  return `[out:json][timeout:25];\n(\n  node["amenity"="vending_machine"]["vending"="cigarettes"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});\n);\nout body;`;
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
  const lines = [`<strong>${escapeHtml(tags.name || 'Zigarettenautomat')}</strong>`];

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

  const controller = new AbortController();
  activeRequest = controller;
  const bounds = map.getBounds();
  const query = toOverpassQuery(bounds);

  markerLayer.clearLayers();
  setStatus('Suche Zigarettenautomaten im sichtbaren Bereich …');

  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: new URLSearchParams({ data: query }).toString(),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const elements = Array.isArray(payload.elements) ? payload.elements : [];

    for (const element of elements) {
      if (typeof element.lat !== 'number' || typeof element.lon !== 'number') {
        continue;
      }

      L.marker([element.lat, element.lon])
        .bindPopup(createPopupHtml(element.tags || {}, element.id))
        .addTo(markerLayer);
    }

    setStatus(
      elements.length
        ? `${elements.length} Zigarettenautomat(en) gefunden.`
        : 'Keine Zigarettenautomaten im sichtbaren Bereich gefunden.',
    );
  } catch (error) {
    if (error.name === 'AbortError') {
      return;
    }

    setStatus(`Fehler bei der Overpass-Abfrage: ${error.message}`, true);
  } finally {
    if (activeRequest === controller) {
      activeRequest = null;
    }
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

searchButton.addEventListener('click', () => {
  searchInCurrentBounds();
});

locateUser();
