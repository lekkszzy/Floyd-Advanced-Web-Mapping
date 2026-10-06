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
    minOpacity: 0.3
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

// ===== Reset =====
document.getElementById('resetBtn').addEventListener('click', function () {
    map.setView(DUBLIN, DEFAULT_ZOOM);
    document.getElementById('searchInput').value = '';
    document.getElementById('results').innerHTML = '';
    addMarkersToMap(citiesData);
    updateHeatmap(citiesData);
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

initMap();