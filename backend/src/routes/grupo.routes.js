import { Router } from 'express';
import grupoController from '../controllers/grupo.controller.js';
import { requireAuth, requireModulo } from '../middlewares/auth.middleware.js';

const router = Router();
const soloAsignarGrupo = [requireAuth, requireModulo('ASIGNAR_GRUPO')];

router.get('/grupos', soloAsignarGrupo, grupoController.listar);
router.get('/grupos/resumen', soloAsignarGrupo, grupoController.resumenAdmin);
router.get('/grupos/mapa', soloAsignarGrupo, grupoController.mapaAdmin);
router.get('/grupos/tecnicos', soloAsignarGrupo, grupoController.buscarTecnicos);
router.get('/grupos/parroquias-disponibles', soloAsignarGrupo, grupoController.parroquiasDisponibles);
router.post('/grupos', soloAsignarGrupo, grupoController.crear);
router.get('/grupos/:id', soloAsignarGrupo, grupoController.detalle);
router.get('/grupos/:id/baches-disponibles', soloAsignarGrupo, grupoController.bachesDisponibles);
router.post('/grupos/:id/tareas', soloAsignarGrupo, grupoController.asignarTarea);
router.delete('/grupos/:id/tareas/:idRequerimiento', soloAsignarGrupo, grupoController.quitarTarea);
router.post('/grupos/:id/tecnicos', soloAsignarGrupo, grupoController.agregarTecnico);
router.delete('/grupos/:id/tecnicos/:idUsuario', soloAsignarGrupo, grupoController.quitarTecnico);
router.get('/grupos/:id/parroquias', soloAsignarGrupo, grupoController.parroquiasDeGrupo);
router.post('/grupos/:id/parroquias', soloAsignarGrupo, grupoController.asignarParroquias);
router.delete('/grupos/:id/parroquias/:codigo', soloAsignarGrupo, grupoController.quitarParroquia);
router.get('/grupos/:id/baches-por-parroquia', soloAsignarGrupo, grupoController.previsualizarBachesPorParroquia);
router.post('/grupos/:id/tareas/por-parroquia', soloAsignarGrupo, grupoController.asignarBachesPorParroquia);

export default router;
