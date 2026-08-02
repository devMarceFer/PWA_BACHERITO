import { Router } from 'express';
import mistareaController from '../controllers/mistarea.controller.js';
import { requireAuth, requireModulo } from '../middlewares/auth.middleware.js';

const router = Router();
const soloMisTareas = [requireAuth, requireModulo('MIS_TAREAS')];

router.get('/mis-tareas', soloMisTareas, mistareaController.listar);
router.post('/mis-tareas/marcar-descargado', soloMisTareas, mistareaController.marcarDescargado);
router.patch('/mis-tareas/:id/atender', soloMisTareas, mistareaController.atender);

export default router;
