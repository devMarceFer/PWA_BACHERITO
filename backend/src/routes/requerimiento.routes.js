import { Router } from 'express';
import requerimientoController from '../controllers/requerimiento.controller.js';
import { requireAuth, requireModulo } from '../middlewares/auth.middleware.js';

const router = Router();
router.post('/requerimientos', requireAuth, requireModulo('REPORTAR_BACHE'), requerimientoController.registrarRequerimiento);

export default router;