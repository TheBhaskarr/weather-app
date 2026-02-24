// ============================================
// AI WEATHER PLANNER — Complete Application JS
// ============================================

const apiKey = CONFIG.API_KEY;

// ===================== STATE =====================
let clockInterval = null;
let favorites = [];
let currentUnits = 'metric';
let currentWeatherData = null;
let currentForecastData = null;
let recentSearches = [];
let savedTrips = [];
let searchCount = 0;
let tripCount = 0;
let selectedPrefs = [];
let weatherChart = null;
let comparisonChart = null;
let isDarkTheme = true;

// ===================== DOM REFERENCES =====================
const cityInput = document.getElementById('cityInput');
const homeSearchInput = document.getElementById('homeSearchInput');
const unitSwitch = document.getElementById('unit-switch');
const unitC = document.getElementById('unit-c');
const unitF = document.getElementById('unit-f');
const messageDiv = document.getElementById('message');
const weatherContent = document.getElementById('weatherContent');
const favoriteBtn = document.getElementById('favoriteBtn');
const favoritesList = document.getElementById('favoritesList');
const favoritesContainer = document.getElementById('favoritesContainer');
const cityNameEl = document.getElementById('cityName');
const localTimeEl = document.getElementById('localTime');
const currentTempEl = document.getElementById('currentTemp');
const currentDescriptionEl = document.getElementById('currentDescription');
const currentIconEl = document.getElementById('currentIcon');
const feelsLikeEl = document.getElementById('feelsLike');
const humidityEl = document.getElementById('humidity');
const windSpeedEl = document.getElementById('windSpeed');
const sunriseTimeEl = document.getElementById('sunriseTime');
const sunsetTimeEl = document.getElementById('sunsetTime');
const pressureEl = document.getElementById('pressure');
const visibilityEl = document.getElementById('visibility');
const forecastContainer = document.getElementById('forecastContainer');

// ===================== SPA NAVIGATION =====================
function navigateTo(page) {
    // Hide all sections
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));

    // Show target section
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add('active');

    // Update nav links (desktop)
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === page);
    });

    // Update nav links (mobile)
    document.querySelectorAll('.mobile-nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === page);
    });

    // Close mobile menu
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu) mobileMenu.classList.add('hidden');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Trigger page-specific actions
    if (page === 'dashboard') updateDashboard();
    if (page === 'weather' && currentWeatherData) {
        // Re-render charts if coming back to weather
        setTimeout(() => {
            if (currentForecastData) renderWeatherChart(currentForecastData);
        }, 100);
    }
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    menu.classList.toggle('hidden');
}

// ===================== THEME TOGGLE =====================
function toggleTheme() {
    isDarkTheme = !isDarkTheme;
    document.body.classList.toggle('night-mode', isDarkTheme);
    document.body.classList.toggle('day-mode', !isDarkTheme);

    const icon = document.getElementById('themeIcon');
    icon.className = isDarkTheme ? 'fas fa-moon' : 'fas fa-sun';
}

// ===================== UNIT TOGGLE =====================
function toggleUnits() {
    currentUnits = unitSwitch.checked ? 'imperial' : 'metric';

    unitF.classList.toggle('opacity-50', !unitSwitch.checked);
    unitC.classList.toggle('opacity-50', unitSwitch.checked);

    if (currentWeatherData) {
        updateDisplayedValues();
        if (currentForecastData) {
            displayForecast(currentForecastData);
            renderWeatherChart(currentForecastData);
        }
    }
}

// ===================== CITY AUTOCOMPLETE =====================
const popularCities = [
    "London", "Delhi", "Mumbai", "Tokyo", "New York", "Paris", "Berlin",
    "Sydney", "Singapore", "Dubai", "Toronto", "Los Angeles", "Beijing",
    "Bangkok", "Istanbul", "Rome", "Barcelona", "Amsterdam", "Seoul",
    "Bangalore", "Kolkata", "Chennai", "Hyderabad", "Jaipur", "Goa",
    "Manali", "Shimla", "Darjeeling", "Udaipur", "Varanasi"
];

