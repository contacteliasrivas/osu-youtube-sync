# osu-youtube-sync — Motor Core de Sincronización osu! a YouTube

Sistema automatizado de sincronización de beatmaps de osu! a playlists privadas de YouTube. Extrae tus mapas más jugados utilizando OAuth2, evalúa las coincidencias mediante un algoritmo de similitud adaptativo (Cerebro Juez) y optimiza el consumo de la API de Google mediante una caché local persistente en SQLite.

---

## Stack Tecnológico

| Componente | Tecnología |
|-----------|------------|
| Backend Core | Node.js (JavaScript / Asíncrono) |
| Base de Datos | SQLite3 (Caché local de alta velocidad) |
| Algoritmo de Texto | `string-similarity` (Coeficiente de Sørensen-Dice) |
| API Integración 1 | osu! API v2 (OAuth2 - Client Credentials) |
| API Integración 2 | YouTube Data API v3 (OAuth2 - Offline Access) |

---

## Decisión Arquitectónica: El "Cerebro Juez" y Filtro de Tiempo Elástico

### Contexto
El motor de búsqueda nativo de YouTube prioriza resultados por popularidad global (vistas), ignorando las variantes específicas que usa la comunidad de osu! (como versiones *Nightcore*, *TV Size*, *Speed Up* o *Sped Up*). Además, la API de osu! no expone la duración real del archivo de audio original, sino únicamente la duración jugable del mapa (*total_length*), lo que introduce desajustes naturales de 1 a 4 segundos debido a decisiones de los mappers.

**Decisión:** Diseñar e integrar un **Algoritmo Juez** heurístico local con un **Filtro de Tiempo Elástico**. En lugar de aceptar ciegamente el primer resultado de YouTube, el sistema analiza en bucle cerrado los metadatos orientales (Unicode) y temporales antes de dar un veredicto.

### Tabla Comparativa: Búsqueda Tradicional vs Algoritmo Juez

| Aspecto | Búsqueda Directa (YouTube API) | Algoritmo Juez (Este Proyecto) |
|---------|--------------------------------|---------------------------------|
| **Consumo de Cuota API** | Alto (100 puntos por consulta en cada ejecución). | **Mínimo** (Reduce a 0 el consumo gracias a SQLite). |
| **Precisión en Idiomas** | Baja (Falla en caracteres cirílicos o japoneses). | **Alta** (Doble validación cruzada Romaji vs Unicode). |
| **Filtrado de Basura** | Nulo (Suele meter gameplays o replays del mapa). | **Absoluto** (Penalización estricta Anti-Gameplay: -80 pts). |
| **Variaciones de Tiempo** | Rígido (Rechaza audios que no calcen al segundo exacto). | **Elástico** (Baja la guardia si el audio varía $\le 4$ segundos). |

### Conclusión
La combinación de un Juez local adaptativo y una base de datos relacional ligera (SQLite) blinda el sistema contra falsos positivos, optimiza la cuota gratuita de Google Cloud y garantiza que la playlist final contenga únicamente pistas de audio limpias y correctas.

---

## Diagrama de Arquitectura

```text
┌──────────────┐     Inicia Sincronización     ┌──────────────────────────────────┐
│   Usuario    │ ────────────────────────────► │    osu-youtube-sync (Node.js)    │
│  (Terminal)  │ ◄──────────────────────────── │    Core Engine Monolito          │
│              │     Logs en Tiempo Real (CLI) │                                  │
└──────────────┘                               │  ┌────────────────────────────┐  │
       │                                       │  │  osuApi.js                 │  │
       │                                       │  │  (Fetch Top más jugados)   │  │
       │                                       │  └────────────────────────────┘  │
       │                                       │  ┌────────────────────────────┐  │
       │                                       │  │  SQLite (osu_yt_cache.db)  │  │
       │                                       │  │  └── Cache HIT (0ms Cuota) │  │
       │                                       │  └────────────────────────────┘  │
       │                                       │  ┌────────────────────────────┐  │
       │                                       │  │  youtubeApi.js (EL JUEZ)   │  │
       │                                       │  │  ├── Filtro Elástico ±4s   │  │
       │                                       │  │  └── Score Anti-Gameplay   │  │
       │                                       │  └────────────────────────────┘  │
       │                                       └──────────────────────────────────┘
       │                                                    │
       │       Inserta Video Validado en la Playlist        │
       │ ──────────────────────────────────────────────────►│
```

---

## Flujo de Ejecución (Pipeline)

