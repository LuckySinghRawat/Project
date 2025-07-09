let map;
let graph = {};
let graphMap;
let mapMarkers = {};
let routingControl = null;

document.addEventListener('DOMContentLoaded', function () {
    initializeTabs();
    initializeMapView();
    initializeGraphView();
    populateSelectOptions();
    document.getElementById('find-route').addEventListener('click', findRouteHandler);
});

function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(tabId).classList.add('active');
            if (tabId === 'map-tab' && map) {
                map.invalidateSize();
            }
        });
    });
}

function getSafetyColor(score) {
    if (score >= 7) return '#2ecc71';
    if (score >= 4) return '#f39c12';
    return '#e74c3c';
}

function initializeMapView() {
    map = L.map('map').setView([30.3165, 78.0322], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    data.places.forEach(place => {
        const marker = L.circleMarker([place.lat, place.lng], {
            radius: 10,
            fillColor: getSafetyColor(place.safety_score),
            color: 'white',
            weight: 2,
            fillOpacity: 0.8
        }).addTo(map);
        marker.bindPopup(`
            <div style="text-align:center;">
                <strong>${place.name}</strong><br>
                <span style="color:${getSafetyColor(place.safety_score)}; font-weight:bold;">
                    Safety Score: ${place.safety_score}/10
                </span>
            </div>
        `);
        mapMarkers[place.name] = {
            marker: marker,
            latlng: [place.lat, place.lng]
        };
    });

    data.connections.forEach(connection => {
        const fromPlace = data.places.find(p => p.name === connection.from);
        const toPlace = data.places.find(p => p.name === connection.to);
        if (fromPlace && toPlace) {
        }
    });
}

function initializeGraphView() {
    const mapContainer = document.getElementById('graph-map');
    mapContainer.innerHTML = '';
    data.connections.forEach(connection => {
        const fromPlace = data.places.find(p => p.name === connection.from);
        const toPlace = data.places.find(p => p.name === connection.to);
        if (fromPlace && toPlace) {
            createConnectionLine(mapContainer, fromPlace, toPlace, connection.from + '-' + connection.to);
        }
    });
    data.places.forEach(place => {
        createPlaceNode(mapContainer, place);
    });
}

function createConnectionLine(container, fromPlace, toPlace, id) {
    const line = document.createElement('div');
    line.classList.add('path-line');
    line.id = `path-${id}`;
    const dx = toPlace.x - fromPlace.x;
    const dy = toPlace.y - fromPlace.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    line.style.width = `${length}px`;
    line.style.left = `${fromPlace.x}px`;
    line.style.top = `${fromPlace.y}px`;
    line.style.transform = `rotate(${angle}deg)`;
    container.appendChild(line);
}

function createPlaceNode(container, place) {
    const node = document.createElement('div');
    node.classList.add('place-node');
    node.style.left = `${place.x - 25}px`;
    node.style.top = `${place.y - 25}px`;
    node.style.backgroundColor = getSafetyColor(place.safety_score);
    node.textContent = place.safety_score;
    node.title = place.name;
    const label = document.createElement('div');
    label.classList.add('place-label');
    label.textContent = place.name;
    label.style.left = `${place.x - 25}px`;
    label.style.top = `${place.y + 30}px`;
    container.appendChild(node);
    container.appendChild(label);
}

function populateSelectOptions() {
    const startSelect = document.getElementById('start-location');
    const destSelect = document.getElementById('destination');
    startSelect.innerHTML = '';
    destSelect.innerHTML = '';
    data.places.forEach(place => {
        const startOption = document.createElement('option');
        startOption.value = place.name;
        startOption.textContent = `${place.name} (Safety: ${place.safety_score}/10)`;
        startSelect.appendChild(startOption);
        const destOption = document.createElement('option');
        destOption.value = place.name;
        destOption.textContent = `${place.name} (Safety: ${place.safety_score}/10)`;
        destSelect.appendChild(destOption);
    });
}

function findRouteHandler() {
    const startLocation = document.getElementById('start-location').value;
    const destination = document.getElementById('destination').value;
    if (startLocation === destination) {
        alert('Start location and destination cannot be the same!');
        return;
    }
    buildGraph();
    const safestRoutes = findSafestPaths(startLocation, destination);
    if (safestRoutes.length >= 2) {
        displayMultipleRoutes(safestRoutes);
        if (document.getElementById('map-tab').classList.contains('active')) {
            drawMapRoute(safestRoutes[0].path);
        }
    } else if (safestRoutes.length === 1) {
        const alternativeRoutes = createAlternativeRoute(startLocation, destination, safestRoutes[0].path);
        displayMultipleRoutes([safestRoutes[0], ...alternativeRoutes]);
        if (document.getElementById('map-tab').classList.contains('active')) {
            drawMapRoute(safestRoutes[0].path);
        }
    } else {
        alert('No path found between the selected locations!');
        document.getElementById('route-details').style.display = 'none';
    }
}

function buildGraph() {
    graph = {};
    data.places.forEach(place => {
        graph[place.name] = [];
    });
    data.connections.forEach(connection => {
        graph[connection.from].push(connection.to);
        graph[connection.to].push(connection.from);
    });
}

function findAllPaths(start, end) {
    const paths = [];
    const visited = {};
    function dfs(current, path) {
        visited[current] = true;
        path.push(current);
        if (current === end) {
            paths.push([...path]);
        } else {
            for (const neighbor of graph[current]) {
                if (!visited[neighbor]) {
                    dfs(neighbor, path);
                }
            }
        }
        path.pop();
        visited[current] = false;
    }
    dfs(start, []);
    return paths;
}

function calculatePathSafetyScore(path) {
    let totalScore = 0;
    for (const placeName of path) {
        const place = data.places.find(p => p.name === placeName);
        if (place) {
            totalScore += place.safety_score;
        }
    }
    return totalScore / path.length;
}

function findSafestPaths(start, end) {
    const allPaths = findAllPaths(start, end);
    if (allPaths.length === 0) {
        return [];
    }
    const pathsWithScores = allPaths.map(path => {
        return {
            path: path,
            safetyScore: calculatePathSafetyScore(path)
        };
    });
    pathsWithScores.sort((a, b) => b.safetyScore - a.safetyScore);
    return pathsWithScores;
}

function highlightGraphPath(path) {
    document.querySelectorAll('.path-line').forEach(line => {
        line.classList.remove('selected');
    });
    for (let i = 0; i < path.length - 1; i++) {
        const from = path[i];
        const to = path[i + 1];
        const pathLine1 = document.getElementById(`path-${from}-${to}`);
        const pathLine2 = document.getElementById(`path-${to}-${from}`);
        if (pathLine1) {
            pathLine1.classList.add('selected');
        }
        if (pathLine2) {
            pathLine2.classList.add('selected');
        }
    }
}

function drawMapRoute(path) {
    if (routingControl) {
        map.removeControl(routingControl);
    }
    const waypoints = path.map(placeName => {
        const place = data.places.find(p => p.name === placeName);
        return L.latLng(place.lat, place.lng);
    });
    routingControl = L.Routing.control({
        waypoints: waypoints,
        routeWhileDragging: false,
        createMarker: function () { return null; },
        lineOptions: {
            styles: [
                { color: '#e74c3c', weight: 6, opacity: 0.9 }
            ]
        },
        router: L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1'
        }),
        show: false
    }).addTo(map);
    setTimeout(() => {
        if (routingControl && routingControl._route) {
            map.fitBounds(L.latLngBounds(waypoints));
        }
    }, 1000);
}

