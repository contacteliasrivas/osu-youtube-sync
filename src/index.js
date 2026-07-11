require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');

const { getOsuToken, getBeatmapsMasJugados, getOsuUserToken, getOsuUserData } = require('./osuApi');

const { 
    getAuthUrl, guardarToken, cargarToken, 
    buscarVideoYouTube, crearPlaylistOficial, agregarVideoAPlaylist 
} = require('./youtubeApi');

const { inicializarDB } = require('./database');

const app = express();

// ==========================================
// 🧠 MEMORIA DEL SERVIDOR (SESIONES)
// ==========================================
app.use(session({
    secret: 'secreto_super_seguro_osu_sync', // En el futuro lo pondremos en el .env
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // false porque estamos en localhost (HTTP)
}));

const PUERTO = process.env.PORT || 3000; 

app.use(express.static(path.join(__dirname, '../public')));

// Variable global para mantener la conexión SSE abierta
let sseClient = null;

// ==========================================
// 🗺️ RUTAS DE NAVEGACIÓN WEB
// ==========================================

// Redirigir la raíz a la landing
app.get('/', (req, res) => res.redirect('/landing'));

// Ruta de la Landing Page
app.get('/landing', (req, res) => {
    if (req.session.osuUser) return res.redirect('/dashboard');
    res.sendFile(path.join(__dirname, '../public/landing.html'));
});

// Ruta del Dashboard Privado
app.get('/dashboard', (req, res) => {
    if (!req.session.osuUser) return res.redirect('/landing');
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// Endpoint para que el Dashboard pida los datos del usuario logueado
app.get('/api/me', (req, res) => {
    if (!req.session.osuUser) return res.status(401).json({ error: "No autorizado" });
    res.json(req.session.osuUser);
});

// ==========================================
// 👤 AUTENTICACIÓN CON OSU! (Identificar Usuario)
// ==========================================

// 1. Ruta que envía al usuario a la página de login de osu!
app.get('/auth/osu', (req, res) => {
    const osuAuthUrl = `https://osu.ppy.sh/oauth/authorize?client_id=${process.env.OSU_CLIENT_ID}&redirect_uri=${process.env.OSU_REDIRECT_URI}&response_type=code&scope=identify%20public`;
    res.redirect(osuAuthUrl);
});

// 2. Ruta donde osu! nos devuelve al usuario con su Código Secreto
app.get('/auth/osu/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) {
        return res.send("❌ Error: No se recibió ningún código de autorización de osu!.");
    }

    try {
        console.log("⏳ Intercambiando código por token de usuario...");
        const userToken = await getOsuUserToken(code);
        
        console.log("🕵️ Descubriendo la identidad del usuario...");
        const userData = await getOsuUserData(userToken);

        console.log(`✅ ¡Usuario identificado! Hola, ${userData.username} (ID: ${userData.id})`);

        // 🧠 GUARDAMOS AL USUARIO EN LA SESIÓN
        req.session.osuUser = {
            id: userData.id,
            username: userData.username,
            avatar: userData.avatar_url,
            token: userToken 
        };

        // 🚀 Redirección elegante al Dashboard
        return res.redirect('/dashboard');

    } catch (error) {
        console.error("Error en el flujo de OAuth de osu!:", error.message);
        
        // 🛡️ Solo intentamos enviar el error si no hemos respondido aún
        if (!res.headersSent) {
            res.status(500).send("❌ Hubo un error al intentar conectarse con osu!.");
        }
    }
});

// ==========================================
// ⚙️ RUTAS DE SINCRONIZACIÓN Y ESTADO
// ==========================================

app.get('/api/estado', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    res.write(':\n\n'); 
    sseClient = res;
    req.on('close', () => { sseClient = null; });
});

function emitirEstado(mensaje, color = "#333333", progreso = null) {
    if (sseClient) {
        sseClient.write(`data: ${JSON.stringify({ mensaje, color, progreso })}\n\n`);
    }
    console.log(mensaje);
}

