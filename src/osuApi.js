const axios = require('axios');
require('dotenv').config();

async function getOsuToken() {
    try {
        console.log("⏳ Pidiendo permiso (Token) a osu!...");
        
        // Hacemos una petición POST a osu! pasándole tus llaves
        const response = await axios.post('https://osu.ppy.sh/oauth/token', {
            client_id: process.env.OSU_CLIENT_ID,
            client_secret: process.env.OSU_CLIENT_SECRET,
            grant_type: 'client_credentials',
            scope: 'public'
        });

        console.log("✅ ¡Conexión con osu! exitosa!");
        
        // Devolvemos el token de acceso que nos dio el servidor
        return response.data.access_token;

    } catch (error) {
        console.error("❌ Error conectando con osu!:", error.response ? error.response.data : error.message);
        return null;
    }
}

async function getBeatmapsMasJugados(userId, token) {
    try {
        console.log(`⏳ Trayendo los mapas más jugados del usuario ${userId}...`);
        
        // Hacemos la consulta a la API v2 de osu! para ver tus mapas más jugados
        const response = await axios.get(`https://osu.ppy.sh/api/v2/users/${userId}/beatmapsets/most_played`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            params: {
                limit: 10 // Por ahora traeremos los 10 primeros para probar
            }
        });

        // Mapeamos los resultados para quedarnos solo con "Artista - Título"
        const canciones = response.data.map(item => {
            const artist = item.beatmapset.artist;
            const title = item.beatmapset.title;
            return `${artist} - ${title}`;
        });

        return canciones;

    } catch (error) {
        console.error("❌ Error al obtener los beatmaps:", error.response ? error.response.data : error.message);
        return [];
    }
}
// Exportamos la función para que index.js pueda usarla
module.exports = { getOsuToken, getBeatmapsMasJugados };