function displayRoute(routes, currentIndex) {
    const routeDetails = document.getElementById('route-details');
    const routeInfo = document.getElementById('route-info');
    routeDetails.style.display = 'block';
    const route = routes[currentIndex];
    const { path, safetyScore } = route;
    let routeTitle = `Route Option ${currentIndex + 1} of ${routes.length}`;
    if (currentIndex === 0) {
        routeTitle += " (Safest Route)";
    } else if (route.isAlternative) {
        routeTitle += " (Alternative Route)";
    }
    let routeHTML = `
        <div class="route-navigation">
            <button id="prev-route" class="route-nav-btn" ${currentIndex === 0 ? 'disabled' : ''}>← Previous Route</button>
            <div class="route-indicator">${currentIndex + 1} / ${routes.length}</div>
            <button id="next-route" class="route-nav-btn" ${currentIndex === routes.length - 1 ? 'disabled' : ''}>Next Route →</button>
        </div>
        <div class="route-comparison">
            <div class="route-comparison-item">
                <div>Available Routes</div>
                <div class="route-comparison-value">${routes.length}</div>
            </div>
            <div class="route-comparison-item">
                <div>Safest Score</div>
                <div class="route-comparison-value">${routes[0].safetyScore.toFixed(2)}/10</div>
            </div>
            <div class="route-comparison-item">
                <div>Shortest Path</div>
                <div class="route-comparison-value">${Math.min(...routes.map(r => r.path.length))} locations</div>
            </div>
        </div>
        <div class="route-option" style="background-color: #f0f9ff; border-left: 4px solid ${currentIndex === 0 ? '#2ecc71' : '#3498db'};">
            <h4>${routeTitle}</h4>
            <p><strong>Average Safety Score:</strong> ${safetyScore.toFixed(2)}/10</p>
            <p><strong>Total Locations:</strong> ${path.length}</p>
            <p><strong>Path:</strong> ${path.join(' → ')}</p>
            <p><strong>Places on this route:</strong></p>
            <ul>
    `;
    path.forEach(placeName => {
        const place = data.places.find(p => p.name === placeName);
        let color = getSafetyColor(place.safety_score);
        routeHTML += `<li>${placeName} <span style="color: ${color}; font-weight: bold;">(Safety Score: ${place.safety_score}/10)</span></li>`;
    });
    routeHTML += `
            </ul>
        </div>
    `;
    routeInfo.innerHTML = routeHTML;
    highlightGraphPath(routes[currentIndex].path);
    if (document.getElementById('map-tab').classList.contains('active')) {
        drawMapRoute(routes[currentIndex].path);
    }
    document.getElementById('prev-route').addEventListener('click', function () {
        if (currentIndex > 0) {
            displayRoute(routes, currentIndex - 1);
        }
    });
    document.getElementById('next-route').addEventListener('click', function () {
        if (currentIndex < routes.length - 1) {
            displayRoute(routes, currentIndex + 1);
        }
    });
}

