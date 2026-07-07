require('dotenv').config();
const express = require('express');
const path = require('path');


const { getOsuToken, getBeatmapsMasJugados } = require('./osuApi');
const { 
    getAuthUrl, guardarToken, cargarToken, 
    buscarVideoYouTube, crearPlaylistOficial, agregarVideoAPlaylist 
} = require('./youtubeApi');

const app = express();
const PUERTO = 3000;
const OSU_USER_ID = 17206927; // Tu ID de osu!

app.use(express.static(path.join(__dirname, '../public')));

// Ruta principal que se activa al pulsar el botón en la web
app.get('/api/generar', async (req, res) => {
    try {
        // Si no estás logueado en Google, frena todo y manda el link de login
        if (!cargarToken()) {
            console.log("🔒 No hay sesión activa de YouTube. Solicitando login...");
            return res.json({ exito: false, authRequired: true, authUrl: getAuthUrl() });
        }

        console.log("🚀 Iniciando sincronización automatizada...");
        
        const token = await getOsuToken();
        if (!token) throw new Error("Error obteniendo el token de osu!");

        let misCanciones = await getBeatmapsMasJugados(OSU_USER_ID, token);
        if (misCanciones.length === 0) throw new Error("No se encontraron canciones en tu perfil.");
        
        // LIMITADO A 10 CANCIONES (Para cuidar tu cuota diaria de la API)
        misCanciones = misCanciones.slice(0, 10);

        console.log("📁 Creando playlist privada en tu cuenta de YouTube...");
        const playlistId = await crearPlaylistOficial();

        let agregados = 0;
        console.log("🔍 Buscando canciones y añadiéndolas una a una...");
        
        for (const cancion of misCanciones) {
            const videoId = await buscarVideoYouTube(cancion);
            if (videoId) {
                await agregarVideoAPlaylist(playlistId, videoId);
                agregados++;
                console.log(`✅ Añadido con éxito: ${cancion}`);
            }
            // Pausa de 1.2 segundos para que YouTube no nos bloquee por ir muy rápido
            await new Promise(resolve => setTimeout(resolve, 1200));
        }

        if (agregados > 0) {
            const linkPlaylist = `https://www.youtube.com/playlist?list=${playlistId}`;
            console.log("🎉 ¡Sincronización completada con éxito!");
            res.json({ exito: true, url: linkPlaylist });
        } else {
            res.json({ exito: false, mensaje: "No se pudo añadir ningún video." });
        }

    } catch (error) {
        console.error("❌ Error en el servidor:", error.message);
        res.status(500).json({ exito: false, mensaje: error.message });
    }
});

// Ruta a la que Google redirige al usuario tras aceptar los permisos
app.get('/oauth2callback', async (req, res) => {
    const code = req.query.code;
    if (code) {
        try {
            await guardarToken(code);
            console.log("🔑 Acceso concedido. Token guardado localmente.");
            // Mensaje elegante antes de devolverte a la app
            res.send(`
                <body style="background:#1a1a1a; color:#ff66aa; text-align:center; font-family:sans-serif; margin-top:15%;">
                    <h2>¡Permiso concedido, master! 🚀</h2>
                    <p>Guardando credenciales seguras y volviendo a la herramienta...</p>
                    <script>setTimeout(() => window.location.href = '/', 2000);</script>
                </body>
            `);
        } catch (err) {
            console.error("Error al procesar el token de Google:", err);
            res.send("❌ Error crítico al procesar la autenticación.");
        }
    }
});

app.listen(PUERTO, async () => {
    console.log(`\n=========================================`);
    console.log(`🌐 SERVIDOR CORE INICIADO - PROTOCOLO OAUTH2`);
    console.log(`🚀 Desplegando interfaz en el navegador...`);
    console.log(`=========================================\n`);
    
    // Comando nativo de Windows para abrir el navegador por defecto
    const { exec } = require('child_process');
    exec(`start http://localhost:${PUERTO}`);
});