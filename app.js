/**
 * ============================================================================
 * StreamFinder - app.js
 * ============================================================================
 * Lógica principal: geolocalización del país, búsqueda de películas en TMDB
 * y detección de disponibilidad en plataformas de streaming por región.
 *
 * API Keys y credenciales de desarrollo:
 * ----------------------------------------------------------------------------
 * Las claves NO van en este archivo. Se cargan desde `config.js`
 * (archivo local ignorado por Git — ver .gitignore).
 *   - Copia `config.example.js` a `config.js` y pega tu API Key de TMDB.
 *   - Regístrate gratis en: https://www.themoviedb.org/settings/api
 *   - Para producción usa variables de entorno o un backend/proxy propio.
 * ----------------------------------------------------------------------------
 */

'use strict';

/* ==========================================================================
   0. CARGA DE CONFIGURACIÓN SEGURA (ignorada por Git)
   ========================================================================== */

// Import dinámico de config.js: si no existe (p.ej. en un clon reciente),
// usamos valores por defecto y avisamos por consola.
let localConfig = {};
try {
    localConfig = (await import('./config.js')).default;
} catch {
    console.warn(
        '%c⚠️ No se encontró config.js\n' +
        '%cCopía config.example.js como config.js y agrega tu API Key de TMDB.',
        'color:#f59e0b; font-size:14px; font-weight:bold',
        'color:#94a3b8; font-size:12px',
    );
}

/* ==========================================================================
   1. CONFIGURACIÓN
   ========================================================================== */

const CONFIG = {
    // ════════════════════════════════════════════════════════════════════
    // API Key de TMDB: se inyecta desde config.js (ignorado por Git).
    // Si falta, las peticiones fallarán con 401 y la app mostrará el error.
    // ════════════════════════════════════════════════════════════════════
    TMDB_API_KEY: localConfig.TMDB_API_KEY || '',

    // Versión de la API de TMDB
    TMDB_API_VERSION: '3',

    // URL base de la API de TMDB
    TMDB_BASE_URL: 'https://api.themoviedb.org/3',

    // URL base para las imágenes de TMDB (posters, logos, etc.)
    TMDB_IMAGE_BASE_URL: 'https://image.tmdb.org/t/p/',

    // Idioma por defecto de los resultados (es = español)
    TMDB_LANG: 'es-ES',

    // Capacidad máxima de búsqueda
    MAX_PAGES: 5, // Limita la paginación para no abusar de la API en el plan free

    // Idioma para los nombres de los proveedores
    PROVIDER_LANG: 'es',

    // Configuración de RapidAPI/JustWatch (ALTERNATIVA OPCIONAL)
    // Coloca aquí tu key de RapidAPI si decides usar JustWatch en lugar de TMDB.
    rapidApi: {
        enabled: false, // Cambia a true si prefieres usar JustWatch vía RapidAPI
        baseUrl: 'https://justwatch.p.rapidapi.com',
        headers: {
            'x-rapidapi-key': 'AQUI_VA_TU_RAPIDAPI_KEY', // ← Tu X-RapidAPI-Key de RapidAPI
            'x-rapidapi-host': 'justwatch.p.rapidapi.com',
        },
    },
};

/* ==========================================================================
   2. ESTADO DE LA APLICACIÓN
   ========================================================================== */

const state = {
    country: 'US',                 // Código ISO 3166-1 alfa-2 del país detectado
    countryName: 'United States',  // Nombre legible del país
    loading: false,                // Indicador de que hay una petición en curso
    searchTerm: '',                // Último término de búsqueda
    page: 1,                       // Página actual de resultados
    totalResults: 0,               // Total de resultados del query
    totalPages: 0,                 // Total de páginas disponibles
    results: [],                   // Resultados de la búsqueda actual
    userCancelledGeo: false,       // Si el usuario rechazó el permiso de geolocalización
};

/* ==========================================================================
   3. REFERENCIAS AL DOM
   ========================================================================== */

const dom = {
    form: document.getElementById('search-form'),
    searchInput: document.getElementById('movie-search'),
    searchBtn: document.getElementById('search-btn'),
    clearBtn: document.getElementById('clear-search'),
    countryIndicator: document.getElementById('country-indicator'),
    countryCode: document.getElementById('country-code'),
    countryName: document.getElementById('country-name'),
    statusMessage: document.getElementById('status-message'),
    statusIcon: document.getElementById('status-icon'),
    statusText: document.getElementById('status-text'),
    statusSubtext: document.getElementById('status-subtext'),
    resultsSection: document.getElementById('results-section'),
    resultsContainer: document.getElementById('results-container'),
    pagination: document.getElementById('pagination'),
    prevPage: document.getElementById('prev-page'),
    nextPage: document.getElementById('next-page'),
    pageInfo: document.getElementById('page-info'),
    globalLoader: document.getElementById('global-loader'),
    loaderText: document.getElementById('loader-text'),
};

