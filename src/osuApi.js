const axios = require('axios');
require('dotenv').config();

async function getOsuToken() {
    try {
        console.log("⏳ Pidiendo permiso (Token) a osu!...");
        const response = await axios.post('https://osu.ppy.sh/oauth/token', {
            client_id: process.env.OSU_CLIENT_ID,
            client_secret: process.env.OSU_CLIENT_SECRET,
            grant_type: 'client_credentials',
            scope: 'public'
        });
        console.log("✅ ¡Conexión con osu! exitosa!");
        return response.data.access_token;
    } catch (error) {
        console.error("❌ Error conectando con osu!:", error.response ? error.response.data : error.message);
        return null;
    }
}

async function getBeatmapsMasJugados(userId, token) {
    try {
        console.log(`⏳ Trayendo los mapas más jugados del usuario ${userId}...`);
        const response = await axios.get(`https://osu.ppy.sh/api/v2/users/${userId}/beatmapsets/most_played`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            params: { limit: 100 } //Ampliamos a 100 para tener más candidatos y filtrar mejor
        });

        // 🛠️ UPGRADE UNICODE: Guardamos la versión normal y la nativa (ruso, japonés, etc.)
        const canciones = response.data.map(item => {
            return {
                artista: item.beatmapset.artist,
                artista_unicode: item.beatmapset.artist_unicode || item.beatmapset.artist,
                titulo: item.beatmapset.title,
                titulo_unicode: item.beatmapset.title_unicode || item.beatmapset.title,
                duracion_segundos: item.beatmap ? item.beatmap.total_length : 0
            };
        });

        return canciones;
    } catch (error) {
        console.error("❌ Error al obtener los beatmaps:", error.response ? error.response.data : error.message);
        return [];
    }
}
// 👤 NUEVA FUNCIÓN 1: Cambia el código que nos da el usuario por su llave privada
async function getOsuUserToken(code) {
    try {
        const response = await axios.post('https://osu.ppy.sh/oauth/token', {
            client_id: process.env.OSU_CLIENT_ID,
            client_secret: process.env.OSU_CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: process.env.OSU_REDIRECT_URI
        });
        return response.data.access_token; // Devuelve la llave personal del usuario
    } catch (error) {
        console.error("Error obteniendo el token de usuario de osu!:", error.response ? error.response.data : error.message);
        throw error;
    }
}

// 👤 NUEVA FUNCIÓN 2: Usa la llave para preguntar "¿Quién soy?" (/me)
async function getOsuUserData(accessToken) {
    try {
        const response = await axios.get('https://osu.ppy.sh/api/v2/me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });
        return response.data; // Devuelve el perfil completo (username, avatar, id, etc.)
    } catch (error) {
        console.error("Error obteniendo los datos del usuario de osu!:", error.response ? error.response.data : error.message);
        throw error;
    }
}

module.exports = { 
    getOsuToken, 
    getBeatmapsMasJugados, 
    getOsuUserToken, 
    getOsuUserData 
};

