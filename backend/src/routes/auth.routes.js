import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import authController from '../controllers/auth.controller.js';

// Límite estricto para frenar fuerza bruta / abuso sobre los endpoints de autenticación
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 20,                  // 20 intentos por IP en la ventana
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Demasiados intentos. Intenta de nuevo más tarde.' }
});

const router = Router();
router.post('/auth/registro-cognito', authLimiter, authController.registrarCognito);
router.post('/auth/login', authLimiter, authController.login);
router.post('/auth/logout', authController.logout);

export default router;
