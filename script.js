const apiKey = CONFIG.API_KEY;
let clockInterval;
let favorites = [];
let currentUnits = 'metric'; // 'metric' or 'imperial'
let currentWeatherData = null; // To store raw weather data

// --- DOM ELEMENTS ---
const cityInput = document.getElementById('cityInput');
const themeSwitch = document.getElementById('theme-switch');
const unitSwitch = document.getElementById('unit-switch');
const unitC = document.getElementById('unit-c');
const unitF = document.getElementById('unit-f');
const locationBtn = document.getElementById('locationBtn');
const messageDiv = document.getElementById('message');
const appContainer = document.getElementById('appContainer');
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
const forecastContainer = document.getElementById('forecastContainer');

// --- EVENT LISTENERS ---
cityInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') { const city = cityInput.value.trim(); if (city) getWeatherByCity(city); } });
locationBtn.addEventListener('click', getUserLocation);
themeSwitch.addEventListener('change', () => { document.body.classList.toggle('day-mode'); document.body.classList.toggle('night-mode'); });
unitSwitch.addEventListener('change', toggleUnits);
favoriteBtn.addEventListener('click', toggleFavorite);

// --- AUTOCOMPLETE ---
const cities = ["London","Delhi","Mumbai","Tokyo","New York","Paris","Berlin"];

let debounce;

function showSuggestions() {
    const value = cityInput.value.toLowerCase();
    const box = document.getElementById("suggestions");

    if (!value) return box.classList.add("hidden");

    box.innerHTML = "";
    cities.filter(c => c.toLowerCase().includes(value))
        .forEach(city => {
            const div = document.createElement("div");
            div.textContent = city;
            div.className = "cursor-pointer";
            div.onclick = () => {
                cityInput.value = city;
                box.classList.add("hidden");
                getWeatherByCity(city);
            };
            box.appendChild(div);
        });

    if (!box.children.length) {
        box.classList.add("hidden");
        return;
    }

    box.classList.remove("hidden");
}

cityInput.addEventListener("input", () => {
    clearTimeout(debounce);

    debounce = setTimeout(() => {
        showSuggestions();
    }, 200);
});

// Keyboard navigation
cityInput.addEventListener("keydown", e => {
    const items = document.querySelectorAll("#suggestions div");
    let active = document.querySelector(".active-suggestion");

    if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!active) items[0]?.classList.add("active-suggestion");
        else {
            active.classList.remove("active-suggestion");
            (active.nextElementSibling || items[0])
                ?.classList.add("active-suggestion");
        }
    }

    if (e.key === "Enter" && active)
        active.click();
});

// Close suggestions on outside click
document.addEventListener("click", e => {
    if (!e.target.closest(".relative"))
        document.getElementById("suggestions").classList.add("hidden");
});

// --- CORE FUNCTIONS ---
function displayMessage(msg, isError = false) {
    messageDiv.textContent = msg;
    messageDiv.className = isError ? 'text-center text-red-500 mb-4 text-lg' : 'text-center text-yellow-400 mb-4 text-lg';
    weatherContent.classList.add('hidden');
}

function getUserLocation() {
    if (navigator.geolocation) {
        displayMessage("Getting your location...", false);
        navigator.geolocation.getCurrentPosition(
            position => {
                const { latitude, longitude } = position.coords;
                getWeatherByCoords(latitude, longitude);
            },
            () => { displayMessage("Unable to retrieve your location. Please grant permission or search for a city.", true); }
        );
    } else {
        displayMessage("Geolocation is not supported by your browser.", true);
    }
}

async function getWeatherByCity(city) {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;
    fetchAndProcessWeather(url);
}

async function getWeatherByCoords(lat, lon) {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    fetchAndProcessWeather(url);
}

