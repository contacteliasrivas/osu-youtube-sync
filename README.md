# 🎧 osu! to YouTube Sync Tool

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D%2018.0.0-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Status](https://img.shields.io/badge/status-Active-success.svg)

> Herramienta Full-Stack automatizada que sincroniza tus beatmaps más jugados de osu! y genera una lista de reproducción privada en tu canal de YouTube de forma inteligente.

---

## 📖 Tabla de Contenidos

- [Sobre el Proyecto](#-sobre-el-proyecto)
- [Arquitectura y Flujo](#-arquitectura-y-flujo)
- [Características Principales](#-características-principales)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación](#-instalación)
- [Configuración de Entorno](#-configuración-de-entorno)
- [Uso del Sistema](#-uso-del-sistema)
- [Hoja de Ruta (Roadmap)](#-hoja-de-ruta-roadmap)

---

## 🚀 Sobre el Proyecto

**osu! to YouTube Sync Tool** nace de la necesidad de trasladar la experiencia musical del juego *osu!* a plataformas de consumo diario como YouTube. En lugar de buscar manualmente cada canción, este sistema se conecta directamente a la API oficial de osu!, extrae las estadísticas del usuario y utiliza el motor de búsqueda de YouTube Data v3 para compilar una playlist de forma 100% automatizada.

## 🧠 Arquitectura y Flujo

1. **Extracción:** Conexión segura a `osu! API (v2)` mediante credenciales de cliente para obtener el Top de mapas jugados.
2. **Autenticación:** Implementación del protocolo `OAuth2` de Google para solicitar acceso seguro y temporal a la cuenta de YouTube del usuario.
3. **Filtro de Búsqueda:** Motor de búsqueda optimizado para descartar "gameplays" y priorizar audios oficiales (`Official Audio` / `Topic`).
4. **Inyección:** Creación asíncrona de la lista de reproducción e inserción controlada de videos respetando los límites de cuota (Rate Limiting).

## ✨ Características Principales

- **Integración OAuth2:** Sesiones seguras y persistentes (mediante tokens locales) sin exponer claves API.
- **Auto-Despliegue UI:** El servidor Node.js lanza automáticamente el cliente web en el navegador nativo (Zero-config UX).
- **Control de Cuota (API Limits):** Límite estricto de 10 canciones por ejecución para mantener el uso dentro del Free Tier de Google Cloud.
- **Smart Querying (v1):** Algoritmo de búsqueda ajustado para maximizar la tasa de acierto de música original frente a videos de gameplay.

## 📋 Requisitos Previos

Asegúrate de contar con las siguientes herramientas instaladas y configuradas:

- [Node.js](https://nodejs.org/) (v18.0.0 o superior)
- Git
- Credenciales de la [API de osu!](https://osu.ppy.sh/home/account/edit#oauth) (Client ID & Secret)
- Proyecto en [Google Cloud Console](https://console.cloud.google.com/) con **YouTube Data API v3** habilitada y credenciales OAuth 2.0.

## 🛠️ Instalación

1. Clona el repositorio en tu máquina local:
   ```bash
   git clone [https://github.com/TuUsuario/osu-youtube-sync.git](https://github.com/TuUsuario/osu-youtube-sync.git)
   ```
2. Navega al directorio del proyecto:
   ```bash
   cd osu-youtube-sync
   ```
3. Instala las dependencias del servidor:
   ```bash
   npm install
   ```

## ⚙️ Configuración de Entorno

Crea un archivo `.env` en la raíz del proyecto. Este archivo contendrá tus secretos y no debe ser subido a repositorios públicos:

```env
# 🔴 osu! API Credentials
OSU_CLIENT_ID=tu_id_de_cliente_osu
OSU_CLIENT_SECRET=tu_secreto_de_osu

# 🔵 Google Cloud / YouTube OAuth2 Credentials
YOUTUBE_CLIENT_ID=tu_id_de_google
YOUTUBE_CLIENT_SECRET=tu_secreto_de_google
YOUTUBE_REDIRECT_URI=http://localhost:3000/oauth2callback
```
*(Nota: Asegúrate de agregar el correo que vas a usar en la sección de "Usuarios de Prueba" dentro de la pantalla de consentimiento de Google Cloud).*

## 🚦 Uso del Sistema

1. Inicia el servidor de desarrollo:
   ```bash
   npm start
   ```
2. La interfaz de usuario se abrirá automáticamente en tu navegador (`http://localhost:3000`).
3. Haz clic en **Generar Playlist**.
4. Autoriza la aplicación a través de la pasarela de Google (solo la primera vez).
5. Observa el progreso a través de los logs en la terminal.
6. ¡Abre el enlace generado y disfruta de tu música!

## 🗺️ Hoja de Ruta (Roadmap)

El proyecto se encuentra en constante evolución. Las próximas características a implementar son:

- [ ] **Persistencia (SQLite):** Implementar caché local de IDs de YouTube para reducir a 0 el consumo de cuota en canciones previamente procesadas.
- [ ] **Algoritmo Juez (Levenshtein):** Precisión del 99% mediante comparación de duración exacta en milisegundos y similitud de cadenas de texto.
- [ ] **Batch Fetching:** Agrupación de peticiones a la API de YouTube (`maxResults: 50`) para maximizar el rendimiento.
- [ ] **Contenedores:** Soporte para despliegue automatizado mediante `Docker`.

---
*Desarrollado con pasión para la comunidad de osu!* 🎯