/* ==========================================================================
   4. ICONOS SVG (injectados dinámicamente)
   ========================================================================== */

const ICONS = {
    search: `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>`,
    notFound: `
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L3 3"/>
        </svg>`,
    unavailable: `
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L3 3"/>
        </svg>`,
    check: `
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>`,
    info: `
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>`,
    error: `
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.732L13.732 4.732c-.77-1.063-2.236-1.063-3.006 0L4.506 15.268c-.77 1.064.193 2.732 1.732 2.732z"/>
        </svg>`,
    clock: `
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>`,
};

/* ==========================================================================
   5. UTILIDADES
   ========================================================================== */

/**
 * Utilidad para crearagregar retardos (útil para pruebas y skeleton loaders)
 * @param {number} ms - Milisegundos a esperar
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generador de URLs de imágenes de TMDB
 * @param {string} path - Ruta relativa de la imagen (ej. "/abc123.jpg")
 * @param {string} size - Tamaño deseado (w92, w154, w185, w342, w500, w780, original)
 * @returns {string|null} URL completa o null si no hay path
 */
const buildImageUrl = (path, size = 'w342') => {
    if (!path) return null;
    return `${CONFIG.TMDB_IMAGE_BASE_URL}${size}${path}`;
};

/**
 * Mapea el código de país ISO a un nombre legible
 * @param {string} code - Código ISO 3166-1 alfa-2 (ej. "AR", "MX")
 * @returns {string} Nombre del país en español
 */
const getCountryName = (code) => {
    const countries = {
        AR: 'Argentina', AU: 'Australia', AT: 'Austria', BE: 'Bélgica',
        BO: 'Bolivia', BR: 'Brasil', CA: 'Canadá', CL: 'Chile',
        CN: 'China', CO: 'Colombia', CR: 'Costa Rica', CU: 'Cuba',
        CZ: 'República Checa', DK: 'Dinamarca', DO: 'Rep. Dominicana',
        EC: 'Ecuador', SV: 'El Salvador', FI: 'Finlandia', FR: 'Francia',
        DE: 'Alemania', GT: 'Guatemala', HN: 'Honduras', HK: 'Hong Kong',
        IN: 'India', IE: 'Irlanda', IT: 'Italia', JP: 'Japón',
        KR: 'Corea del Sur', MX: 'México', NL: 'Países Bajos', NZ: 'Nueva Zelanda',
        NI: 'Nicaragua', NO: 'Noruega', PA: 'Panamá', PY: 'Paraguay',
        PE: 'Perú', PL: 'Polonia', PT: 'Portugal', PR: 'Puerto Rico',
        RO: 'Rumania', RU: 'Rusia', SA: 'Arabia Saudita', SG: 'Singapur',
        ZA: 'Sudáfrica', ES: 'España', SE: 'Suecia', CH: 'Suiza',
        TW: 'Taiwán', TR: 'Turquía', GB: 'Reino Unido', US: 'Estados Unidos',
        UY: 'Uruguay', VE: 'Venezuela',
    };
    return countries[code] || code;
};

/**
 * Escapa texto para prevenir inyección XSS al inyectar HTML
 * @param {string} text - Texto a escapar
 * @returns {string} Texto seguro para HTML
 */
const escapeHTML = (text) => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
};

/**
 * Muestra/oculta el loader global (full screen)
 * @param {boolean} show - true para mostrar, false para ocultar
 * @param {string} [message] - Mensaje opcional a mostrar
 */
const toggleGlobalLoader = (show, message = 'Cargando...') => {
    dom.globalLoader.classList.toggle('hidden', !show);
    if (show) dom.loaderText.textContent = message;
};

/**
 * Fetch de JSON con timeout. Evita que un proveedor que no responde
 * cuelgue la detección de ubicación indefinidamente.
 * @param {string} url - URL a consultar
 * @param {object} [options] - { timeout (ms) y/o signal de abort }
 * @returns {Promise<any>} Datos JSON de la respuesta
 */