function setupAutocomplete(inputEl, suggestionsEl) {
    let debounceTimer;

    inputEl.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const value = inputEl.value.toLowerCase().trim();
            const box = document.getElementById(suggestionsEl);
            if (!box) return;

            if (!value) {
                box.classList.add('hidden');
                return;
            }

            const filtered = popularCities.filter(c =>
                c.toLowerCase().includes(value)
            );

            box.innerHTML = '';

            if (filtered.length === 0) {
                box.classList.add('hidden');
                return;
            }

            filtered.forEach(city => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.innerHTML = `<i class="fas fa-location-dot text-cyan-400 mr-2 text-xs"></i>${city}`;
                div.addEventListener('click', () => {
                    inputEl.value = city;
                    box.classList.add('hidden');
                    getWeatherByCity(city);
                    navigateTo('weather');
                });
                box.appendChild(div);
            });

            box.classList.remove('hidden');
        }, 200);
    });

    inputEl.addEventListener('keydown', (e) => {
        const box = document.getElementById(suggestionsEl);
        if (!box) return;
        const items = box.querySelectorAll('.suggestion-item');
        let active = box.querySelector('.suggestion-active');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!active && items.length > 0) {
                items[0].classList.add('suggestion-active');
            } else if (active) {
                active.classList.remove('suggestion-active');
                const next = active.nextElementSibling || items[0];
                if (next) next.classList.add('suggestion-active');
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (active) {
                active.classList.remove('suggestion-active');
                const prev = active.previousElementSibling || items[items.length - 1];
                if (prev) prev.classList.add('suggestion-active');
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (active) {
                active.click();
            } else {
                const city = inputEl.value.trim();
                if (city) {
                    getWeatherByCity(city);
                    navigateTo('weather');
                }
            }
            if (box) box.classList.add('hidden');
        }
    });
}

// Close all suggestion dropdowns on outside click
document.addEventListener('click', (e) => {
    document.querySelectorAll('.suggestions-dropdown').forEach(box => {
        if (!box.parentElement.contains(e.target)) {
            box.classList.add('hidden');
        }
    });
});

// ===================== WEATHER: CORE FUNCTIONS =====================
function showLoader() {
    document.getElementById('loader').classList.remove('hidden');
}

function hideLoader() {
    document.getElementById('loader').classList.add('hidden');
}

function displayMessage(msg, isError = false) {
    messageDiv.textContent = msg;
    messageDiv.className = isError
        ? 'text-center text-red-400 mb-4 text-lg'
        : 'text-center text-amber-300 mb-4 text-lg';
    weatherContent.classList.add('hidden');
}

function getUserLocation() {
    if (navigator.geolocation) {
        displayMessage('Getting your location...', false);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                getWeatherByCoords(latitude, longitude);
            },
            () => {
                displayMessage('Unable to retrieve location. Please search for a city.', true);
            }
        );
    } else {
        displayMessage('Geolocation is not supported by your browser.', true);
    }
}

async function getWeatherByCity(city) {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
    await fetchAndProcessWeather(url);
}

async function getWeatherByCoords(lat, lon) {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    await fetchAndProcessWeather(url);
}

async function fetchAndProcessWeather(weatherUrl) {
    showLoader();
    displayMessage('Fetching weather data...', false);
    weatherContent.classList.add('hidden');
    if (clockInterval) clearInterval(clockInterval);

    try {
        const response = await fetch(weatherUrl);
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || 'Weather data not found');
        }

        currentWeatherData = await response.json();
        localStorage.setItem('cachedWeather', JSON.stringify(currentWeatherData));

        // Add to recent searches
        addRecentSearch(currentWeatherData.name);

        // Fetch forecast
        const forecastURL = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(currentWeatherData.name)}&appid=${apiKey}&units=metric`;
        const forecastResponse = await fetch(forecastURL);
        currentForecastData = await forecastResponse.json();

        messageDiv.textContent = '';
        weatherContent.classList.remove('hidden');
        hideLoader();

        updateUI(currentForecastData);

    } catch (error) {
        console.error('Error fetching weather:', error);
        hideLoader();

        const cached = localStorage.getItem('cachedWeather');
        if (cached) {
            currentWeatherData = JSON.parse(cached);
            messageDiv.textContent = 'Offline — showing cached data';
            messageDiv.className = 'text-center text-amber-300 mb-4 text-lg';
            weatherContent.classList.remove('hidden');
            updateDisplayedValues();
        } else {
            displayMessage(`Error: ${error.message}. Please try again.`, true);
        }
    }
}

// ===================== WEATHER: UI UPDATE =====================
function updateUI(forecastData) {
    if (!currentWeatherData) return;

    // Auto theme based on local time
    const tzOffset = currentWeatherData.timezone;
    const localHour = getLocalHour(tzOffset);
    const isDay = localHour >= 6 && localHour < 19;

    isDarkTheme = !isDay;
    document.body.classList.toggle('day-mode', isDay);
    document.body.classList.toggle('night-mode', !isDay);
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) themeIcon.className = isDarkTheme ? 'fas fa-moon' : 'fas fa-sun';

    // Update clock
    updateClock(tzOffset);
    clockInterval = setInterval(() => updateClock(tzOffset), 1000);

    updateFavoriteButtonState(currentWeatherData.name);
    updateDisplayedValues();
    displayForecast(forecastData);
    renderWeatherChart(forecastData);
}

function updateDisplayedValues() {
    if (!currentWeatherData) return;

    const isMetric = currentUnits === 'metric';
    const windUnit = isMetric ? ' m/s' : ' mph';

    const temp = isMetric
        ? currentWeatherData.main.temp
        : (currentWeatherData.main.temp * 9 / 5) + 32;
    const feelsLike = isMetric
        ? currentWeatherData.main.feels_like
        : (currentWeatherData.main.feels_like * 9 / 5) + 32;
    const windSpeed = isMetric
        ? currentWeatherData.wind.speed
        : currentWeatherData.wind.speed * 2.237;

    cityNameEl.textContent = currentWeatherData.name;
    currentTempEl.textContent = `${Math.round(temp)}°`;
    feelsLikeEl.textContent = `${Math.round(feelsLike)}°`;
    windSpeedEl.textContent = `${windSpeed.toFixed(1)}${windUnit}`;
    currentDescriptionEl.textContent = currentWeatherData.weather[0].description;
    currentIconEl.src = `https://openweathermap.org/img/wn/${currentWeatherData.weather[0].icon}@4x.png`;
    humidityEl.textContent = `${currentWeatherData.main.humidity}%`;

    // Additional details
    if (pressureEl) pressureEl.textContent = `${currentWeatherData.main.pressure} hPa`;
    if (visibilityEl) {
        const vis = currentWeatherData.visibility
            ? (currentWeatherData.visibility / 1000).toFixed(1) + ' km'
            : 'N/A';
        visibilityEl.textContent = vis;
    }

    const tzOffset = currentWeatherData.timezone;
    sunriseTimeEl.textContent = formatTime(currentWeatherData.sys.sunrise, tzOffset);
    sunsetTimeEl.textContent = formatTime(currentWeatherData.sys.sunset, tzOffset);
}

