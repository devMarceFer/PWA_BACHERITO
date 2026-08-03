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
import { errorHandler } from './middlewares/error.middleware.js';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3000;

// Cabeceras de seguridad HTTP (CSP, HSTS, X-Frame-Options, etc.)
app.use(helmet());

// 🆕 2. Habilitamos CORS de manera global antes de las rutas
// Esto le dice a Oracle/Node que acepte peticiones de cualquier origen (incluido localhost:4200)
app.use(cors());

// Las fotografías de los reportes viajan como base64 dentro del JSON; el límite por defecto
// de Express (100kb) no alcanza para una sola foto de cámara.
app.use(express.json({ limit: '10mb' }));

// Registro de endpoints
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