const fetchJson = async (url, { timeout = 4000, signal } = {}) => {
    const signals = [];
    if (timeout > 0) signals.push(AbortSignal.timeout(timeout));
    if (signal) signals.push(signal);
    const finalSignal = signals.length > 1 ? AbortSignal.any(signals) : signals[0];

    const res = await fetch(url, { signal: finalSignal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
};

/* ==========================================================================
   6. GEOLOCALIZACIÓN
   ========================================================================== */

/**
 * Reverse geocoding: convierte coordenadas (lat/lon) en nombre de país (sólo útil con HTTPS).
 * @param {number} lat - Latitud
 * @param {number} lon - Longitud
 * @param {AbortSignal} [signal] - Señal de cancelación
 * @returns {Promise<{country: string, countryName: string}|null>}
 */
const reverseGeocode = async (lat, lon, signal = undefined) => {
    // Compañía: proveedores gratuitos con soporte CORS. Si el primero
    // falla, se intenta el siguiente. Si todos fallan, null.
    const providers = [
        {
            name: 'BigDataCloud',
            buildUrl: (lat, lon) =>
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=es`,
            parse: (data) => {
                if (!data.countryCode) throw new Error('Sin countryCode en respuesta');
                return { country: data.countryCode, countryName: data.countryName || data.country };
            },
        },
        {
            name: 'Geoapify',
            buildUrl: (lat, lon) =>
                `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=es`,
            parse: (data) => {
                if (!data.address) throw new Error('Sin address en respuesta');
                const code = data.address.country_code?.toUpperCase();
                if (!code) throw new Error('Sin country_code en respuesta');
                return { country: code, countryName: data.address?.country || getCountryName(code) };
            },
        },
        {
            name: 'Nominatim',
            buildUrl: (lat, lon) =>
                `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=es`,
            parse: (data) => {
                if (!data.address) throw new Error('Sin address en respuesta');
                const code = data.address.country_code?.toUpperCase();
                if (!code) throw new Error('Sin country_code en respuesta');
                return { country: code, countryName: data.address?.country || getCountryName(code) };
            },
        },
        {
            name: 'ipinfo.io (Último recurso)',
            buildUrl: (_lat, _lon) => 'https://ipinfo.io/json',
            parse: (data) => {
                if (!data.country) throw new Error('Sin country en respuesta');
                return { country: data.country, countryName: getCountryName(data.country) };
            },
        },
    ];

    // Correr cada proveedor en orden hasta que uno funcione.
    for (const provider of providers) {
        try {
            const url = provider.buildUrl(lat, lon);
            const data = await fetchJson(url, { signal });
            const parsed = provider.parse(data);
            if (parsed && parsed.country) return parsed;
        } catch (err) {
            if (err.name === 'AbortError') continue;
            console.warn(`[reverseGeocode][${provider.name}]`, err.message);
        }
    }

    // Si todos fallan, devolvemos null (la llamada tendrá que autocompletarla el IP).
    return null;
};

/**
 * Obtiene el país del usuario usando la geolocalización del navegador
 * y convirtiendo las coordenadas en país (reverse geocoding).
 * @returns {Promise<{country: string, countryName: string}|null>}
 */
const getCountryFromBrowser = async () => {
    try {
        if (!('geolocation' in navigator)) {
            throw new Error('Geolocalización no soportada');
        }

        // El permiso del usuario es requerido sin importar la estrategia elegida
        const permission = await navigator.permissions?.query?.({ name: 'geolocation' });
        if (permission?.state === 'denied') {
            state.userCancelledGeo = true;
            throw new Error('Permiso de geolocalización denegado');
        }

        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                resolve,
                (error) => {
                    // Si el usuario rechazó el permiso, marcamos el estado.
                    // Esto nos permite intentar la fallback por IP más adelante.
                    if (error.code === error.PERMISSION_DENIED) {
                        state.userCancelledGeo = true;
                    }
                    reject(error);
                },
                { timeout: 5000, maximumAge: 0 },
            );
        });

        // Convierte las coordenadas en país gracias al reverse geocoding.
        const { latitude, longitude } = position.coords;
        const country = await reverseGeocode(latitude, longitude);
        return country;
    } catch (err) {
        // Registramos el error pero no fallamos: siempre hay fallback por IP.
        console.warn('Geolocalización del navegador no disponible:', err.message);
        return null;
    }
};

/**
 * Obtiene la ubicación del usuario por IP usando el servicio gratuito ip-api.
 * @param {AbortSignal} signal - Señal para cancelar la petición si es necesario
 * @returns {Promise<{country: string, countryName: string}|null>}
 */
const getCountryFromIp = async (signal) => {
    // Probar varios servicios en orden de preferencia, con fallbacks.
    const providers = [
        {
            name: 'ip-api.com',
            // Requiere PRO para HTTPS, así que usamos la versión HTTP (works en dev local).
            url: 'http://ip-api.com/json/?fields=status,countryCode,country',
            // Las llamadas a ip-api desde el navegador tienen rate limits;
            // usamos JSONP para evitar problemas de CORS en producción.
            useJsonp: false,
            parse: (data) => {
                if (data.status !== 'success') throw new Error('ip-api fallback fallido');
                return {
                    country: data.countryCode,
                    countryName: data.country,
                };
            },
        },
        {
            name: 'ipapi.co',
            url: 'https://ipapi.co/json/',
            useJsonp: false,
            parse: (data) => {
                if (!data.country_code) throw new Error('ipapi.co fallback fallido');
                return {
                    country: data.country_code,
                    countryName: data.country_name,
                };
            },
        },
        {
            name: 'ipinfo.io',
            // ipinfo.io gratis tiene limitaciones de 50k requests/mes.
            url: 'https://ipinfo.io/json?token=',
            useJsonp: false,
            parse: (data) => {
                if (!data.country) throw new Error('ipinfo.io fallback fallido');
                return {
                    country: data.country,
                    countryName: getCountryName(data.country),
                };
            },
        },
    ];

    // Corremos cada proveedor en secuencia hasta que uno funcione.
    for (const provider of providers) {
        try {
            const data = await fetchJson(provider.url, { signal });
            const parsed = provider.parse(data);
            if (parsed && parsed.country) return parsed;
        } catch (err) {
            if (err.name === 'AbortError') continue;
            console.warn(`[${provider.name}]`, err.message);
        }
    }

    // Si todos fallan, devolvemos un valor por defecto razonable.
    return null;
};

/**
 * Orquesta la detección del país del usuario.
 * Estrategia: intenta la geolocalización del navegador primero y, si no
 * es posible, hace fallback por IP.
 * @returns {Promise<void>}
 */
const detectCountry = async () => {
    // Mostramos el indicador mientras se resuelve la ubicación
    dom.countryIndicator.classList.remove('hidden');
    dom.countryCode.textContent = '--';
    dom.countryName.textContent = 'Detectando ubicación...';

    try {
        // Estrategia 1: geolocalización del navegador (requiere HTTPS y permiso)
        const browser = await getCountryFromBrowser();

        // Estrategia 2 (fallback): por IP con ip-api / ipapi.co
        const ip = browser?.country ? null : await getCountryFromIp();

        // Dejamos 'US' como último recurso si ambos métodos fracasan
        const location = browser?.country ? browser : (ip?.country ? ip : null);

        if (location) {
            state.country = location.country;
            state.countryName = location.countryName || getCountryName(location.country);
        } else {
            state.country = 'US';
            state.countryName = 'Estados Unidos';
        }

        // Actualizar UI
        dom.countryCode.textContent = state.country;
        dom.countryName.textContent = state.countryName;
    } catch (err) {
        // Ante cualquier error, persistimos el país por defecto.
        console.error('Error detectando país:', err);
        state.country = 'US';
        state.countryName = 'Estados Unidos';
        dom.countryCode.textContent = state.country;
        dom.countryName.textContent = state.countryName;
    }
};

/* ==========================================================================
   7. API DE TMDB
   ========================================================================== */

/**
 * Wrapper centralizado para fetch con manejo de errores uniforme.
 * @param {string} url - URL de la petición
 * @param {object} [options] - Opciones de fetch
 * @returns {Promise<any>} Datos de la respuesta
 */
const apiFetch = async (url, options = {}) => {
    const res = await fetch(url, options);

    if (!res.ok) {
        // Errores comunes de TMDB con mensajes legibles
        const errors = {
            401: 'API Key de TMDB inválida o faltante. Revisa config.js (copía config.example.js y pega tu key).',
            403: 'Acceso denegado por TMDB. Verifica tus credenciales y cuota.',
            404: 'Recurso no encontrado en TMDB.',
            429: 'Límite de requests excedido (plan free de TMDB). Espera unos segundos.',
            500: 'Error interno del servidor de TMDB.',
            503: 'Servicio de TMDB temporalmente no disponible.',
        };
        throw new Error(errors[res.status] || `TMDB respondió con error ${res.status}`);
    }

    return res.json();
};

/**
 * Busca películas en TMDB por título.
 * @param {string} query - Título a buscar
 * @param {number} [page=1] - Página de resultados
 * @param {AbortSignal} [signal] - Para cancelar peticiones previas
 * @returns {Promise<object>} Respuesta completa de TMDB
 */
const searchMovies = async (query, page = 1, signal) => {
    const url = new URL(`${CONFIG.TMDB_BASE_URL}/search/movie`);
    url.searchParams.set('api_key', CONFIG.TMDB_API_KEY);
    url.searchParams.set('language', CONFIG.TMDB_LANG);
    url.searchParams.set('query', query);
    url.searchParams.set('page', page);
    url.searchParams.set('include_adult', 'false');

    return apiFetch(url.toString(), { signal });
};

/**
 * Obtiene los proveedores de streaming (watch/providers) para una película.
 * Este endpoint es quien decide en qué plataformas está disponible un título
 * en cada país, según lo que reporta TMDB (fuente: JustWatch).
 * @param {number} movieId - ID de TMDB de la película
 * @param {string} country - Código ISO del país (ej. "AR", "MX", "ES")
 * @param {AbortSignal} [signal] - Señal de cancelación
 * @returns {Promise<object|null>} Datos de proveedores del país
 */
const getMovieProviders = async (movieId, country, signal) => {
    const url = new URL(`${CONFIG.TMDB_BASE_URL}/movie/${movieId}/watch/providers`);
    url.searchParams.set('api_key', CONFIG.TMDB_API_KEY);

    const data = await apiFetch(url.toString(), { signal });

    // Estructura: data.results = { US: {...}, AR: {...}, ... }
    const countryData = data.results?.[country];
    if (!countryData) return null;

    return {
        // Tipos de disponibilidad: rentar, comprar, suscripción (streaming), ads
        rent: countryData.rent || [],
        buy: countryData.buy || [],
        flatrate: countryData.flatrate || [],  // ← Esto es "en streaming por suscripción"
        ads: countryData.ads || [],
        link: countryData.link || null,         // URL canónica a JustWatch
        country,
    };
};

/**
 * Obtiene los detalles completos de una película (para sinopsis estendida, etc.)
 * @param {number} movieId - ID de TMDB
 * @param {AbortSignal} [signal] - Señal de cancelación
 * @returns {Promise<object>} Detalles de la película
 */
const getMovieDetails = async (movieId, signal) => {
    const url = new URL(`${CONFIG.TMDB_BASE_URL}/movie/${movieId}`);
    url.searchParams.set('api_key', CONFIG.TMDB_API_KEY);
    url.searchParams.set('language', CONFIG.TMDB_LANG);
    url.searchParams.set('append_to_response', 'videos,credits');

    return apiFetch(url.toString(), { signal });
};

/* ==========================================================================
   8. LOGICA DE BÚSQUEDA PRINCIPAL (con proveedores por país)
   ========================================================================== */

/**
 * Aborta la búsqueda actual si existe.
 * Guardamos el controller en el state para cancelar peticiones en vuelo
 * cuando se hace una nueva búsqueda (evita condiciones de carrera).
 */
let searchController = null;
let providerController = null;

/**
 * Ejecuta la búsqueda completa: movies + proveedores de streaming por país.
 */
const performSearch = async () => {
    const query = dom.searchInput.value.trim();

    // Validación client-side
    if (query.length < 2) {
        showStatus('error', 'Búsqueda demasiado corta', 'Escribe al menos 2 caracteres.');
        return;
    }

    // Cancelar búsquedas previas en vuelo
    if (searchController) searchController.abort();
    searchController = new AbortController();

    state.searchTerm = query;
    state.page = 1;

    // UI: estado de carga
    toggleGlobalLoader(true, 'Buscando películas...');
    showStatus('loading', 'Cargando...', 'Buscando resultados en TMDB');
    dom.resultsSection.classList.add('hidden');

    try {
        // 1) Buscar películas en TMDB
        const searchData = await searchMovies(query, state.page, searchController.signal);

        if (!searchData || searchData.total_results === 0) {
            // No encontramos nada
            showStatus('notFound', 'Película no encontrada', `"${escapeHTML(query)}" no coincide con ningún título. Revisa la ortografía o prueba con otro nombre.`);
            dom.resultsSection.classList.add('hidden');
            return;
        }

        state.totalResults = searchData.total_results;
        state.totalPages = Math.min(searchData.total_pages, CONFIG.MAX_PAGES);

        // 2) Obtener proveedores de streaming para C/U de las películas
        //    (solo mostramos los primeros 6 para no abusar de la API)
        const providerResults = await fetchProvidersForResults(searchData.results.slice(0, 6), state.country);

        // 4) Renderizar resultados
        renderResults(providerResults);
        updatePagination();

        // UI: mostrar la sección de resultados
        dom.statusMessage.classList.add('hidden');
        dom.resultsSection.classList.remove('hidden');
        dom.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
        if (err.name === 'AbortError') {
            // La petición fue cancelada por una nueva búsqueda; no mostrar error
            return;
        }
        console.error('Error en búsqueda:', err);
        showStatus('error', 'Ocurrió un error', err.message || 'No pudimos completar la búsqueda. Intenta nuevamente.');
    } finally {
        toggleGlobalLoader(false);
    }
};

/**
 * Obtiene los proveedores de streaming para una lista de películas,
 * en paralelo y con tolerancia a fallos individuales.
 * @param {Array} movies - Lista de películas de TMDB
 * @param {string} country - Código de país
 * @returns {Promise<Array>} Películas enriquecidas con 'providers'
 */
const fetchProvidersForResults = async (movies, country) => {
    // Abortar la anterior petición de proveedores
    if (providerController) providerController.abort();
    providerController = new AbortController();
    const signal = providerController.signal;

    // Fetch en paralelo con Promise.allSettled: si una falla, no tumba el resto
    const settled = await Promise.allSettled(
        movies.map(async (movie) => {
            const providers = await getMovieProviders(movie.id, country, signal);
            return { ...movie, providers };
        }),
    );

    // Devolvemos solo las que tuvieron éxito
    return settled
        .map((result) => (result.status === 'fulfilled' ? result.value : null))
        .filter(Boolean);
};

/* ==========================================================================
   9. RENDERIZADO DEL DOM
   ========================================================================== */

/**
 * Renderiza las tarjetas de película en la sección de resultados.
 * @param {Array} movies - Películas con proveedores adjuntos
 */
const renderResults = (movies) => {
    // Limpiar el contenedor cada vez que se renderiza
    dom.resultsContainer.innerHTML = '';

    if (!movies || movies.length === 0) {
        showStatus('unavailable', 'No disponible en streaming', 'Encontramos la película, pero no está disponible en streaming en tu país.');
        dom.resultsSection.classList.add('hidden');
        return;
    }

    // Reutilizamos el fragmento para un renderizado mejor de rendimiento
    const fragment = document.createDocumentFragment();

    movies.forEach((movie, index) => {
        fragment.appendChild(createMovieCard(movie, index));
    });

    dom.resultsContainer.appendChild(fragment);
};

/**
 * Crea la tarjeta HTML de una película.
 * @param {object} movie - Datos de película + providers
 * @param {number} index - Índice para animaciones escalonadas
 * @returns {HTMLElement} Tarjeta lista para insertar
 */
const createMovieCard = (movie, index) => {
    const card = document.createElement('article');
    card.className = 'movie-card animate-fade-in-up stagger-' + ((index % 6) + 1);
    card.style.animationDelay = `${index * 0.08}s`; // Override the class delay

    const posterUrl = buildImageUrl(movie.poster_path, 'w342');
    const title = escapeHTML(movie.title || movie.original_title || 'Sin título');
    const year = movie.release_date ? String(movie.release_date).slice(0, 4) : '¿?';
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : null;
    const overview = escapeHTML(movie.overview || 'Sin descripción disponible.');
    const providers = movie.providers || null;

    // Contenido de la tarjeta
    card.innerHTML = `
        <div class="flex flex-col sm:flex-row">
            <!-- Poster -->
            <div class="movie-card__poster-wrapper sm:w-40 sm:h-52 sm:flex-shrink-0 shrink-0">
                ${posterUrl
                    ? `<img class="movie-card__poster" src="${posterUrl}" alt="Póster de ${title}" loading="lazy">`
                    : `<div class="movie-card__poster-placeholder">
                            <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V4.5a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v15a1.5 1.5 0 001.5 1.5z"/>
                            </svg>
                       </div>`
                }
            </div>
            <!-- Detalles -->
            <div class="movie-card__content flex-1">
                <div class="movie-card__header">
                    <div class="movie-card__title-group">
                        <h3 class="movie-card__title" title="${title}">${title}</h3>
                        <span class="movie-card__year">${year}</span>
                    </div>
                    ${
                        rating
                            ? `<div class="movie-card__rating" title="Calificación de usuarios">
                                    <svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                                    ${rating}
                               </div>`
                            : ''
                    }
                </div>
                <p class="movie-card__overview">${overview}</p>
                <div class="movie-card__providers"></div>
            </div>
        </div>
    `;

    // Renderizar proveedores
    const providersContainer = card.querySelector('.movie-card__providers');
    renderProviders(providersContainer, providers);

    return card;
};

/**
 * Renderiza los badges de plataformas de streaming dentro de la tarjeta.
 * @param {HTMLElement} container - Contenedor donde se inyectan los badges
 * @param {object|null} providers - Objeto de proveedores del país
 */
const renderProviders = (container, providers) => {
    if (!providers) {
        container.innerHTML = `
            <span class="provider-badge">
                Disponibilidad no disponible en TMDB para el país seleccionado
            </span>
        `;
        return;
    }

    // flatrate = streaming por suscripción (el caso que más interesa al usuario)
    const streaming = providers.flatrate || [];

    // Si solo hay renta/compra, lo indicamos igualmente
    const rentalBuy = [...(providers.rent || []), ...(providers.buy || [])];
    const uniqueRentalBuy = rentalBuy.filter(
        (p, i, arr) => arr.findIndex((x) => x.provider_id === p.provider_id) === i,
    );

    if (streaming.length === 0 && uniqueRentalBuy.length === 0) {
        container.innerHTML = `
            <span class="provider-badge provider-badge--unavailable">
                No disponible en streaming en tu país
            </span>
        `;
        return;
    }

    const badges = [];

    // Badges de streaming (suscripción)
    if (streaming.length > 0) {
        streaming.slice(0, 12).forEach((provider, i) => {
            badges.push(createProviderBadge(provider, true, i));
        });
    }

    // Badges de renta/compra (los agregamos después de los de streaming)
    if (streaming.length === 0 && uniqueRentalBuy.length > 0) {
        uniqueRentalBuy.slice(0, 6).forEach((provider, i) => {
            badges.push(createProviderBadge(provider, false, i + streaming.length));
        });
    }

    container.innerHTML = badges.join('');

    // Si hay link de JustWatch, añadimos un botón "Ver opciones"
    if (providers.link) {
        container.innerHTML += `
            <a href="${providers.link}" target="_blank" rel="noopener noreferrer"
               class="provider-badge provider-badge--link" title="Ver este título en JustWatch">
                Ver opciones
            </a>
        `;
    }
};

/**
 * Crea un badge HTML para un proveedor de streaming.
 * @param {object} provider - Datos del proveedor (logo, nombre)
 * @param {boolean} isStreaming - true si es de suscripción, false si es renta/compra
 * @param {number} i - Índice para animación
 * @returns {string} HTML del badge
 */
const createProviderBadge = (provider, isStreaming, i) => {
    const logoUrl = buildImageUrl(provider.logo_path, 'w92');
    const name = escapeHTML(provider.provider_name || provider.display_priority);

    return `
        <span class="provider-badge provider-badge--available animate-slide-in stagger-${(i % 6) + 1}"
              title="${name} - ${isStreaming ? 'Streaming (suscripción)' : 'Renta o compra'}">
            ${
                logoUrl
                    ? `<img class="provider-badge__logo" src="${logoUrl}" alt="${name}" loading="lazy" onerror="this.style.display='none'">`
                    : ''
            }
            <span class="provider-badge__name">${name}</span>
        </span>
    `;
};

/* ==========================================================================
   10. MENSAJES DE ESTADO
   ========================================================================== */

/**
 * Muestra un mensaje de estado (carga, error, no encontrado, etc.)
 * @param {string} type - 'loading' | 'error' | 'notFound' | 'unavailable' | 'info'
 * @param {string} title - Título del mensaje
 * @param {string} subtitle - Texto secundario
 */
const showStatus = (type, title, subtitle) => {
    dom.statusMessage.classList.remove('hidden');
    dom.statusIcon.className = 'w-12 h-12 rounded-full flex items-center justify-center';

    switch (type) {
        case 'loading':
            dom.statusIcon.innerHTML = `<div class="w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>`;
            break;
        case 'notFound':
        case 'unavailable':
            dom.statusIcon.classList.add('bg-amber-500/10', 'text-amber-500');
            dom.statusIcon.innerHTML = ICONS[type === 'unavailable' ? 'unavailable' : 'notFound'];
            break;
        case 'error':
            dom.statusIcon.classList.add('bg-red-500/10', 'text-red-500');
            dom.statusIcon.innerHTML = ICONS.error;
            break;
        case 'info':
            dom.statusIcon.classList.add('bg-primary-500/10', 'text-primary-400');
            dom.statusIcon.innerHTML = ICONS.info;
            break;
        default:
            break;
    }

    dom.statusText.textContent = title;
    dom.statusSubtext.textContent = subtitle || '';
};

/* ==========================================================================
   11. PAGINACIÓN
   ========================================================================== */

/**
 * Actualiza la interfaz de paginación según el estado actual.
 */
const updatePagination = () => {
    const { page, totalPages, totalResults } = state;

    if (totalPages <= 1) {
        dom.pagination.classList.add('hidden');
        return;
    }

    dom.pagination.classList.remove('hidden');
    dom.pageInfo.textContent = `Página ${page} de ${totalPages} (${totalResults} resultados)`;
    dom.prevPage.disabled = page <= 1;
    dom.nextPage.disabled = page >= totalPages;
};

/**
 * Ejecuta la paginación de la búsqueda actual.
 * @param {number} direction - 1 para siguiente, -1 para anterior
 */
const changePage = async (direction) => {
    const newPage = state.page + direction;

    if (newPage < 1 || newPage > state.totalPages) return;
    state.page = newPage;

    toggleGlobalLoader(true, 'Cargando página...');

    try {
        const data = await searchMovies(state.searchTerm, state.page, searchController?.signal);
        if (data.total_results === 0) {
            showStatus('notFound', 'Película no encontrada', 'No hay más resultados.');
            return;
        }

        // Re-obtener proveedores para los nuevos resultados
        const providerResults = await fetchProvidersForResults(data.results.slice(0, 6), state.country);

        renderResults(providerResults);
        updatePagination();

        dom.statusMessage.classList.add('hidden');
        dom.resultsSection.classList.remove('hidden');
        dom.resultsSection.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Error en paginación:', err);
            showStatus('error', 'Error al cargar', err.message);
        }
    } finally {
        toggleGlobalLoader(false);
    }
};

/* ==========================================================================
   12. EVENT LISTENERS (UI)
   ========================================================================== */

/**
 * Configura todos los listeners de la interfaz.
 */
const setupEventListeners = () => {
    // Envío del formulario de búsqueda
    dom.form.addEventListener('submit', (e) => {
        e.preventDefault();
        performSearch();
    });

    // Mostrar/ocultar el botón de limpiar según el contenido del input
    dom.searchInput.addEventListener('input', () => {
        dom.clearBtn.classList.toggle('hidden', dom.searchInput.value.length === 0);
    });

    // Limpiar el buscador
    dom.clearBtn.addEventListener('click', () => {
        dom.searchInput.value = '';
        dom.searchInput.focus();
        dom.clearBtn.classList.add('hidden');
        dom.resultsContainer.innerHTML = '';
        dom.resultsSection.classList.add('hidden');
        dom.statusMessage.classList.add('hidden');
        dom.pagination.classList.add('hidden');
    });

    // Botones de paginación
    dom.prevPage.addEventListener('click', () => changePage(-1));
    dom.nextPage.addEventListener('click', () => changePage(1));

    // Soportar Enter con "shift" en el input de búsqueda (accesibilidad)
    dom.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            dom.clearBtn.click(); // Esc limpia la búsqueda
        }
    });
};

/* ==========================================================================
   13. INICIALIZACIÓN
   ========================================================================== */

/**
 * Punto de entrada de la aplicación.
 */
const init = async () => {
    // 1) Configurar listeners (siempre)
    setupEventListeners();

    // 2) Intentar detectar el país lo antes posible (fire-and-forget para que
    //    no bloquee la interfaz mientras el usuario escribe su búsqueda)
    detectCountry().catch(console.warn);

    // 3) Si no hay una API Key de TMDB configurada, lo avisamos por consola
    if (!CONFIG.TMDB_API_KEY) {
        // No bloqueamos nada. Solo informamos por consola que falta la key real.
        console.warn(
            '%c⚠️ FALTA TU API KEY DE TMDB\n' +
            '%cCopia config.example.js a config.js y pega tu key propia.\n' +
            'Regístrate gratis en https://www.themoviedb.org/settings/api',
            'color:#f59e0b; font-size:14px; font-weight:bold',
            'color:#94a3b8; font-size:12px',
        );
    }

    // 4) Pre-focus en la barra de búsqueda para que el usuario pueda
    //    comenzar a escribir directamente al llegar a la app.
    dom.searchInput.focus();
};

// Arranque. El DOM ya está listo porque el script usa 'type="module"'.
init();