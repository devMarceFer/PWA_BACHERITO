import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import { initializePool, closePool } from './config/database.js';
import cors from 'cors';
import parroquiaRoutes from './routes/parroquia.routes.js';
import requerimientoRoutes from './routes/requerimiento.routes.js';
import authRoutes from './routes/auth.routes.js';
import funcionarioRoutes from './routes/funcionario.routes.js';
import grupoRoutes from './routes/grupo.routes.js';
import mistareaRoutes from './routes/mistarea.routes.js';
import accesosRoutes from './routes/accesos.routes.js';
import healthRoutes from './routes/health.routes.js';
import { errorHandler } from './middlewares/error.middleware.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Cabeceras de seguridad HTTP (CSP, HSTS, X-Frame-Options, etc.)
app.use(helmet());

// CORS configurado con whitelist de orígenes permitidos
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:4200').split(',');
app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 3600,
    optionsSuccessStatus: 200
}));

// Las fotografías de los reportes viajan como base64 dentro del JSON; el límite por defecto
// de Express (100kb) no alcanza para una sola foto de cámara.
app.use(express.json({ limit: '10mb' }));

// Registro de endpoints
app.use(healthRoutes);  // Health check disponible en /health (sin prefijo /api)
app.use('/api', parroquiaRoutes);
app.use('/api', requerimientoRoutes);
app.use('/api', authRoutes);
app.use('/api', funcionarioRoutes);
app.use('/api', grupoRoutes);
app.use('/api', mistareaRoutes);
app.use('/api', accesosRoutes);

// El Middleware de errores SIEMPRE debe ir después de definir todas las rutas
app.use(errorHandler);

async function startServer() {
    await initializePool();

    const server = app.listen(PORT, () => {
        console.log(`🚀 Arquitectura de 7 capas corriendo en http://localhost:${PORT}`);
    });

    const shutdown = async () => {
        console.log('\nCerrando de forma segura...');
        server.close(async () => {
            await closePool();
            process.exit(0);
        });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

startServer();