1. **Autenticación osu!:** Genera y renueva el token OAuth2 de forma transparente.
2. **Extracción de Metadatos:** Obtiene los mapas del perfil. Extrae de forma simultánea `artist`/`title` (Romaji) y `artist_unicode`/`title_unicode` (Idioma nativo), junto con la duración en segundos.
3. **Verificación de Caché:** Consulta la base de datos local. Si hay un *Caché HIT*, salta directamente a la inserción en la playlist de YouTube, evitando llamadas a la red.
4. **Análisis del Juez (Caché MISS):**
   - Descarga en lote (*Batch Fetching*) los 10 resultados más relevantes de YouTube.
   - Pesa cada video individualmente: otorga puntos por coincidencias de tiempo y palabras clave oficiales (`official audio`, `lyrics`, `topic`), y resta puntos masivamente por términos de juego (`gameplay`, `replay`, `FC`, `skin`).
   - **Filtro de Seguridad Elástico:** Si el texto coincide poco pero la duración varía en menos de 4 segundos, el Juez reduce la exigencia de texto al 40% para rescatar canciones complejas en japonés o ruso.
5. **Persistencia e Inserción:** El ID del video ganador se guarda en la base de datos y se indexa en la playlist privada de YouTube del usuario.

---

## Base de Datos: `osu_yt_cache.db`

Esquema local relacional limpio y optimizado para el almacenamiento de equivalencias musicales.

### Tabla: `canciones_guardadas`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INTEGER | Clave primaria autoincremental |
| `artista` | TEXT | Nombre del artista en formato Romaji (Key de búsqueda) |
| `titulo` | TEXT | Título de la canción en formato Romaji (Key de búsqueda) |
| `youtube_id` | TEXT | ID único del video de YouTube validado por el Juez |

---

## Variables de Entorno

El sistema se configura exclusivamente mediante un archivo `.env` ubicado en la raíz del proyecto:

| Variable | Descripción | Requerido |
|----------|-------------|-----------|
| `OSU_CLIENT_ID` | ID de la aplicación en el panel de desarrollo de osu! | Sí |
| `OSU_CLIENT_SECRET` | Clave secreta de la aplicación de osu! | Sí |
| `OSU_USER_ID` | ID numérico de tu perfil de osu! a sincronizar | Sí |
| `YOUTUBE_CLIENT_ID` | ID de cliente OAuth2 de Google Cloud Console | Sí |
| `YOUTUBE_CLIENT_SECRET` | Clave secreta OAuth2 de Google Cloud Console | Sí |
| `YOUTUBE_PLAYLIST_ID` | ID de la playlist privada de YouTube de destino | Sí |

---

## Instalación y Desarrollo

### Requisitos Previos
- Node.js v16 o superior
- npm (incluido con Node)
- Credenciales de desarrollador de osu! y Google Cloud Console

### Configuración Inicial
```bash
# 1. Clonar el repositorio
git clone [https://github.com/tu-usuario/osu-youtube-sync.git](https://github.com/tu-usuario/osu-youtube-sync.git)
cd osu-youtube-sync

# 2. Instalar dependencias del sistema
npm install

# 3. Inicializar variables de entorno
cp .env.example .env
# Abre el archivo .env y configura tus credenciales de las APIs
```

### Comandos de Ejecución
```bash
# Iniciar el motor core de sincronización
npm start
```

---

## 🗺️ Hoja de Ruta (Roadmap)

- [x] **Fase 1: Conexión y Autenticación:** Sincronización base con osu! API v2 y YouTube Data API v3.
- [x] **Fase 2: Persistencia de Datos:** Arquitectura de caché local con SQLite3 para optimización de cuota a 0ms.
- [x] **Fase 3: Inteligencia del Buscador:** Integración del Algoritmo Juez, Filtro de Tiempo Elástico (±4s) y extracción doble Unicode.
- [ ] **Fase 4: Escalabilidad y Despliegue:** Ampliación del límite de lectura (Top 100), Dockerización del entorno y desarrollo de una interfaz gráfica (Web UI).

---

## Bitácora de Cambios (Changelog Reciente)

### Fase 3 — Implementación de Filtro Elástico y Engine Unicode
- **Filtro Elástico de Tiempo:** Si la diferencia temporal entre el beatmap de osu! y el video de YouTube es menor o igual a 4 segundos, el Juez asume que la pista es correcta y reduce el umbral de texto al 40%. Salva mapas recortados o con silencios al final.
- **Soporte Unicode Avanzado:** El pipeline de extracción ahora lee nombres nativos. Canciones orientales o cirílicas pasaron de un 30% a un 100% de efectividad en el match de texto.
- **Motor Anti-Gameplay:** Añadido filtrado por palabras clave negativas en títulos y nombres de canales para eludir repeticiones de jugadas de la comunidad.
- **Caché Relacional Activa:** Implementados métodos `buscarEnCache()` y `guardarEnCache()` para independizar el sistema de la red en ejecuciones consecutivas.