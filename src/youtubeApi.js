const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Ruta donde se guardará tu sesión secreta de Google para no pedir login siempre
const TOKEN_PATH = path.join(__dirname, '../youtube-token.json');

// Inicializamos el cliente de OAuth2 con tus variables del .env
const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
);

// Genera el link oficial de Google para que inicies sesión
function getAuthUrl() {
    return oauth2Client.generateAuthUrl({
        access_type: 'offline', // Permite refrescar el token en el fondo
        scope: ['https://www.googleapis.com/auth/youtube']
    });
}

// Guarda el token en el archivo local cuando Google nos da el visto bueno
async function guardarToken(code) {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
}

// Revisa si ya te logueaste antes para saltarse el inicio de sesión
function cargarToken() {
    if (fs.existsSync(TOKEN_PATH)) {
        const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
        oauth2Client.setCredentials(token);
        return true;
    }
    return false;
}

// Conexión oficial a la API de YouTube usando tu cuenta
const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

// Busca el video de la canción y devuelve su ID (Versión sin Gameplays)
async function buscarVideoYouTube(cancion) {
    try {
        // EL PARCHE LITE: Cambiamos "osu" por términos que obligan a YouTube a traer música oficial
        const query = `${cancion} "official audio" OR "topic"`; 
        
        const response = await youtube.search.list({
            part: 'id',
            q: query,
            maxResults: 1,
            type: 'video'
        });
        const items = response.data.items;
        return items && items.length > 0 ? items[0].id.videoId : null;
    } catch (error) {
        console.error("Error buscando en YouTube:", error.message);
        return null;
    }
}

// Crea una lista de reproducción vacía y PRIVADA en tu canal
async function crearPlaylistOficial() {
    const response = await youtube.playlists.insert({
        part: 'snippet,status',
        resource: {
            snippet: {
                title: 'osu! Sync Playlist',
                description: 'Generado automáticamente por mi herramienta Full-Stack.',
            },
            status: { privacyStatus: 'private' } 
        }
    });
    return response.data.id;
}

// Introduce un video dentro de la playlist usando sus IDs
async function agregarVideoAPlaylist(playlistId, videoId) {
    await youtube.playlistItems.insert({
        part: 'snippet',
        resource: {
            snippet: {
                playlistId: playlistId,
                resourceId: {
                    kind: 'youtube#video',
                    videoId: videoId
                }
            }
        }
    });
}

module.exports = {
    getAuthUrl, guardarToken, cargarToken, 
    buscarVideoYouTube, crearPlaylistOficial, agregarVideoAPlaylist
};