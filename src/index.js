// Importamos la herramienta para leer el archivo .env
require('dotenv').config();

console.log("¡Hola mundo! El script de osu! a Spotify está vivo 🎵");
console.log("El ID de cliente de osu! será:", process.env.OSU_CLIENT_ID || "Aún no configurado");
console.log("El secreto de cliente de osu! será:", process.env.OSU_CLIENT_SECRET || "Aún no configurado");