app.get('/api/generar', async (req, res) => {
    try {
        // 1. VERIFICAR SESIÓN DE OSU!
        if (!req.session.osuUser) {
            return res.status(401).json({ exito: false, mensaje: "Debes iniciar sesión con osu! primero." });
        }

        // 2. VERIFICAR SESIÓN DE YOUTUBE
        if (!cargarToken()) {
            console.log("🔒 No hay sesión activa de YouTube. Solicitando login...");
            return res.json({ exito: false, authRequired: true, authUrl: getAuthUrl() });
        }

        // 3. IDENTIFICAR AL USUARIO ACTIVO
        const miUsuarioID = req.session.osuUser.id;
        const miUsuarioToken = req.session.osuUser.token;

        emitirEstado(`🚀 Iniciando sincronización para ${req.session.osuUser.username}...`, "#d35400", 2);
        
        // 4. OBTENER SUS CANCIONES
        const misCanciones = await getBeatmapsMasJugados(miUsuarioID, miUsuarioToken);
        if (misCanciones.length === 0) throw new Error("No se encontraron canciones en tu perfil.");

        emitirEstado("📁 Creando playlist privada en YouTube...", "#d35400", 5);
        const playlistId = await crearPlaylistOficial();

        let agregados = 0;
        const totalCanciones = misCanciones.length;
        
        // 🛡️ CONTROL DE DUPLICADOS EN MEMORIA
        const cancionesProcesadas = new Set();

        for (let i = 0; i < totalCanciones; i++) {
            const cancion = misCanciones[i];
            const porcentaje = Math.round(((i + 1) / totalCanciones) * 100);

            if (!cancion.artista || !cancion.titulo) continue;

            const claveCancion = `${cancion.artista.trim().toLowerCase()} - ${cancion.titulo.trim().toLowerCase()}`;

            if (cancionesProcesadas.has(claveCancion)) {
                emitirEstado(`🔁 Omitido (Dificultad repetida): ${cancion.titulo}`, "#7f8c8d", porcentaje);
                await new Promise(resolve => setTimeout(resolve, 80)); 
                continue;
            }
            
            cancionesProcesadas.add(claveCancion);

            emitirEstado(`[${i + 1}/${totalCanciones}] Buscando: ${cancion.artista} - ${cancion.titulo}`, "#555555", porcentaje);

            const videoId = await buscarVideoYouTube(cancion);
            
            if (videoId) {
                await agregarVideoAPlaylist(playlistId, videoId);
                agregados++;
                emitirEstado(`✅ Añadido: ${cancion.titulo}`, "#27ae60", porcentaje);
            } else {
                emitirEstado(`⚠️ Omitido: ${cancion.titulo} (Filtro Estricto)`, "#c0392b", porcentaje);
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        if (agregados > 0) {
            const linkPlaylist = `https://www.youtube.com/playlist?list=${playlistId}`;
            emitirEstado(`🎉 ¡Proceso terminado! ${agregados} canciones añadidas.`, "#d35400", 100);
            res.json({ exito: true, url: linkPlaylist });
        } else {
            res.json({ exito: false, mensaje: "Ningún video superó el filtro estricto." });
        }

    } catch (error) {
        emitirEstado(`❌ Error crítico: ${error.message}`, "#c0392b", 0);
        res.status(500).json({ exito: false, mensaje: error.message });
    }
});

// ==========================================
// 🚀 INICIO DEL SERVIDOR
// ==========================================
app.listen(PUERTO, async () => {
    console.log(`\n=========================================`);
    console.log(`🌐 SERVIDOR CORE INICIADO - PROTOCOLO OAUTH2`);
    try {
        await inicializarDB();
        console.log(`📦 BASE DE DATOS LOCAL: Inicializada y mapeada.`);
    } catch (dbError) {
        console.error(`❌ CRÍTICO: No se pudo iniciar la caché de SQLite:`, dbError.message);
    }
    console.log(`🚀 Escuchando en http://localhost:${PUERTO}`);
    console.log(`=========================================\n`);
});