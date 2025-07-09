// Global variables
let map;
let graph = {};
let graphMap;
let mapMarkers = {};
let routingControl = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function () {
    // Initialize tab switching
    initializeTabs();

    // Initialize both views
    initializeMapView();
    initializeGraphView();

    // Populate the dropdowns
    populateSelectOptions();

    // Set up the event listener for the Find Route button
    document.getElementById('find-route').addEventListener('click', findRouteHandler);
});



// Tab switching functionality
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');

            // Remove active class from all buttons and tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to current button and tab
            button.classList.add('active');
            document.getElementById(tabId).classList.add('active');

            // If we're switching to the map view, invalidate the map size
            if (tabId === 'map-tab' && map) {
                map.invalidateSize();
            }
        });
    });
}

// Function to get color based on safety score
function getSafetyColor(score) {
    if (score >= 7) return '#2ecc71'; // Green for safe
    if (score >= 4) return '#f39c12'; // Orange for moderate
    return '#e74c3c'; // Red for unsafe
}

// Initialize the Leaflet map view
function initializeMapView() {
    // Create the map centered at Dehradun
    map = L.map('map').setView([30.3165, 78.0322], 13);

    // Add the tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Add markers for each place
    data.places.forEach(place => {
        const marker = L.circleMarker([place.lat, place.lng], {
            radius: 10,
            fillColor: getSafetyColor(place.safety_score),
            color: 'white',
            weight: 2,
            fillOpacity: 0.8
        }).addTo(map);

        // Add a popup to the marker
        marker.bindPopup(`
            <div style="text-align:center;">
                <strong>${place.name}</strong><br>
                <span style="color:${getSafetyColor(place.safety_score)}; font-weight:bold;">
                    Safety Score: ${place.safety_score}/10
                </span>
            </div>
        `);

        // Store the marker for later use
        mapMarkers[place.name] = {
            marker: marker,
            latlng: [place.lat, place.lng]
        };
    });

    // Draw connections between places
    data.connections.forEach(connection => {
        const fromPlace = data.places.find(p => p.name === connection.from);
        const toPlace = data.places.find(p => p.name === connection.to);

        if (fromPlace && toPlace) {
            const line = L.polyline([
                [fromPlace.lat, fromPlace.lng],
                [toPlace.lat, toPlace.lng]
            ], {
                color: '#95a5a6',
                weight: 3,
                opacity: 0.7
            }).addTo(map);
        }
    });
}

// Initialize the graph view
function initializeGraphView() {
    const mapContainer = document.getElementById('graph-map');
    mapContainer.innerHTML = '';

    // Render connections
    data.connections.forEach(connection => {
        const fromPlace = data.places.find(p => p.name === connection.from);
        const toPlace = data.places.find(p => p.name === connection.to);

        if (fromPlace && toPlace) {
            createConnectionLine(mapContainer, fromPlace, toPlace, connection.from + '-' + connection.to);
        }
    });

    // Render places
    data.places.forEach(place => {
        createPlaceNode(mapContainer, place);
    });
}

// Function to create a connection line between two places on the graph
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

// Function to create a place node on the graph
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

