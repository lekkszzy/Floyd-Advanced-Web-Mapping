// ===== Map setup =====
const DUBLIN = [53.3498, -6.2603];
const DEFAULT_ZOOM = 5;

const map = L.map('map').setView(DUBLIN, DEFAULT_ZOOM);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
    minZoom: 2
}).addTo(map);

// ===== State =====
let citiesData = [];
let markers = {};
let cityCount = 0;

const API_URL = '/api/cities/';
const GEOJSON_URL = '/api/cities/geojson/';

// Week 5: heatmap colour palettes per mode
const HEAT_GRADIENTS = {
    default: { 0.2: '#0000ff', 0.5: '#00ffff', 0.75: '#ffff00', 1: '#ff0000' },
    nearest: { 0.2: '#00ffff', 0.5: '#00ff00', 0.75: '#ffff00', 1: '#ff7f00' },
    radius:  { 0.2: '#00ff00', 0.5: '#ffff00', 0.75: '#ff7f00', 1: '#ff0000' }
};

// Part 4.1: cluster group holds all markers
const clusterGroup = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 50
});
map.addLayer(clusterGroup);

// Part 4.3: heatmap layer (off by default, toggled via layer control)
const heatLayer = L.heatLayer([], {
    radius: 35,
    blur: 25,
    maxZoom: 7,
    minOpacity: 0.3,
    gradient: HEAT_GRADIENTS.default
});

// Layer control to switch markers / heatmap on and off
L.control.layers(null, {
    'City markers': clusterGroup,
    'Population heatmap': heatLayer
}, { position: 'topleft', collapsed: false }).addTo(map);

// ===== Load data =====
async function initMap() {
    showLoading(true);
    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        citiesData = data.results || data;   // paginated response -> results
        cityCount = citiesData.length;

        document.getElementById('cityCount').textContent = cityCount;

        addMarkersToMap(citiesData);
        updateHeatmap(citiesData);

    } catch (error) {
        console.error('Error fetching cities:', error);
        alert('Failed to load cities data. Make sure the API is running.');
    } finally {
        showLoading(false);
    }
}

// ===== Markers (clustered) =====
function clearMarkers() {
    clusterGroup.clearLayers();
    markers = {};
}

function addMarkersToMap(cities) {
    clearMarkers();

    cities.forEach(city => {
        const lat = parseFloat(city.latitude);
        const lng = parseFloat(city.longitude);

        if (isNaN(lat) || isNaN(lng)) {
            console.warn(`Invalid coordinates for ${city.name}`);
            return;
        }

        // Capitals get a bigger red marker
        const marker = L.circleMarker([lat, lng], {
            radius: city.is_capital ? 9 : 6,
            fillColor: city.is_capital ? '#dc3545' : '#007bff',
            color: city.is_capital ? '#a71d2a' : '#0056b3',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        });

        marker.bindPopup(createPopupContent(city));
        marker.bindTooltip(city.name);

        // Week 5: clicking a city marker runs the armed proximity search
        marker.on('click', () => {
            if (proximityMode) {
                marker.closePopup();
                runProximitySearch(city);
            }
        });

        clusterGroup.addLayer(marker);
        markers[city.id] = marker;
    });

    document.getElementById('visibleCount').textContent = Object.keys(markers).length;
}

// ===== Heatmap (Part 4.3) =====
function updateHeatmap(cities) {
    const maxPop = Math.max(...cities.map(c => Number(c.population) || 0), 1);

    const heatData = cities
        .filter(c => !isNaN(parseFloat(c.latitude)) && !isNaN(parseFloat(c.longitude)))
        .map(c => [
            parseFloat(c.latitude),
            parseFloat(c.longitude),
            0.3 + 0.7 * ((Number(c.population) || 0) / maxPop)   // weight by population
        ]);

    heatLayer.setOptions({ gradient: HEAT_GRADIENTS.default });
    heatLayer.setLatLngs(heatData);
}

// ===== Popup =====
function createPopupContent(city) {
    return `
        <div class="city-popup">
            <h3>${city.name}</h3>
            <p><strong>Country:</strong> ${city.country}</p>
            ${city.region ? `<p><strong>Region:</strong> ${city.region}</p>` : ''}
            <p><strong>Population:</strong> ${formatNumber(city.population)}</p>
            ${city.population_category ? `<p><strong>Category:</strong> ${city.population_category}</p>` : ''}
            <p><strong>Capital:</strong> ${city.is_capital ? 'Yes' : 'No'}</p>
            <p><strong>Coordinates:</strong> ${Number(city.latitude).toFixed(4)}, ${Number(city.longitude).toFixed(4)}</p>
            ${city.founded_year ? `<p><strong>Founded:</strong> ${city.founded_year}</p>` : ''}
            ${city.timezone ? `<p><strong>Timezone:</strong> ${city.timezone}</p>` : ''}
        </div>
    `;
}