async function fetchAndProcessWeather(weatherUrl) {
    showLoader();
    displayMessage("Fetching weather data...", false);
    appContainer.style.opacity = '1';
    weatherContent.classList.add('hidden');
    if (clockInterval) clearInterval(clockInterval);

    try {
        const response = await fetch(weatherUrl);
        if (!response.ok) throw new Error((await response.json()).message || 'Weather data not found');
        
        currentWeatherData = await response.json(); // Store raw metric data
        
        // Cache weather data
        localStorage.setItem("cachedWeather", JSON.stringify(currentWeatherData));
        
        const forecastURL = `https://api.openweathermap.org/data/2.5/forecast?q=${currentWeatherData.name}&appid=${apiKey}&units=metric`;
        const forecastResponse = await fetch(forecastURL);
        const forecastData = await forecastResponse.json();

        messageDiv.textContent = "";
        weatherContent.classList.remove('hidden');
        
        hideLoader();
        updateUI(forecastData);

    } catch (error) {
        console.error("Error fetching weather data:", error);
        hideLoader();
        
        // Try to load cached weather
        const cached = localStorage.getItem("cachedWeather");
        if (cached) {
            currentWeatherData = JSON.parse(cached);
            messageDiv.textContent = "Offline Mode - Showing cached data";
            messageDiv.className = 'text-center text-yellow-400 mb-4 text-lg';
            weatherContent.classList.remove('hidden');
            updateDisplayedValues();
        } else {
            displayMessage(`Error: ${error.message}. Please try again.`, true);
        }
    }
}

// --- UI UPDATE FUNCTIONS ---
function updateUI(forecastData) {
    if (!currentWeatherData) return;
    
    // Set Day/Night Mode
    const timezoneOffset = currentWeatherData.timezone;
    const localHour = getLocalHour(timezoneOffset);
    const isDay = localHour >= 6 && localHour < 19;
    document.body.classList.toggle('day-mode', isDay);
    document.body.classList.toggle('night-mode', !isDay);
    themeSwitch.checked = !isDay;

    // Background Changes by Weather
    const weather = currentWeatherData.weather[0].main;

    document.body.classList.remove("bg-clear","bg-rain","bg-cloud");

    if (weather === "Rain") document.body.classList.add("bg-rain");
    if (weather === "Clear") document.body.classList.add("bg-clear");
    if (weather === "Clouds") document.body.classList.add("bg-cloud");

    // Update clock
    updateClock(timezoneOffset);
    clockInterval = setInterval(() => updateClock(timezoneOffset), 1000);

    // Update favorite button
    updateFavoriteButtonState(currentWeatherData.name);

    // Update main weather display with current units
    updateDisplayedValues();

    // Display forecast
    displayForecast(forecastData);
}

function updateDisplayedValues() {
    if (!currentWeatherData) return;

    const isMetric = currentUnits === 'metric';
    const tempUnit = isMetric ? '°C' : '°F';
    const windUnit = isMetric ? ' m/s' : ' mph';

    // Convert values if imperial
    const temp = isMetric ? currentWeatherData.main.temp : (currentWeatherData.main.temp * 9/5) + 32;
    const feelsLike = isMetric ? currentWeatherData.main.feels_like : (currentWeatherData.main.feels_like * 9/5) + 32;
    const windSpeed = isMetric ? currentWeatherData.wind.speed : currentWeatherData.wind.speed * 2.237;

    // Update DOM
    cityNameEl.textContent = currentWeatherData.name;
    currentTempEl.textContent = `${Math.round(temp)}°`;
    feelsLikeEl.textContent = `${Math.round(feelsLike)}°`;
    windSpeedEl.textContent = `${windSpeed.toFixed(1)}${windUnit}`;
    
    currentDescriptionEl.textContent = currentWeatherData.weather[0].description;
    currentIconEl.src = `https://openweathermap.org/img/wn/${currentWeatherData.weather[0].icon}@4x.png`;
    humidityEl.textContent = `${currentWeatherData.main.humidity}%`;

    const timezoneOffset = currentWeatherData.timezone;
    sunriseTimeEl.textContent = formatTime(currentWeatherData.sys.sunrise, timezoneOffset);
    sunsetTimeEl.textContent = formatTime(currentWeatherData.sys.sunset, timezoneOffset);

    // apply weather animation
    applyWeatherAnimation(currentWeatherData.weather[0].description);
}

