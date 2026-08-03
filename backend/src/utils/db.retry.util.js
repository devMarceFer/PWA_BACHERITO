// Ejecuta operaciones de BD con reintentos automáticos en caso de desconexión
export async function executeWithRetry(fn, maxRetries = 3, delayMs = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            // Detectar si es error de conexión Oracle (NJS-500/501)
            const isConnectionError = /NJS-50[01]|connection.*closed|broken|ECONNRESET|network.*error/i.test(
                error.message || error.toString()
            );

            if (!isConnectionError || attempt === maxRetries) {
                throw error;
            }

            const waitTime = delayMs * attempt;
            console.warn(
                `[DB Retry ${attempt}/${maxRetries}] Reintentando en ${waitTime}ms después de: ${error.message}`
            );

            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
}

// Health check simple: verifica si la BD está disponible
export async function isOracleDatabaseHealthy() {
    try {
        const connection = await require('oracledb').getConnection();
        await connection.execute('SELECT 1 FROM DUAL');
        await connection.close();
        return true;
    } catch (error) {
        console.error('[Health Check] Error de conectividad:', error.message);
        return false;
    }
}
