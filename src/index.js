require('dotenv').config();
import { getOsuToken, getBeatmapsMasJugados } from './osuApi';
import { buscarVideoYouTube } from './youtubeApi';

// Tu ID de usuario
const OSU_USER_ID = 17206927; 

async function iniciarScript() {
    console.log("🚀 Iniciando Osu-YouTube-Sync...\n");
    
    // 1. Obtenemos acceso a osu!
    const token = await getOsuToken();
    if (!token) return;

    console.log("\n-----------------------------------------");
    
    // 2. Traemos tus canciones
    const misCanciones = await getBeatmapsMasJugados(OSU_USER_ID, token);
    
    if (misCanciones.length === 0) {
        console.log("⚠️ No hay canciones para buscar. Saliendo...");
        return;
    }

    console.log(`\n🎵 ¡Se encontraron ${misCanciones.length} canciones! Empezando la búsqueda en YouTube...\n`);
    
    const idsEncontrados = [];

    // 3. El Bucle Mágico: Buscamos una por una en YouTube
    for (const cancion of misCanciones) {
        const videoId = await buscarVideoYouTube(cancion);
        
        if (videoId) {
            idsEncontrados.push(videoId);
        }
        
        // PAUSA de 1 segundo entre búsquedas para no saturar la API de YouTube
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log("\n-----------------------------------------");
    
    // 4. Generamos el link de la playlist
    if (idsEncontrados.length > 0) {
        console.log(`🎉 ¡Se encontraron ${idsEncontrados.length} videos en YouTube!`);
        
        // Unimos todos los IDs con comas para el formato del link
        const idsUnidos = idsEncontrados.join(',');
        const linkPlaylist = `https://www.youtube.com/watch_videos?video_ids=${idsUnidos}`;
        
        console.log("\n🔗 HAZ CLIC AQUÍ PARA GUARDAR TU PLAYLIST:");
        console.log(linkPlaylist);
        console.log("\n(Nota: Una vez en YouTube, haz clic en el botón de guardar playlist para conservarla).");
    } else {
        console.log("😔 No se pudo encontrar ninguna canción en YouTube.");
    }
}

iniciarScript();