function formatNumber(num) {
    return Number(num).toLocaleString('en-IE');
}

// ===== Search =====
document.getElementById('searchInput').addEventListener('input', function (e) {
    const query = e.target.value.toLowerCase().trim();
    const resultsDiv = document.getElementById('results');

    if (query.length === 0) {
        resultsDiv.innerHTML = '';
        addMarkersToMap(citiesData);
        updateHeatmap(citiesData);
        return;
    }

    const filtered = citiesData.filter(city =>
        city.name.toLowerCase().includes(query) ||
        city.country.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
        resultsDiv.innerHTML = '<p class="no-results">No cities found</p>';
        clearMarkers();
        updateHeatmap([]);
        document.getElementById('visibleCount').textContent = 0;
    } else {
        addMarkersToMap(filtered);
        updateHeatmap(filtered);

        resultsDiv.innerHTML = filtered.map(city => `
            <div class="result-item" onclick="goToCity(${city.id})">
                <strong>${city.name}</strong>, ${city.country}
            </div>
        `).join('');
    }
});

// ===== Navigate to city (works with clusters) =====
function goToCity(cityId) {
    const marker = markers[cityId];
    if (!marker) return;

    // Make sure markers layer is visible
    if (!map.hasLayer(clusterGroup)) {
        map.addLayer(clusterGroup);
    }

    // Unclusters the marker if needed, then opens its popup
    clusterGroup.zoomToShowLayer(marker, () => {
        map.setView(marker.getLatLng(), Math.max(map.getZoom(), 8));
        marker.openPopup();
    });
}

// ===================================================================
// Week 5: Proximity search
// ===================================================================
let proximityMode = null;      // null | 'nearest' | 'radius'
let searchMarker = null;
let radiusCircle = null;
let proximityLayer;
let radiusLayer;

function setupProximitySearch(map) {
    proximityLayer = L.layerGroup().addTo(map);
    radiusLayer = L.layerGroup().addTo(map);

    document.getElementById('nearest-search-btn').addEventListener('click', () => {
        setProximityMode(map, 'nearest');
    });
    document.getElementById('radius-search-btn').addEventListener('click', () => {
        setProximityMode(map, 'radius');
    });
}

function setProximityMode(map, mode) {
    proximityMode = proximityMode === mode ? null : mode;

    document.getElementById('radius-control').classList.toggle(
        'd-none', proximityMode !== 'radius'
    );
    document.getElementById('nearest-search-btn').classList.toggle(
        'active', proximityMode === 'nearest'
    );
    document.getElementById('radius-search-btn').classList.toggle(
        'active', proximityMode === 'radius'
    );
    map.getContainer().style.cursor = proximityMode ? 'crosshair' : '';

    setStatus(proximityMode
        ? 'Now click a city marker (zoom in on a cluster if needed).'
        : 'Choose a search, then click a city marker.');
    clearProximityResults(map);
}

function setStatus(message, isError = false) {
    const status = document.getElementById('proximity-status');
    status.textContent = message;
    status.classList.toggle('error', isError);
}

