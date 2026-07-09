const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Guardamos la base de datos en la raíz, igual que el token de YouTube
const DB_PATH = path.join(__dirname, '../osu_yt_cache.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Error al conectar con SQLite:', err.message);
    }
});

// Inicializa la tabla si no existe e indexa para búsquedas veloces
function inicializarDB() {
    return new Promise((resolve, reject) => {
        db.run(`
            CREATE TABLE IF NOT EXISTS canciones_cacheadas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                artista TEXT NOT NULL,
                titulo TEXT NOT NULL,
                youtube_video_id TEXT NOT NULL,
                creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(artista, titulo)
            )
        `, (err) => {
            if (err) {
                console.error('❌ Error creando tabla de caché:', err.message);
                return reject(err);
            }
            
            // Índice para optimizar el rendimiento
            db.run(`CREATE INDEX IF NOT EXISTS idx_art_tit ON canciones_cacheadas(artista, titulo);`, () => {
                resolve();
            });
        });
    });
}

// Busca en la base de datos
function buscarEnCache(artista, titulo) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT youtube_video_id FROM canciones_cacheadas 
            WHERE LOWER(artista) = ? AND LOWER(titulo) = ?
        `;
        db.get(query, [artista.trim().toLowerCase(), titulo.trim().toLowerCase()], (err, row) => {
            if (err) reject(err);
            else resolve(row ? row.youtube_video_id : null);
        });
    });
}

// Guarda en la base de datos
function guardarEnCache(artista, titulo, videoId) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT OR IGNORE INTO canciones_cacheadas (artista, titulo, youtube_video_id)
            VALUES (?, ?, ?)
        `;
        db.run(query, [artista.trim(), titulo.trim(), videoId], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

module.exports = {
    inicializarDB,
    buscarEnCache,
    guardarEnCache
};