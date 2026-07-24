import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import funcionarioController from '../controllers/funcionario.controller.js';

// Expone datos personales de funcionarios (correo, nombres, celular) a partir de una cédula
// adivinable; se limita agresivamente para dificultar el barrido/enumeración sin autenticación.
const busquedaLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Demasiadas búsquedas. Intenta de nuevo más tarde.' }
});

const router = Router();
router.get('/funcionarios/buscar', busquedaLimiter, funcionarioController.buscarPorCedula);
export default router;