function displayForecast(data) {
    if (!data || !data.list) return;

    forecastContainer.innerHTML = '';
    const dailyForecasts = data.list.filter(item => item.dt_txt.includes('12:00:00'));

    dailyForecasts.slice(0, 5).forEach((forecast, index) => {
        const isMetric = currentUnits === 'metric';
        const temp = isMetric
            ? forecast.main.temp
            : (forecast.main.temp * 9 / 5) + 32;
        const tempMin = isMetric
            ? forecast.main.temp_min
            : (forecast.main.temp_min * 9 / 5) + 32;
        const tempMax = isMetric
            ? forecast.main.temp_max
            : (forecast.main.temp_max * 9 / 5) + 32;
        const tempUnit = isMetric ? '°C' : '°F';

        const date = new Date(forecast.dt * 1000);
        const day = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        const card = document.createElement('div');
        card.className = 'forecast-card';
        card.style.animationDelay = `${index * 0.1}s`;
        card.innerHTML = `
            <p class="font-bold text-base text-white">${day}</p>
            <p class="text-xs text-white/40 mb-1">${dateStr}</p>
            <img src="https://openweathermap.org/img/wn/${forecast.weather[0].icon}@2x.png"
                 alt="${forecast.weather[0].description}"
                 class="w-14 h-14 mx-auto">
            <p class="font-bold text-lg text-white">${Math.round(temp)}${tempUnit}</p>
            <p class="text-xs text-white/40">${Math.round(tempMin)}° / ${Math.round(tempMax)}°</p>
        `;
        forecastContainer.appendChild(card);
    });
}

// ===================== WEATHER CHART =====================
function renderWeatherChart(data) {
    if (!data || !data.list) return;

    const ctx = document.getElementById('weatherChart');
    if (!ctx) return;

    // Get next 8 forecast points (24 hours, every 3h)
    const points = data.list.slice(0, 8);
    const isMetric = currentUnits === 'metric';

    const labels = points.map(p => {
        const d = new Date(p.dt * 1000);
        return d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
    });

    const temps = points.map(p => {
        const t = p.main.temp;
        return isMetric ? Math.round(t) : Math.round((t * 9 / 5) + 32);
    });

    const feelsLike = points.map(p => {
        const t = p.main.feels_like;
        return isMetric ? Math.round(t) : Math.round((t * 9 / 5) + 32);
    });

    if (weatherChart) weatherChart.destroy();

    weatherChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Temperature',
                    data: temps,
                    borderColor: '#22d3ee',
                    backgroundColor: 'rgba(34, 211, 238, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2.5,
                    pointBackgroundColor: '#22d3ee',
                    pointBorderColor: '#22d3ee',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                },
                {
                    label: 'Feels Like',
                    data: feelsLike,
                    borderColor: '#a78bfa',
                    backgroundColor: 'rgba(167, 139, 250, 0.05)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointBackgroundColor: '#a78bfa',
                    pointBorderColor: '#a78bfa',
                    pointRadius: 3,
                    pointHoverRadius: 5,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index',
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: 'rgba(255,255,255,0.6)',
                        font: { size: 12, family: 'Inter' },
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 16,
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#fff',
                    bodyColor: 'rgba(255,255,255,0.7)',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    titleFont: { size: 13, weight: '600', family: 'Inter' },
                    bodyFont: { size: 12, family: 'Inter' },
                    callbacks: {
                        label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}°${isMetric ? 'C' : 'F'}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
                    ticks: {
                        color: 'rgba(255,255,255,0.4)',
                        font: { size: 11, family: 'Inter' }
                    }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
                    ticks: {
                        color: 'rgba(255,255,255,0.4)',
                        font: { size: 11, family: 'Inter' },
                        callback: (val) => val + '°'
                    }
                }
            }
        }
    });
}