async function runProximitySearch(city) {
    if (!proximityMode) return;

    // These coordinates come from the selected city's existing API record.
    const lat = Number(city.latitude);
    const lng = Number(city.longitude);
    const radiusKm = Number(document.getElementById('radius-input').value);
    const isRadiusSearch = proximityMode === 'radius';

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setStatus(`${city.name} has invalid coordinates in the API response.`, true);
        return;
    }
    if (isRadiusSearch && (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 20000)) {
        setStatus('Enter a radius greater than 0 and no more than 20000 km.', true);
        return;
    }

    setStatus('Searching…');
    clearProximityResults(map);

    try {
        const response = await fetch(
            isRadiusSearch ? '/api/cities/radius/' : '/api/cities/nearest/',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(isRadiusSearch
                    ? { lat, lng, radius_km: radiusKm }
                    : { lat, lng })
            }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Search failed (${response.status})`);

        // Origin marker
        searchMarker = L.marker([lat, lng])
            .bindTooltip(`Search origin: ${city.name}`)
            .addTo(map);

        const cities = isRadiusSearch ? data.cities : data.nearest_cities;
        const heading = isRadiusSearch
            ? `${data.total_found} cities within ${data.radius_km} km of ${city.name}`
            : `${data.total_found} nearest cities to ${city.name}`;

        showProximityResults(cities, heading);
        updateHeatmapForResults(cities, isRadiusSearch ? 'radius' : 'nearest');

        // Recentre on the selected city (no animation)
        map.setView([lat, lng], Math.max(map.getZoom(), 6), { animate: false });

        if (isRadiusSearch) {
            radiusCircle = L.circle([lat, lng], {
                radius: radiusKm * 1000,     // Leaflet uses metres
                color: '#198754',
                fillOpacity: 0.08
            }).addTo(map);

            cities.forEach((result) => {
                L.circleMarker([result.coordinates.lat, result.coordinates.lng], {
                    radius: 7,
                    color: '#198754',
                    fillColor: '#198754',
                    fillOpacity: 0.7
                })
                    .bindTooltip(`${result.name} — ${result.distance_km} km`)
                    .addTo(radiusLayer);
            });

            map.fitBounds(radiusCircle.getBounds(), {
                padding: [30, 30],
                animate: false
            });
            map.setView([lat, lng], map.getZoom(), { animate: false });
        } else {
            // Numbered markers for the nearest ten
            cities.forEach((result) => {
                L.marker([result.coordinates.lat, result.coordinates.lng], {
                    icon: L.divIcon({
                        className: 'rank-marker',
                        html: String(result.rank),
                        iconSize: [26, 26],
                        iconAnchor: [13, 13]
                    })
                })
                    .bindTooltip(`#${result.rank} ${result.name} — ${result.distance_km} km`)
                    .addTo(proximityLayer);
            });
        }

        setStatus('Search complete.');
    } catch (error) {
        setStatus(error.message, true);
    }
}

function showProximityResults(cities, heading) {
    const results = document.getElementById('proximity-results');
    results.replaceChildren();

    const title = document.createElement('strong');
    title.textContent = heading;
    results.append(title);

    const list = document.createElement('ol');
    cities.forEach((result) => {
        const item = document.createElement('li');
        item.textContent = `${result.name}, ${result.country} — ${result.distance_km} km`;
        item.title = 'Zoom to this city';
        item.addEventListener('click', () => {
            map.setView([result.coordinates.lat, result.coordinates.lng], 8);
        });
        list.append(item);
    });
    results.append(list);
}

function updateHeatmapForResults(cities, mode) {
    const heatData = cities
        .map(result => [result.coordinates.lat, result.coordinates.lng, 1])
        .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

    if (!map.hasLayer(heatLayer)) map.addLayer(heatLayer);   // show heatmap for results
    heatLayer.setOptions({ gradient: HEAT_GRADIENTS[mode] });
    heatLayer.setLatLngs(heatData);
}

function clearProximityResults(map) {
    if (searchMarker) map.removeLayer(searchMarker);
    if (radiusCircle) map.removeLayer(radiusCircle);
    searchMarker = radiusCircle = null;
    proximityLayer?.clearLayers();
    radiusLayer?.clearLayers();
    document.getElementById('proximity-results').replaceChildren();

    // Restore the full-city heatmap
    updateHeatmap(citiesData);
}

// ===== Reset =====
document.getElementById('resetBtn').addEventListener('click', function () {
    document.getElementById('searchInput').value = '';
    document.getElementById('results').innerHTML = '';
    addMarkersToMap(citiesData);

    // Week 5: clear proximity mode, overlays, and results
    proximityMode = null;
    document.getElementById('nearest-search-btn').classList.remove('active');
    document.getElementById('radius-search-btn').classList.remove('active');
    document.getElementById('radius-control').classList.add('d-none');
    map.getContainer().style.cursor = '';
    setStatus('Choose a search, then click a city marker.');
    clearProximityResults(map);   // also restores the full-city heatmap

    map.setView(DUBLIN, DEFAULT_ZOOM, { animate: false });
});

// ===== GeoJSON export (Part 4.2) =====
document.getElementById('downloadBtn').addEventListener('click', async function () {
    try {
        const response = await fetch(GEOJSON_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        const geojson = data.results || data;   // unwrap paginated response

        const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'cities.geojson';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('GeoJSON export failed:', error);
        alert('Could not export GeoJSON.');
    }
});

// ===== Loading indicator =====
function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

setupProximitySearch(map);
initMap();