// Populate the dropdown menus with places
function populateSelectOptions() {
    const startSelect = document.getElementById('start-location');
    const destSelect = document.getElementById('destination');

    // Clear existing options
    startSelect.innerHTML = '';
    destSelect.innerHTML = '';

    // Add place options to select elements
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

// Handler for the Find Route button
function findRouteHandler() {
    const startLocation = document.getElementById('start-location').value;
    const destination = document.getElementById('destination').value;

    if (startLocation === destination) {
        alert('Start location and destination cannot be the same!');
        return;
    }

    // Build the graph adjacency list if it hasn't been built yet
    buildGraph();

    // Find all possible paths between the selected locations
    const safestRoutes = findSafestPaths(startLocation, destination);

    if (safestRoutes.length >= 2) {
        // Display the routes
        displayMultipleRoutes(safestRoutes);

        // If we're in the map view, draw the route on the map
        if (document.getElementById('map-tab').classList.contains('active')) {
            drawMapRoute(safestRoutes[0].path);
        }
    } else if (safestRoutes.length === 1) {
        // If only one path exists, try to create an alternative route
        const alternativeRoutes = createAlternativeRoute(startLocation, destination, safestRoutes[0].path);
        displayMultipleRoutes([safestRoutes[0], ...alternativeRoutes]);

        // If we're in the map view, draw the route on the map
        if (document.getElementById('map-tab').classList.contains('active')) {
            drawMapRoute(safestRoutes[0].path);
        }
    } else {
        alert('No path found between the selected locations!');
        document.getElementById('route-details').style.display = 'none';
    }
}

// Build the graph adjacency list
function buildGraph() {
    graph = {};

    // Initialize the graph
    data.places.forEach(place => {
        graph[place.name] = [];
    });

    // Populate the graph with connections
    data.connections.forEach(connection => {
        // Add bidirectional connections
        graph[connection.from].push(connection.to);
        graph[connection.to].push(connection.from); // Make connections bidirectional
    });
}

// Function to find all possible paths between two locations
function findAllPaths(start, end) {
    const paths = [];
    const visited = {};

    // Helper function for DFS traversal
    function dfs(current, path) {
        // Mark current node as visited
        visited[current] = true;
        path.push(current);

        // If we reached the destination
        if (current === end) {
            paths.push([...path]); // Create a copy of the path
        } else {
            // Explore all neighbors
            for (const neighbor of graph[current]) {
                if (!visited[neighbor]) {
                    dfs(neighbor, path);
                }
            }
        }

        // Backtrack: remove current node from path and mark as unvisited
        path.pop();
        visited[current] = false;
    }

    dfs(start, []);
    return paths;
}

// Function to calculate safety score for a path
function calculatePathSafetyScore(path) {
    let totalScore = 0;

    for (const placeName of path) {
        const place = data.places.find(p => p.name === placeName);
        if (place) {
            totalScore += place.safety_score;
        }
    }

    // Calculate average safety score
    return totalScore / path.length;
}

// Function to find all paths and sort them by safety
function findSafestPaths(start, end) {
    const allPaths = findAllPaths(start, end);

    if (allPaths.length === 0) {
        return [];
    }

    // Calculate safety score for each path
    const pathsWithScores = allPaths.map(path => {
        return {
            path: path,
            safetyScore: calculatePathSafetyScore(path)
        };
    });

    // Sort paths by safety score (descending)
    pathsWithScores.sort((a, b) => b.safetyScore - a.safetyScore);

    return pathsWithScores;
}

// Function to highlight a path on the graph view
function highlightGraphPath(path) {
    // Reset all path lines
    document.querySelectorAll('.path-line').forEach(line => {
        line.classList.remove('selected');
    });

    // Highlight the selected path
    for (let i = 0; i < path.length - 1; i++) {
        const from = path[i];
        const to = path[i + 1];

        // Try both directions since our path lines are identified by from-to
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

// Function to draw a route on the Leaflet map
function drawMapRoute(path) {
    // Remove existing routing control
    if (routingControl) {
        map.removeControl(routingControl);
    }

    // Create waypoints from the path
    const waypoints = path.map(placeName => {
        const place = data.places.find(p => p.name === placeName);
        return L.latLng(place.lat, place.lng);
    });

    // Create a new routing control
    routingControl = L.Routing.control({
        waypoints: waypoints,
        routeWhileDragging: false,
        createMarker: function () { return null; }, // Don't create markers
        lineOptions: {
            styles: [
                { color: '#e74c3c', weight: 6, opacity: 0.9 }
            ]
        },
        router: L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1'
        }),
        show: false // Don't show the routing interface
    }).addTo(map);

    // Fit the map to the route
    setTimeout(() => {
        if (routingControl && routingControl._route) {
            map.fitBounds(L.latLngBounds(waypoints));
        }
    }, 1000);
}

// Function to display a specific route
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

    // Highlight the current route on the graph view
    highlightGraphPath(routes[currentIndex].path);

    // If we're in the map view, draw the route on the map
    if (document.getElementById('map-tab').classList.contains('active')) {
        drawMapRoute(routes[currentIndex].path);
    }

    // Add event listeners to navigation buttons
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

// Function to display multiple route options
function displayMultipleRoutes(routes) {
    // Display the first route initially
    displayRoute(routes, 0);
}

// Function to check if two paths are equal
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

// Function to create alternative routes when only one main route exists
function createAlternativeRoute(start, end, existingPath) {
    // Find all available places that are not in the existing path
    const availablePlaces = data.places
        .filter(place => !existingPath.includes(place.name) &&
            place.name !== start &&
            place.name !== end)
        .map(place => place.name);

    if (availablePlaces.length === 0) {
        return [];
    }

    // Try to create paths through different places
    const alternativeRoutes = [];

    for (const place of availablePlaces) {
        // Try to find a path from start to intermediary place
        const firstLegPaths = findAllPaths(start, place);

        if (firstLegPaths.length > 0) {
            // Try to find a path from intermediary place to end
            const secondLegPaths = findAllPaths(place, end);

            if (secondLegPaths.length > 0) {
                // Combine the two paths (remove duplicate of intermediary place)
                const firstLeg = firstLegPaths[0];
                const secondLeg = secondLegPaths[0].slice(1); // Remove the first element (intermediary place) to avoid duplication

                const fullPath = [...firstLeg, ...secondLeg];

                // Check if this path is different from the existing path
                if (!pathsAreEqual(fullPath, existingPath)) {
                    alternativeRoutes.push({
                        path: fullPath,
                        safetyScore: calculatePathSafetyScore(fullPath),
                        isAlternative: true
                    });

                    // Break after finding one alternative route
                    if (alternativeRoutes.length >= 1) {
                        break;
                    }
                }
            }
        }
    }

    // If we couldn't find a good alternative route, create a less optimal one
    if (alternativeRoutes.length === 0) {
        // Create a deliberately different route by choosing the longest path
        const allPaths = findAllPaths(start, end);
        if (allPaths.length > 1) {
            // Sort by length (descending)
            allPaths.sort((a, b) => b.length - a.length);

            // Choose the longest path that's different from the existing one
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