// ===================== TIME HELPERS =====================
function getLocalHour(offset) {
    return new Date(
        (new Date().getTime() + (new Date().getTimezoneOffset() * 60000)) + (offset * 1000)
    ).getHours();
}

function updateClock(offset) {
    if (localTimeEl) {
        localTimeEl.textContent = formatTime(Date.now() / 1000, offset, true);
    }
}

function formatTime(unixTimestamp, offset, isClock = false) {
    const date = isClock
        ? new Date((unixTimestamp * 1000 + (new Date().getTimezoneOffset() * 60000)) + (offset * 1000))
        : new Date((unixTimestamp * 1000) + (offset * 1000));
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC'
    });
}

// ===================== FAVORITES LOGIC =====================
function toggleFavorite() {
    const city = cityNameEl.textContent;
    if (!city || city === '--') return;

    const idx = favorites.indexOf(city);
    if (idx > -1) {
        favorites.splice(idx, 1);
    } else {
        favorites.push(city);
    }

    saveFavorites();
    renderFavorites();
    updateFavoriteButtonState(city);
}

function updateFavoriteButtonState(city) {
    const isFav = favorites.includes(city);
    const icon = favoriteBtn.querySelector('i');
    if (icon) {
        icon.className = isFav ? 'fas fa-star' : 'far fa-star';
    }
    favoriteBtn.classList.toggle('text-amber-400', isFav);
    favoriteBtn.classList.toggle('text-white/30', !isFav);
}

function renderFavorites() {
    favoritesList.innerHTML = '';
    favoritesContainer.classList.toggle('hidden', favorites.length === 0);

    favorites.forEach(city => {
        const btn = document.createElement('button');
        btn.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all cursor-pointer';
        btn.innerHTML = `<i class="fas fa-location-dot text-cyan-400 text-xs"></i> ${city}`;
        btn.addEventListener('click', () => getWeatherByCity(city));
        favoritesList.appendChild(btn);
    });
}

function saveFavorites() {
    localStorage.setItem('weatherlyFavorites', JSON.stringify(favorites));
}

function loadFavorites() {
    const stored = localStorage.getItem('weatherlyFavorites');
    if (stored) favorites = JSON.parse(stored);
    renderFavorites();
}

// ===================== RECENT SEARCHES =====================
function addRecentSearch(city) {
    searchCount++;
    localStorage.setItem('searchCount', searchCount);

    // Remove duplicate if exists, add to front
    recentSearches = recentSearches.filter(s => s.city !== city);
    recentSearches.unshift({
        city,
        time: new Date().toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
        })
    });

    // Keep max 10
    if (recentSearches.length > 10) recentSearches.pop();
    localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
}

function loadRecentSearches() {
    const stored = localStorage.getItem('recentSearches');
    if (stored) recentSearches = JSON.parse(stored);

    const countStored = localStorage.getItem('searchCount');
    if (countStored) searchCount = parseInt(countStored, 10);
}

// ===================== AI TRIP PLANNER =====================
function setupTripPlanner() {
    // Preference tag toggles
    document.querySelectorAll('.pref-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            tag.classList.toggle('active');
            const pref = tag.dataset.pref;
            if (selectedPrefs.includes(pref)) {
                selectedPrefs = selectedPrefs.filter(p => p !== pref);
            } else {
                selectedPrefs.push(pref);
            }
        });
    });

    // Trip form submission
    const form = document.getElementById('tripForm');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            generateTripPlan();
        });
    }
}

