import { Router } from 'express';
import accesosController from '../controllers/accesos.controller.js';
import { requireAuth, requireModulo } from '../middlewares/auth.middleware.js';

const router = Router();
const soloGestionarAccesos = [requireAuth, requireModulo('GESTIONAR_ACCESOS')];

// Orden: rutas literales antes de parametrizadas (convención, para legibilidad).
router.get('/accesos/catalogo', soloGestionarAccesos, accesosController.catalogo);
router.get('/accesos/usuarios', soloGestionarAccesos, accesosController.buscarUsuarios);
router.get('/accesos/usuarios/:id', soloGestionarAccesos, accesosController.detalleUsuario);
router.post('/accesos/usuarios/:id', soloGestionarAccesos, accesosController.otorgar);
router.delete('/accesos/usuarios/:id/modulos/:idModulo/roles/:idRol', soloGestionarAccesos, accesosController.revocar);

export default router;
