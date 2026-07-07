# 🎵 osu! to YouTube Sync

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)
![Osu!](https://img.shields.io/badge/osu!-FF66AA?style=for-the-badge&logo=osu!&logoColor=white)
![YouTube API](https://img.shields.io/badge/YouTube_API-FF0000?style=for-the-badge&logo=youtube&logoColor=white)

## 🎯 Meta del Proyecto

**osu! to YouTube Sync** nace con una misión clara: eliminar la fricción entre jugar y escuchar. Este proyecto automatiza la creación de playlists en YouTube basándose en las estadísticas reales de tu perfil de osu!. Diseñado para jugadores y desarrolladores, transforma horas de juego en listas de reproducción listas para disfrutar, utilizando un enfoque Full-Stack con Node.js.

## 🏗️ Estructura del Proyecto

El repositorio está organizado con una arquitectura limpia de cliente-servidor ligero:

```text
osu-youtube-sync/
├── public/
│   └── index.html       # Interfaz gráfica (Front-end) con estética osu!
├── src/
│   ├── index.js         # Servidor principal (Express) y rutas de la API
│   ├── osuApi.js        # Módulo de autenticación y consumo de osu! API v2
│   └── youtubeApi.js    # Módulo de integración con YouTube Data API v3
├── .env.example         # Plantilla de variables de entorno (Credenciales)
├── .gitignore           # Exclusiones de Git (seguridad de módulos y credenciales)
├── package.json         # Manifiesto del proyecto y dependencias
└── README.md            # Documentación técnica
```

## ✨ Características Principales

- **Sincronización Inteligente:** Cruza datos entre la API oficial de osu! y la de YouTube para encontrar las versiones exactas de tus beatmaps.
- **Interfaz "osu! Theme":** Un Front-end moderno, interactivo y responsivo que respeta la paleta de colores y el estilo visual del juego.
- **Backend Optimizado:** Servidor Express que maneja la lógica de negocio y las peticiones asíncronas de manera segura.
- **Gestión de Límite de Cuotas:** Diseñado para respetar los límites de la API de Google (YouTube Data API) manteniendo un rendimiento fluido.

## 🚀 Hoja de Ruta (Roadmap)

- [ ] **Fase 1:** Conexión de APIs y generación de enlaces de listas anónimas (Completado).
- [ ] **Fase 2:** Implementación de **OAuth2** para crear listas de reproducción permanentes directamente en la cuenta de Google del usuario.
- [ ] **Fase 3:** Selector dinámico en el Front-end (Top Jugadas vs. Últimas Descargas).
- [ ] **Fase 4:** Script de automatización de inicio (`start-app`) para abrir el navegador de forma nativa.

## 🛠️ Requisitos e Instalación

Para ejecutar este entorno en local, asegúrate de tener instalado [Node.js](https://nodejs.org/).

**1. Clonar el repositorio**
```bash
git clone https://github.com/TU_USUARIO/osu-youtube-sync.git
cd osu-youtube-sync
```

**2. Instalar dependencias**
```bash
npm install
```

**3. Configurar variables de entorno**
Crea un archivo `.env` en la raíz y añade tus llaves:
```env
OSU_CLIENT_ID=tu_id_de_osu
OSU_CLIENT_SECRET=tu_secreto_de_osu
YOUTUBE_API_KEY=tu_api_key_de_youtube
# Próximamente: Credenciales de OAuth2
```

## 💻 Uso

Levanta el servidor local con el siguiente comando:
```bash
node src/index.js
```
Accede a `http://localhost:3000` desde tu navegador web para utilizar la herramienta.