async function generateTripPlan() {
    const from = document.getElementById('tripFrom').value.trim();
    const to = document.getElementById('tripTo').value.trim();
    const startDate = document.getElementById('tripStartDate').value;
    const endDate = document.getElementById('tripEndDate').value;
    const budget = document.getElementById('tripBudget').value;

    if (!from || !to) {
        alert('Please enter both starting location and destination.');
        return;
    }

    if (!startDate || !endDate) {
        alert('Please select travel dates.');
        return;
    }

    // Show loader, hide placeholder and results
    document.getElementById('tripPlaceholder').classList.add('hidden');
    document.getElementById('tripResults').classList.add('hidden');
    document.getElementById('tripLoader').classList.remove('hidden');

    // Fetch destination weather for suitability
    let destWeather = null;
    try {
        const res = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(to)}&appid=${apiKey}&units=metric`
        );
        if (res.ok) destWeather = await res.json();
    } catch (err) {
        console.warn('Could not fetch destination weather:', err);
    }

    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 1800));

    // Generate trip plan based on inputs
    const plan = buildTripPlan(from, to, startDate, endDate, budget, selectedPrefs, destWeather);

    // Render results
    renderTripResults(plan);

    // Track
    tripCount++;
    localStorage.setItem('tripCount', tripCount);
    saveTripToHistory(plan);

    document.getElementById('tripLoader').classList.add('hidden');
    document.getElementById('tripResults').classList.remove('hidden');
}

function buildTripPlan(from, to, startDate, endDate, budget, prefs, weather) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);

    // Weather suitability
    let suitability = 75;
    let suitNote = 'Moderate weather conditions expected.';
    if (weather) {
        const temp = weather.main.temp;
        const desc = weather.weather[0].main.toLowerCase();
        if (temp >= 15 && temp <= 30 && !desc.includes('rain')) {
            suitability = 92;
            suitNote = 'Excellent weather! Perfect for outdoor activities.';
        } else if (desc.includes('rain') || desc.includes('storm')) {
            suitability = 45;
            suitNote = 'Rain expected. Pack waterproof gear and plan indoor activities.';
        } else if (temp < 5) {
            suitability = 55;
            suitNote = 'Very cold conditions. Heavy winter gear recommended.';
        } else if (temp >= 5 && temp < 15) {
            suitability = 70;
            suitNote = 'Cool weather. Light jacket recommended.';
        } else if (temp > 30 && temp <= 40) {
            suitability = 60;
            suitNote = 'Hot weather expected. Stay hydrated and avoid midday sun.';
        } else if (temp > 40) {
            suitability = 35;
            suitNote = 'Extreme heat warning. Limit outdoor activities.';
        }
    }

    // Best time to visit
    const bestTimeMap = {
        'adventure': 'October - March',
        'relaxation': 'September - November',
        'hill-station': 'March - June',
        'beach': 'November - February',
        'cultural': 'October - March',
        'wildlife': 'November - April',
        'road-trip': 'September - November',
        'foodie': 'Year-round (Festival seasons preferred)'
    };
    const mainPref = prefs.length > 0 ? prefs[0] : 'relaxation';
    const bestTime = bestTimeMap[mainPref] || 'October - March';
    const bestTimeNote = `Based on your "${mainPref}" preference for ${to}.`;

    // Itinerary
    const itinerary = generateItinerary(to, days, prefs, weather);

    // Packing suggestions
    const packing = generatePackingList(weather, prefs);

    // Cost breakdown
    const costBreakdown = generateCostBreakdown(days, budget);

    return {
        destination: to,
        destDescription: `A ${days}-day trip from ${from} to ${to}, curated for ${prefs.length > 0 ? prefs.join(', ') : 'a great experience'}.`,
        suitability,
        suitNote,
        bestTime,
        bestTimeNote,
        itinerary,
        packing,
        costBreakdown,
        from,
        startDate,
        endDate,
        days
    };
}

function generateItinerary(destination, days, prefs, weather) {
    const activities = {
        'adventure': [
            'Trekking and mountain exploration',
            'River rafting or kayaking',
            'Camping under the stars',
            'Zip-lining or bungee jumping',
            'Rock climbing session',
            'Mountain biking trail'
        ],
        'relaxation': [
            'Spa and wellness retreat',
            'Yoga session at sunrise',
            'Leisurely nature walk',
            'Sunset meditation',
            'Scenic boat ride',
            'Resort pool and relaxation'
        ],
        'hill-station': [
            'Scenic viewpoint visit',
            'Tea garden exploration',
            'Waterfall hike',
            'Local market shopping',
            'Nature photography walk',
            'Cable car / ropeway ride'
        ],
        'beach': [
            'Beach sunrise walk',
            'Snorkeling or diving',
            'Beach volleyball and games',
            'Sunset cruise',
            'Seafood tasting tour',
            'Water sports (parasailing, jet ski)'
        ],
        'cultural': [
            'Historical monument tour',
            'Local museum visit',
            'Traditional art workshop',
            'Heritage walking tour',
            'Local cuisine cooking class',
            'Evening cultural performance'
        ],
        'wildlife': [
            'Morning jungle safari',
            'Bird watching excursion',
            'Nature trail walk',
            'Wildlife photography session',
            'Evening safari drive',
            'Visit rescue/breeding center'
        ],
        'road-trip': [
            'Early morning departure with scenic stops',
            'Local roadside café breakfast',
            'Explore a small town en route',
            'Scenic lake / river stop',
            'Sunset viewpoint visit',
            'Night drive with music and snacks'
        ],
        'foodie': [
            'Local street food tour',
            'Fine dining experience',
            'Cooking class with local chef',
            'Market ingredient shopping',
            'Traditional breakfast experience',
            'Dessert and café hopping'
        ]
    };

    const generalActivities = [
        `Arrive at ${destination}, check-in and freshen up`,
        'Explore local area and nearby attractions',
        'Visit popular landmarks and photo opportunities',
        'Try local cuisine at recommended restaurants',
        'Evening leisure walk and shopping',
        'Check-out and departure with memorable experiences'
    ];

    const itinerary = [];
    for (let i = 0; i < days; i++) {
        let dayActivities = [];

        if (i === 0) {
            dayActivities.push(`Arrive at ${destination}, check into accommodation`);
            dayActivities.push('Settle in and explore the nearby area');
        } else if (i === days - 1) {
            dayActivities.push('Pack and check out');
            dayActivities.push('Last-minute souvenir shopping');
            dayActivities.push('Departure');
        } else {
            // Use preference-based activities
            prefs.forEach(pref => {
                const acts = activities[pref];
                if (acts) {
                    const act = acts[i % acts.length];
                    if (!dayActivities.includes(act)) dayActivities.push(act);
                }
            });

            // Fill remaining with general
            if (dayActivities.length < 2) {
                const general = generalActivities[i % generalActivities.length];
                if (!dayActivities.includes(general)) dayActivities.push(general);
            }
        }

        // Add weather note if available
        let weatherNote = '';
        if (weather) {
            const desc = weather.weather[0].description;
            const temp = Math.round(weather.main.temp);
            weatherNote = `Expected: ${desc}, ${temp}°C`;
        }

        itinerary.push({
            day: i + 1,
            title: i === 0 ? 'Arrival Day' : i === days - 1 ? 'Departure Day' : `Day ${i + 1} — Explore`,
            activities: dayActivities,
            weatherNote
        });
    }

    return itinerary;
}

function generatePackingList(weather, prefs) {
    const essentials = ['Passport / ID', 'Charger & Power Bank', 'Toiletries', 'First Aid Kit', 'Reusable Water Bottle'];
    const items = [...essentials];

    if (weather) {
        const temp = weather.main.temp;
        const desc = weather.weather[0].main.toLowerCase();

        if (temp < 10) {
            items.push('Heavy Jacket', 'Thermal Wear', 'Gloves & Beanie', 'Warm Socks');
        } else if (temp < 20) {
            items.push('Light Jacket', 'Sweater', 'Long Pants');
        } else if (temp < 30) {
            items.push('T-Shirts', 'Comfortable Shorts', 'Light Layers');
        } else {
            items.push('Sunscreen (SPF 50+)', 'Sunglasses', 'Hat / Cap', 'Light Cotton Clothes');
        }

        if (desc.includes('rain')) {
            items.push('Umbrella', 'Raincoat / Poncho', 'Waterproof Bag');
        }
    } else {
        items.push('Versatile Layers', 'Sunscreen', 'Umbrella');
    }

    if (prefs.includes('adventure')) items.push('Hiking Boots', 'Backpack', 'Torch / Headlamp');
    if (prefs.includes('beach')) items.push('Swimsuit', 'Flip Flops', 'Beach Towel');
    if (prefs.includes('cultural')) items.push('Modest Clothing', 'Notebook & Pen');
    if (prefs.includes('wildlife')) items.push('Binoculars', 'Camouflage Wear', 'Insect Repellent');
    if (prefs.includes('foodie')) items.push('Antacids', 'Wet Wipes');

    // Remove duplicates
    return [...new Set(items)];
}

function generateCostBreakdown(days, budget) {
    const multipliers = {
        'budget': { hotel: 800, food: 400, transport: 300, activities: 200, misc: 150 },
        'moderate': { hotel: 2500, food: 800, transport: 600, activities: 500, misc: 300 },
        'premium': { hotel: 5000, food: 1500, transport: 1200, activities: 1000, misc: 500 },
        'luxury': { hotel: 12000, food: 3000, transport: 2500, activities: 2000, misc: 1000 }
    };

    const rates = multipliers[budget] || multipliers['moderate'];

    return [
        { label: 'Accommodation', icon: 'fas fa-bed', amount: rates.hotel * days },
        { label: 'Food & Dining', icon: 'fas fa-utensils', amount: rates.food * days },
        { label: 'Transportation', icon: 'fas fa-car', amount: rates.transport * days },
        { label: 'Activities', icon: 'fas fa-ticket', amount: rates.activities * days },
        { label: 'Miscellaneous', icon: 'fas fa-ellipsis', amount: rates.misc * days },
    ];
}

function renderTripResults(plan) {
    // Destination card
    document.getElementById('tripDestName').textContent = plan.destination;
    document.getElementById('tripDestDesc').textContent = plan.destDescription;

    // Weather suitability
    const suitFill = document.querySelector('.suitability-fill');
    if (suitFill) {
        suitFill.style.width = `${plan.suitability}%`;
        // Color based on score
        if (plan.suitability >= 80) suitFill.style.background = 'linear-gradient(90deg, #34d399, #10b981)';
        else if (plan.suitability >= 60) suitFill.style.background = 'linear-gradient(90deg, #fbbf24, #f59e0b)';
        else suitFill.style.background = 'linear-gradient(90deg, #f87171, #ef4444)';
    }
    const suitSpan = document.querySelector('#weatherSuitability span');
    if (suitSpan) suitSpan.textContent = `${plan.suitability}%`;
    document.getElementById('weatherSuitNote').textContent = plan.suitNote;

    // Best time
    document.getElementById('bestTimeVisit').textContent = plan.bestTime;
    document.getElementById('bestTimeNote').textContent = plan.bestTimeNote;

    // Itinerary
    const itList = document.getElementById('itineraryList');
    itList.innerHTML = '';
    plan.itinerary.forEach(day => {
        const div = document.createElement('div');
        div.className = 'itinerary-day glass-card rounded-xl p-4 border border-white/5';
        div.innerHTML = `
            <div class="flex items-center gap-3 mb-2">
                <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <span class="text-sm font-bold text-cyan-400">${day.day}</span>
                </div>
                <div>
                    <h4 class="text-sm font-bold text-white">${day.title}</h4>
                    ${day.weatherNote ? `<p class="text-xs text-amber-300/70"><i class="fas fa-cloud-sun mr-1"></i>${day.weatherNote}</p>` : ''}
                </div>
            </div>
            <ul class="ml-12 space-y-1">
                ${day.activities.map(a => `<li class="text-sm text-white/60 flex items-start gap-2"><i class="fas fa-chevron-right text-cyan-400/50 text-xs mt-1.5 flex-shrink-0"></i>${a}</li>`).join('')}
            </ul>
        `;
        itList.appendChild(div);
    });

    // Packing suggestions
    const packList = document.getElementById('packingList');
    packList.innerHTML = '';
    plan.packing.forEach(item => {
        const div = document.createElement('div');
        div.className = 'flex items-center gap-2 px-3 py-2 rounded-lg bg-white/3 border border-white/5 text-sm text-white/70';
        div.innerHTML = `<i class="fas fa-check-circle text-emerald-400 text-xs"></i> ${item}`;
        packList.appendChild(div);
    });

    // Cost breakdown
    const costList = document.getElementById('costBreakdown');
    costList.innerHTML = '';
    let total = 0;
    plan.costBreakdown.forEach(item => {
        total += item.amount;
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between';
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                    <i class="${item.icon} text-emerald-400 text-xs"></i>
                </div>
                <span class="text-sm text-white/70">${item.label}</span>
            </div>
            <span class="text-sm font-bold text-white">₹${item.amount.toLocaleString('en-IN')}</span>
        `;
        costList.appendChild(div);
    });
    document.getElementById('totalCost').textContent = `₹${total.toLocaleString('en-IN')}`;
}

