const axios = require('axios');
require('dotenv').config();

async function buscarVideoYouTube(terminoBusqueda) {
    try {
        const apiKey = process.env.YOUTUBE_API_KEY;
        
        // Hacemos la petición a la API de búsqueda de YouTube
        const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: {
                part: 'snippet',
                q: terminoBusqueda,
                type: 'video',
                maxResults: 1, // Solo queremos el primer resultado
                key: apiKey
            }
        });

        // Verificamos si encontró algún video
        if (response.data.items && response.data.items.length > 0) {
            const videoId = response.data.items[0].id.videoId;
            const titulo = response.data.items[0].snippet.title;
            
            console.log(`🔍 Buscando: "${terminoBusqueda}" -> Encontrado: "${titulo}"`);
            return videoId;
        } else {
            console.log(`⚠️ No se encontraron videos para: "${terminoBusqueda}"`);
            return null;
        }

    } catch (error) {
        console.error("❌ Error en la API de YouTube:", error.response ? error.response.data : error.message);
        return null;
    }
}

// Exportamos la función para usarla en el archivo principal
module.exports = { buscarVideoYouTube };