function displayForecast(data) {
    if (!data || !data.list) return;
    
    forecastContainer.innerHTML = '';
    const dailyForecasts = data.list.filter(item => item.dt_txt.includes("12:00:00"));

    dailyForecasts.slice(0, 5).forEach((forecast, index) => {
        const isMetric = currentUnits === 'metric';
        const temp = isMetric ? forecast.main.temp : (forecast.main.temp * 9/5) + 32;
        const tempUnit = isMetric ? '°C' : '°F';

        const date = new Date(forecast.dt * 1000);
        const day = date.toLocaleDateString('en-US', { weekday: 'short' });
        const card = document.createElement('div');
        card.className = 'pop-in glass-card p-2 sm:p-4 rounded-xl text-center flex flex-col items-center justify-between';
        card.style.animationDelay = `${index * 0.1}s`;
        card.innerHTML = `<p class="font-bold text-base sm:text-lg text-dynamic-primary">${day}</p><img src="https://openweathermap.org/img/wn/${forecast.weather[0].icon}@2x.png" alt="${forecast.weather[0].description}" class="w-12 h-12 sm:w-16 sm:h-16"><p class="font-semibold text-lg sm:text-xl text-dynamic-primary">${Math.round(temp)}${tempUnit}</p>`;
        forecastContainer.appendChild(card);
    });
}

function toggleUnits() {
    currentUnits = unitSwitch.checked ? 'imperial' : 'metric';

    unitF.classList.toggle('opacity-50', !unitSwitch.checked);
    unitC.classList.toggle('opacity-50', unitSwitch.checked);

    if (currentWeatherData) {
        updateDisplayedValues(); // ✅ just re-render
    }
}

// --- WEATHER ANIMATIONS ---
function applyWeatherAnimation(desc) {
    document.body.classList.remove("rain");

    if (desc.toLowerCase().includes("rain"))
        document.body.classList.add("rain");
}

// --- helper function ---
function showLoader() {
    document.getElementById("loader").classList.remove("hidden");
}

function hideLoader() {
    document.getElementById("loader").classList.add("hidden");
}

function getLocalHour(offset) { return new Date((new Date().getTime() + (new Date().getTimezoneOffset() * 60000)) + (offset * 1000)).getHours(); }
function updateClock(offset) { localTimeEl.textContent = formatTime(Date.now() / 1000, offset, true); }
function formatTime(unixTimestamp, offset, isClock = false) {
    const date = isClock ? new Date((unixTimestamp * 1000 + (new Date().getTimezoneOffset() * 60000)) + (offset * 1000)) : new Date((unixTimestamp * 1000) + (offset * 1000));
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' });
}

// --- FAVORITES LOGIC ---
function toggleFavorite() {
    const city = cityNameEl.textContent;
    if (!city || city === '--') return;
    const index = favorites.indexOf(city);
    if (index > -1) { favorites.splice(index, 1); } 
    else { favorites.push(city); }
    saveFavorites(); renderFavorites(); updateFavoriteButtonState(city);
}
function updateFavoriteButtonState(city) { favoriteBtn.classList.toggle('active', favorites.includes(city)); }
function renderFavorites() {
    favoritesList.innerHTML = '';
    favoritesContainer.classList.toggle('hidden', favorites.length === 0);
    favorites.forEach(city => {
        const favBtn = document.createElement('button');
        favBtn.className = 'favorite-city text-dynamic-primary font-semibold py-1 px-3 sm:py-2 sm:px-4 text-sm sm:text-base rounded-full transition-colors';
        favBtn.textContent = city;
        favBtn.addEventListener('click', () => getWeatherByCity(city));
        favoritesList.appendChild(favBtn);
    });
}
function saveFavorites() { localStorage.setItem('weatherlyFavorites', JSON.stringify(favorites)); }
function loadFavorites() {
    const stored = localStorage.getItem('weatherlyFavorites');
    if (stored) favorites = JSON.parse(stored);
    renderFavorites();
}

// --- INITIAL LOAD ---
window.onload = () => {
    loadFavorites();
    const initialCity = favorites.length > 0 ? favorites[0] : "London";
    getWeatherByCity(initialCity);
    cityInput.focus();
};