function displayMultipleRoutes(routes) {
    displayRoute(routes, 0);
}

function pathsAreEqual(path1, path2) {
    if (path1.length !== path2.length) {
        return false;
    }
    for (let i = 0; i < path1.length; i++) {
        if (path1[i] !== path2[i]) {
            return false;
        }
    }
    return true;
}

function createAlternativeRoute(start, end, existingPath) {
    const availablePlaces = data.places
        .filter(place => !existingPath.includes(place.name) &&
            place.name !== start &&
            place.name !== end)
        .map(place => place.name);
    if (availablePlaces.length === 0) {
        return [];
    }
    const alternativeRoutes = [];
    for (const place of availablePlaces) {
        const firstLegPaths = findAllPaths(start, place);
        if (firstLegPaths.length > 0) {
            const secondLegPaths = findAllPaths(place, end);
            if (secondLegPaths.length > 0) {
                const firstLeg = firstLegPaths[0];
                const secondLeg = secondLegPaths[0].slice(1);
                const fullPath = [...firstLeg, ...secondLeg];
                if (!pathsAreEqual(fullPath, existingPath)) {
                    alternativeRoutes.push({
                        path: fullPath,
                        safetyScore: calculatePathSafetyScore(fullPath),
                        isAlternative: true
                    });
                    if (alternativeRoutes.length >= 1) {
                        break;
                    }
                }
            }
        }
    }
    if (alternativeRoutes.length === 0) {
        const allPaths = findAllPaths(start, end);
        if (allPaths.length > 1) {
            allPaths.sort((a, b) => b.length - a.length);
            for (const path of allPaths) {
                if (!pathsAreEqual(path, existingPath)) {
                    alternativeRoutes.push({
                        path: path,
                        safetyScore: calculatePathSafetyScore(path),
                        isAlternative: true
                    });
                    break;
                }
            }
        }
    }
    return alternativeRoutes;
}
