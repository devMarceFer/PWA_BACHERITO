import oracledb from 'oracledb';
import 'dotenv/config';


// Forzar a Oracle a entregar objetos en vez de arreglos nativos
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

export async function initializePool() {
    try {
        await oracledb.createPool({
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            connectString: process.env.DB_CONNECTION_STRING,
            poolMin: 2,
            poolMax: 10,
            poolIncrement: 1,
            poolTimeout: 60,
            connectionTimeout: 5,           // Timeout inicial en segundos
            idleConnectionTimeout: 300      // Cerrar conexiones ociosas después de 5min
        });
        console.log('✅ Pool de conexiones de Oracle inicializado con éxito.');
    } catch (err) {
        console.error('❌ Error al inicializar el Pool de Oracle:', err);
        process.exit(1);
    }
}

export async function closePool() {
    try {
        const pool = oracledb.getPool();
        if (pool) {
            await pool.close(0);
            console.log('Pool de Oracle cerrado de manera limpia.');
        }
    } catch (err) {
        console.error('Error al cerrar el pool:', err);
    }
}