function saveTripToHistory(plan) {
    savedTrips.unshift({
        from: plan.from,
        to: plan.destination,
        dates: `${plan.startDate} → ${plan.endDate}`,
        days: plan.days,
        timestamp: new Date().toISOString()
    });
    if (savedTrips.length > 10) savedTrips.pop();
    localStorage.setItem('savedTrips', JSON.stringify(savedTrips));
}

// ===================== DASHBOARD =====================
function updateDashboard() {
    // Stats
    const dashSearch = document.getElementById('dashSearchCount');
    const dashTrip = document.getElementById('dashTripCount');
    const dashFav = document.getElementById('dashFavCount');

    if (dashSearch) dashSearch.textContent = searchCount;
    if (dashTrip) dashTrip.textContent = tripCount;
    if (dashFav) dashFav.textContent = favorites.length;

    // Recent searches
    renderRecentSearches();

    // Saved trips
    renderSavedTrips();

    // Comparison chart
    renderComparisonChart();
}

function renderRecentSearches() {
    const container = document.getElementById('recentSearchesList');
    if (!container) return;

    if (recentSearches.length === 0) {
        container.innerHTML = '<p class="text-white/30 text-sm text-center py-6">No recent searches yet.</p>';
        return;
    }

    container.innerHTML = '';
    recentSearches.forEach(search => {
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between px-4 py-2.5 rounded-lg bg-white/3 border border-white/5 hover:bg-white/5 cursor-pointer transition-all';
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <i class="fas fa-clock-rotate-left text-amber-400/60 text-xs"></i>
                <span class="text-sm text-white/70 font-medium">${search.city}</span>
            </div>
            <span class="text-xs text-white/30">${search.time}</span>
        `;
        div.addEventListener('click', () => {
            getWeatherByCity(search.city);
            navigateTo('weather');
        });
        container.appendChild(div);
    });
}

function renderSavedTrips() {
    const container = document.getElementById('savedTripsList');
    if (!container) return;

    if (savedTrips.length === 0) {
        container.innerHTML = '<p class="text-white/30 text-sm text-center py-6">No saved trips yet. Plan your first trip!</p>';
        return;
    }

    container.innerHTML = '';
    savedTrips.forEach(trip => {
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between px-4 py-2.5 rounded-lg bg-white/3 border border-white/5';
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
                    <i class="fas fa-route text-purple-400 text-xs"></i>
                </div>
                <div>
                    <p class="text-sm text-white/70 font-medium">${trip.from} → ${trip.to}</p>
                    <p class="text-xs text-white/30">${trip.days} days · ${trip.dates}</p>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

function renderComparisonChart() {
    const ctx = document.getElementById('comparisonChart');
    if (!ctx) return;

    if (comparisonChart) comparisonChart.destroy();

    // Simulated data for predicted vs actual comparison
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // If we have real forecast data, use it; otherwise use sample
    let predicted, actual;
    if (currentForecastData && currentForecastData.list) {
        const points = currentForecastData.list
            .filter(item => item.dt_txt.includes('12:00:00'))
            .slice(0, 7);

        predicted = points.map(p => Math.round(p.main.temp));
        // Simulate "actual" with slight variance
        actual = predicted.map(t => t + Math.floor(Math.random() * 5) - 2);
    } else {
        predicted = [28, 26, 24, 27, 30, 29, 25];
        actual = [27, 25, 25, 28, 29, 30, 24];
    }

    comparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Predicted (°C)',
                    data: predicted,
                    backgroundColor: 'rgba(34, 211, 238, 0.5)',
                    borderColor: '#22d3ee',
                    borderWidth: 1.5,
                    borderRadius: 6,
                    barPercentage: 0.6,
                },
                {
                    label: 'Actual (°C)',
                    data: actual,
                    backgroundColor: 'rgba(167, 139, 250, 0.5)',
                    borderColor: '#a78bfa',
                    borderWidth: 1.5,
                    borderRadius: 6,
                    barPercentage: 0.6,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: 'rgba(255,255,255,0.6)',
                        font: { size: 12, family: 'Inter' },
                        usePointStyle: true,
                        pointStyle: 'rectRounded',
                        padding: 16,
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#fff',
                    bodyColor: 'rgba(255,255,255,0.7)',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    titleFont: { size: 13, weight: '600', family: 'Inter' },
                    bodyFont: { size: 12, family: 'Inter' },
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: 'rgba(255,255,255,0.4)',
                        font: { size: 11, family: 'Inter' }
                    }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
                    ticks: {
                        color: 'rgba(255,255,255,0.4)',
                        font: { size: 11, family: 'Inter' },
                        callback: (val) => val + '°'
                    }
                }
            }
        }
    });
}

// ===================== INITIALIZATION =====================
function loadSavedData() {
    // Favorites
    loadFavorites();

    // Recent searches
    loadRecentSearches();

    // Saved trips
    const storedTrips = localStorage.getItem('savedTrips');
    if (storedTrips) savedTrips = JSON.parse(storedTrips);

    const storedTripCount = localStorage.getItem('tripCount');
    if (storedTripCount) tripCount = parseInt(storedTripCount, 10);
}

window.addEventListener('DOMContentLoaded', () => {
    loadSavedData();

    // Setup autocomplete on all search inputs
    if (homeSearchInput) setupAutocomplete(homeSearchInput, 'homeSearchSuggestions');
    if (cityInput) setupAutocomplete(cityInput, 'weatherSearchSuggestions');

    // Unit toggle
    if (unitSwitch) unitSwitch.addEventListener('change', toggleUnits);

    // Setup trip planner
    setupTripPlanner();

    // Start on home page
    navigateTo('home');

    // Preload weather for default/favorite city
    const initialCity = favorites.length > 0 ? favorites[0] : 'London';
    getWeatherByCity(initialCity);
});
