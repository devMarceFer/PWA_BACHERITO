import { Router } from 'express';
import accesosController from '../controllers/accesos.controller.js';
import { requireAuth, requireModulo } from '../middlewares/auth.middleware.js';

const router = Router();
const soloGestionarAccesos = [requireAuth, requireModulo('GESTIONAR_ACCESOS')];

// Las rutas literales van ANTES que las de parámetro: si /accesos/usuarios/:id se
// declarara primero, /accesos/catalogo nunca llegaría a su controlador.
router.get('/accesos/catalogo', soloGestionarAccesos, accesosController.catalogo);
router.get('/accesos/usuarios', soloGestionarAccesos, accesosController.buscarUsuarios);
router.get('/accesos/usuarios/:id', soloGestionarAccesos, accesosController.detalleUsuario);
router.post('/accesos/usuarios/:id', soloGestionarAccesos, accesosController.otorgar);
router.delete('/accesos/usuarios/:id/modulos/:idModulo/roles/:idRol', soloGestionarAccesos, accesosController.revocar);

export default router;
