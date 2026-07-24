import { Router } from 'express';
import requerimientoController from '../controllers/requerimiento.controller.js';

const router = Router();
router.get('/requerimientos', requerimientoController.obtenerRequerimientos);
router.patch('/requerimientos/:id', requerimientoController.actualizarEstado);
router.post('/requerimientos', requerimientoController.registrarRequerimiento);

export default router;