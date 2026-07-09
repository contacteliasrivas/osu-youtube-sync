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

// 🛠️ Recibe el objeto completo con los Unicodes
async function buscarVideoYouTube(cancionObjeto) {
    try {
        const { artista, artista_unicode, titulo, titulo_unicode, duracion_segundos } = cancionObjeto;

        const videoIdCacheado = await buscarEnCache(artista, titulo);
        if (videoIdCacheado) {
            console.log(`✨ [Caché HIT] ${artista} - ${titulo} recuperada.`);
            return videoIdCacheado;
        }

        console.log(`🔍 [Caché MISS] Analizando candidatos para: ${artista} - ${titulo} (~${duracion_segundos}s)`);
        
        // Buscamos priorizando el nombre nativo (Unicode)
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
        const videosResponse = await youtube.videos.list({ part: 'contentDetails,snippet', id: listaIds });
        const detallesVideos = videosResponse.data.items || [];
        
        let mejorVideoId = null;
        let mejorPuntaje = -999;
        let infoMejorVideo = "";
        let similitudTextoGanador = 0; // 🛡️ Guarda el % de coincidencia

        for (const video of detallesVideos) {
            const vId = video.id;
            const vTitulo = video.snippet.title;
            const vCanal = video.snippet.channelTitle;
            const vDuracionSegundos = parsearDuracionISO(video.contentDetails.duration);

            let puntaje = 0;

            // REGLA 1: Tolerancia de tiempo
            const diferenciaTiempo = Math.abs(vDuracionSegundos - duracion_segundos);
            if (diferenciaTiempo <= 4) puntaje += 60;
            else if (diferenciaTiempo <= 10) puntaje += 30;
            else puntaje -= 50;

            // REGLA 2: Similitud de Texto Doble (Compara contra Romaji y Unicode)
            const textoYT = vTitulo.toLowerCase();
            const similitudRomaji = stringSimilarity.compareTwoStrings(`${artista} - ${titulo}`.toLowerCase(), textoYT);
            const similitudUnicode = stringSimilarity.compareTwoStrings(`${artista_unicode} - ${titulo_unicode}`.toLowerCase(), textoYT);
            
            const mejorSimilitud = Math.max(similitudRomaji, similitudUnicode);
            puntaje += (mejorSimilitud * 40);

            // REGLA 3: Anti-Gameplay
            const terminosGameplay = ['gameplay', 'replay', ' play', ' keyboard', ' fc ', ' pass', ' liveplay', ' skin'];
            if (terminosGameplay.some(term => textoYT.includes(term) || vCanal.toLowerCase().includes(term))) {
                puntaje -= 80;
            }

            // REGLA 4: Bonus por oficialidad
            const terminosOficiales = ['official', 'audio', 'topic', 'lyrics', 'mv', 'video oficial'];
            if (terminosOficiales.some(term => textoYT.includes(term) || vCanal.toLowerCase().includes(term))) {
                puntaje += 15;
            }

            // Filtro anti-remix no deseado
            if (textoYT.includes('remix') && !titulo.toLowerCase().includes('remix') && !titulo_unicode.toLowerCase().includes('remix')) {
                puntaje -= 40; 
            }

            if (puntaje > mejorPuntaje) {
                mejorPuntaje = puntaje;
                mejorVideoId = vId;
                similitudTextoGanador = mejorSimilitud; 
                infoMejorVideo = `"${vTitulo}" [Puntaje: ${puntaje.toFixed(1)} | Similitud: ${(mejorSimilitud * 100).toFixed(0)}%]`;
            }
        }

        // 🛡️ FILTRO DE SEGURIDAD (Mínimo 35%)
        if (mejorVideoId && similitudTextoGanador < 0.35) {
            console.log(`⚠️ [Filtro Seguridad] Ganador rechazado: Similitud ${(similitudTextoGanador * 100).toFixed(0)}% (Mínimo requerido: 65%). Evitando video erróneo.`);
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