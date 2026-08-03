import { Router } from 'express';
import { isOracleDatabaseHealthy } from '../utils/db.retry.util.js';

const router = Router();

// Health check: verifica si el servicio está activo y la BD está disponible
router.get('/health', async (req, res) => {
    try {
        const databaseHealthy = await isOracleDatabaseHealthy();

        if (!databaseHealthy) {
            return res.status(503).json({
                status: 'degraded',
                timestamp: new Date().toISOString(),
                checks: {
                    database: 'disconnected'
                },
                message: 'El servicio está activo pero la conexión con Oracle DB está interrumpida.'
            });
        }

        return res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            checks: {
                database: 'connected',
                api: 'operational'
            }
        });
    } catch (error) {
        return res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'Error durante el health check',
            message: error.message
        });
    }
});

export default router;
