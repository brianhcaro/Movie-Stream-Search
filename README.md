# StreamFinder 🎬

Aplicación web moderna, limpia y **responsive** que permite buscar una película por su título, detectar automáticamente tu país y mostrarte en qué plataformas de streaming (Netflix, Prime Video, Disney+, HBO Max, etc.) está disponible ese título en tu región.

## ✨ Características

- **Búsqueda de películas** por título vía la API de TMDB.
- **Detección automática del país** usando la geolocalización del navegador (con reverse geocoding de coordenadas) y fallback por IP.
- **Disponibilidad de streaming por región** usando el endpoint `watch/providers` de TMDB.
- Muestra póster, año de estreno, sinopsis, calificación y los logos de las plataformas donde está disponible el título.
- Estados claros de *Cargando…*, *Película no encontrada* y *No disponible en streaming en tu país*.
- Diseño minimalista con **modo oscuro por defecto** (Tailwind CSS + estilos personalizados).
- Paginación de resultados y animaciones suaves.

## 🛠️ Stack

- HTML5 + CSS3 (Tailwind CSS vía CDN + `style.css` personalizado)
- JavaScript vanilla (ES6+), `async/await`, `fetch`, `AbortController`.
- APIs: [The Movie Database (TMDB)](https://www.themoviedb.org/) · reverse geocoding (BigDataCloud/Nominatim) · geolocalización por IP (ip-api/ipapi.co/ipinfo.io).

## 🚀 Puesta en marcha

### 1. Obtén tu API Key de TMDB

1. Regístrate en [themoviedb.org](https://www.themoviedb.org/signup).
2. Entra en [Configuración → API](https://www.themoviedb.org/settings/api).
3. Genera una **API Key (v3 auth)**.

### 2. Configura el acceso local

1. Copia la plantilla:
   ```bash
   copy config.example.js config.js
   ```
2. Abre `config.js` y pega tu key:
   ```js
   export default {
       TMDB_API_KEY: 'TU_API_KEY_DE_TMDB',
   };
   ```

> ⚠️ **Seguridad**: `config.js` está en el `.gitignore`, así que tu API key **nunca se sube a Git**. Nunca la pegues en `app.js` ni la subas a repositorios públicos.

### 3. Ejecuta la app

Como es una app estática, basta con un servidor local:

```bash
# Python
python -m http.server 8080
```

O usa el servidor estático de tu preferencia (VS Code Live Server, `npx serve`, etc.) y abre **http://localhost:8080**.

## 📂 Estructura del proyecto

```
├── index.html          # SPA: búsqueda, indicador de país, sección de resultados
├── style.css           # Estilos personalizados: tarjetas, badges, animaciones, dark mode
├── app.js              # Lógica: geolocalización, TMDB, proveedores de streaming, UI
├── config.js           # Credenciales locales (ignorado por Git) — lo creas tú
└── config.example.js   # Plantilla con valores vacíos (seguro para subir)
```

## 🧠 Cómo funciona

1. **Detección de país**: se intenta la geolocalización del navegador (coordenadas → reverse geocoding). Si falla o no hay permiso, se cae a geolocalización por IP. Último recurso: `US`.
2. **Búsqueda**: `GET /search/movie` con el título como *query* (TMDB, idioma `es-ES`).
3. **Disponibilidad**: por cada resultado, `GET /movie/{id}/watch/providers` se consulta con el código del país (ISO 3166-1 alfa-2) del usuario y se muestran los proveedores de tipo *flatrate* (suscripción) y, si no los hay, renta/compra.
4. Las peticiones usan `AbortController` para cancelar búsquedas en vuelo y timeouts para que ningún proveedor externo cuelgue la app.

## 🤝 Credenciales alternativas (opcional)

La integración de JustWatch vía RapidAPI está prevista en `CONFIG.rapidApi` (dentro de `app.js`). Para usarla: coloca tu `X-RapidAPI-Key` y cambia `enabled: true`. TMDB es la opción recomendada porque su endpoint `watch/providers` ya cubre la disponibilidad por país.

## 📄 Licencia

Uso educativo/de demostración. Los datos provienen de TMDB — consulta sus [términos de uso](https://www.themoviedb.org/documentation/api/terms-of-use).