require('dotenv').config();
const express = require('express');
const path = require('path');

const { getOsuToken, getBeatmapsMasJugados } = require('./osuApi');
const { 
    getAuthUrl, guardarToken, cargarToken, 
    buscarVideoYouTube, crearPlaylistOficial, agregarVideoAPlaylist 
} = require('./youtubeApi');

// 🛠️ FASE 2: Importamos la inicialización de la base de datos
const { inicializarDB } = require('./database');

const app = express();
const PUERTO = 3000;
const OSU_USER_ID = 17206927; // Tu ID de osu!

app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/generar', async (req, res) => {
    try {
        if (!cargarToken()) {
            console.log("🔒 No hay sesión activa de YouTube. Solicitando login...");
            return res.json({ exito: false, authRequired: true, authUrl: getAuthUrl() });
        }

        console.log("🚀 Iniciando sincronización automatizada...");
        
        const token = await getOsuToken();
        if (!token) throw new Error("Error obteniendo el token de osu!");

        let misCanciones = await getBeatmapsMasJugados(OSU_USER_ID, token);
        if (misCanciones.length === 0) throw new Error("No se encontraron canciones en tu perfil.");
        
        // LIMITADO A 10 CANCIONES
        misCanciones = misCanciones.slice(0, 10);

        console.log("📁 Creando playlist privada en tu cuenta de YouTube...");
        const playlistId = await crearPlaylistOficial();

        let agregados = 0;
        console.log("🔍 Buscando canciones y añadiéndolas una a una...");
        
        for (const cancion of misCanciones) {
            try {
                // Revisamos que los datos base existan
                if (!cancion.artista || !cancion.titulo) {
                    console.log(`⚠️ Datos inválidos en osu!, saltando...`);
                    continue;
                }

                // 🛠️ Le pasamos el objeto entero (que ahora trae el Unicode)
                const videoId = await buscarVideoYouTube(cancion);
                
                if (videoId) {
                    await agregarVideoAPlaylist(playlistId, videoId);
                    agregados++;
                    console.log(`✅ Añadido con éxito: ${cancion.artista} - ${cancion.titulo}`);
                }
            } catch (errCancion) {
                console.error(`⚠️ Falló la sincronización para "${cancion.artista} - ${cancion.titulo}":`, errCancion.message);
            }
            
            // Pausa de 2 segundos para cuidar la cuota de YouTube
            await new Promise(resolve => setTimeout(resolve, 2000));
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

app.get('/oauth2callback', async (req, res) => {
    const code = req.query.code;
    if (code) {
        try {
            await guardarToken(code);
            console.log("🔑 Acceso concedido. Token guardado localmente.");
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
    
    // 🛠️ Inicializamos SQLite antes de operar
    try {
        await inicializarDB();
        console.log(`📦 BASE DE DATOS LOCAL: Inicializada y mapeada.`);
    } catch (dbError) {
        console.error(`❌ CRÍTICO: No se pudo iniciar la caché de SQLite:`, dbError.message);
    }

    console.log(`🚀 Desplegando interfaz en el navegador...`);
    console.log(`=========================================\n`);
    
    const { exec } = require('child_process');
    exec(`start http://localhost:${PUERTO}`);
});