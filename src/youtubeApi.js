const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const stringSimilarity = require('string-similarity');

const { buscarEnCache, guardarEnCache } = require('./database');
const TOKEN_PATH = path.join(__dirname, '../youtube-token.json');

const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
);

function getAuthUrl() { return oauth2Client.generateAuthUrl({ access_type: 'offline', scope: ['https://www.googleapis.com/auth/youtube'] }); }
async function guardarToken(code) { const { tokens } = await oauth2Client.getToken(code); oauth2Client.setCredentials(tokens); fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens)); }
function cargarToken() { if (fs.existsSync(TOKEN_PATH)) { const token = JSON.parse(fs.readFileSync(TOKEN_PATH)); oauth2Client.setCredentials(token); return true; } return false; }

const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

function parsearDuracionISO(duracionISO) {
    const match = duracionISO.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    return (parseInt(match[1] || 0, 10) * 3600) + (parseInt(match[2] || 0, 10) * 60) + parseInt(match[3] || 0, 10);
}

async function buscarVideoYouTube(cancionObjeto) {
    try {
        const { artista, artista_unicode, titulo, titulo_unicode, duracion_segundos } = cancionObjeto;

        const videoIdCacheado = await buscarEnCache(artista, titulo);
        if (videoIdCacheado) {
            console.log(`✨ [Caché HIT] ${artista} - ${titulo} recuperada.`);
            return videoIdCacheado;
        }

        console.log(`🔍 [Caché MISS] Analizando candidatos para: ${artista} - ${titulo} (~${duracion_segundos}s)`);
        
        const query = `${artista_unicode} - ${titulo_unicode}`; 
        
        const buscarResponse = await youtube.search.list({
            part: 'id',
            q: query,
            maxResults: 10,
            type: 'video'
        });
        
        const candidatos = buscarResponse.data.items || [];
        if (candidatos.length === 0) return null;

        const listaIds = candidatos.map(item => item.id.videoId).join(',');
        
        // 🚀 MEJORA: Añadimos 'statistics' para poder leer el número de vistas (viewCount)
        const videosResponse = await youtube.videos.list({ 
            part: 'contentDetails,snippet,statistics', 
            id: listaIds 
        });
        const detallesVideos = videosResponse.data.items || [];
        
        let mejorVideoId = null;
        let mejorPuntaje = -999;
        let infoMejorVideo = "";
        let similitudTextoGanador = 0;
        let esCanalOficialGanador = false;
        let contieneOriginalGanador = false;

        for (const video of detallesVideos) {
            const vId = video.id;
            const vTitulo = video.snippet.title;
            const vCanal = video.snippet.channelTitle.toLowerCase();
            const vDuracionSegundos = parsearDuracionISO(video.contentDetails.duration);
            // Extraemos las vistas reales del video
            const vVistas = parseInt(video.statistics?.viewCount || 0, 10);

            let puntaje = 0;

            // REGLA 1: Tolerancia de tiempo (Máximo 60 puntos)
            const diferenciaTiempo = Math.abs(vDuracionSegundos - duracion_segundos);
            if (diferenciaTiempo <= 4) puntaje += 60;
            else if (diferenciaTiempo <= 10) puntaje += 30;
            else puntaje -= 60; // Penalización si la duración no cuadra nada

            // REGLA 2: Similitud de Texto (Máximo 40 puntos)
            const textoYT = vTitulo.toLowerCase();
            const similitudRomaji = stringSimilarity.compareTwoStrings(`${artista} - ${titulo}`.toLowerCase(), textoYT);
            const similitudUnicode = stringSimilarity.compareTwoStrings(`${artista_unicode} - ${titulo_unicode}`.toLowerCase(), textoYT);
            
            const mejorSimilitud = Math.max(similitudRomaji, similitudUnicode);
            puntaje += (mejorSimilitud * 40);

            // 🚀 NUEVA REGLA 2.5: ¿Contiene el texto exacto? 
            // Si el título de YouTube contiene textualmente "Artista - Titulo", sumamos un gran bonus
            const contieneOriginal = textoYT.includes(`${artista} - ${titulo}`.toLowerCase()) || 
                                     textoYT.includes(`${artista_unicode} - ${titulo_unicode}`.toLowerCase());
            if (contieneOriginal) puntaje += 35;

            // 🚀 REGLA 3: Anti-Gameplay ULTRA REFORZADO (Evitamos gameplays de osu!)
            const terminosGameplay = [
                'gameplay', 'replay', ' play', ' keyboard', ' fc ', ' pass', ' liveplay', 
                ' skin', 'osu!', 'beatmap', ' difficulty', ' diff', '★', ' pp ', 'autoplayer', 'cover'
            ];
            if (terminosGameplay.some(term => textoYT.includes(term) || vCanal.includes(term))) {
                puntaje -= 180; // Penalización masiva, un gameplay nunca ganará
            }

            // 🚀 REGLA 4: Bonus por canal oficial o distribuidor autorizado (+35 puntos)
            const esCanalOficial = vCanal.includes('topic') || 
                                   vCanal.includes('vevo') || 
                                   vCanal.includes(artista.toLowerCase()) || 
                                   vCanal.includes(artista_unicode.toLowerCase());
            
            if (esCanalOficial) {
                puntaje += 35;
            } else {
                // Sigue siendo un bonus si el título dice que es oficial
                const terminosOficiales = ['official', 'audio', 'lyrics', 'mv', 'video oficial'];
                if (terminosOficiales.some(term => textoYT.includes(term))) puntaje += 15;
            }

            // 🚀 NUEVA REGLA 5: Filtro por popularidad (Vistas sugerido por el master)
            if (vVistas > 5000000) puntaje += 30;       // Más de 5 Millones (Hit mundial)
            else if (vVistas > 500000) puntaje += 15;   // Más de 500k vistas
            else if (vVistas < 10000 && !esCanalOficial) {
                puntaje -= 40; // Si tiene menos de 10k vistas y NO es un canal oficial, probablemente sea basura/resubido
            }

            // Filtro anti-remix no deseado
            if (textoYT.includes('remix') && !titulo.toLowerCase().includes('remix') && !titulo_unicode.toLowerCase().includes('remix')) {
                puntaje -= 50; 
            }

            // Guardamos al mejor candidato de la ronda
            if (puntaje > mejorPuntaje) {
                mejorPuntaje = puntaje;
                mejorVideoId = vId;
                similitudTextoGanador = mejorSimilitud; 
                esCanalOficialGanador = esCanalOficial;
                contieneOriginalGanador = contieneOriginal;
                infoMejorVideo = `"${vTitulo}" [Canal: ${video.snippet.channelTitle} | Vistas: ${vVistas.toLocaleString()} | Similitud: ${(mejorSimilitud * 100).toFixed(0)}%]`;
            }
        }

        // 🛡️ FILTRO DE SEGURIDAD INTELIGENTE Y RIGUROSO
        let umbralCorte = 0.65; // Tu 65% de rigurosidad base.
        
        // Si estamos 100% seguros de que es el canal oficial o el título contiene la cadena exacta,
        // bajamos el umbral a 45% porque títulos oficiales largos como "Artist - Title (Official Music Video Released by...)" bajan el porcentaje de similitud textual por culpa del relleno.
        if (esCanalOficialGanador || contieneOriginalGanador) {
            umbralCorte = 0.45; 
        }

        if (mejorVideoId && similitudTextoGanador < umbralCorte) {
            console.log(`⚠️ [Filtro Seguridad] Ganador rechazado: Similitud ${(similitudTextoGanador * 100).toFixed(0)}% (Mínimo: ${umbralCorte * 100}%). Prefiriendo fallar seguro.`);
            return null;
        }

        if (mejorVideoId) {
            console.log(`🧠 [Juez Elección] Ganador: ${infoMejorVideo}`);
            await guardarEnCache(artista, titulo, mejorVideoId);
        }

        return mejorVideoId;
    } catch (error) {
        console.error("Error en el Cerebro Juez:", error.message);
        return null;
    }
}

async function crearPlaylistOficial() {
    const response = await youtube.playlists.insert({ part: 'snippet,status', resource: { snippet: { title: 'osu! Sync Playlist', description: 'Generado automáticamente.' }, status: { privacyStatus: 'private' } } });
    return response.data.id;
}
async function agregarVideoAPlaylist(playlistId, videoId) { await youtube.playlistItems.insert({ part: 'snippet', resource: { snippet: { playlistId: playlistId, resourceId: { kind: 'youtube#video', videoId: videoId } } } }); }

module.exports = { getAuthUrl, guardarToken, cargarToken, buscarVideoYouTube, crearPlaylistOficial, agregarVideoAPlaylist };