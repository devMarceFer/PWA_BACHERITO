import grupoService from '../services/grupo.service.js';

class GrupoController {
    async resumenAdmin(req, res, next) {
        try {
            const data = await grupoService.obtenerResumenAdmin();
            return res.status(200).json({ success: true, data });
        } catch (error) {
            next(error);
        }
    }

    async mapaAdmin(req, res, next) {
        try {
            const data = await grupoService.obtenerMapaAdmin();
            return res.status(200).json({ success: true, data });
        } catch (error) {
            next(error);
        }
    }

    async listar(req, res, next) {
        try {
            const data = await grupoService.listarGrupos();
            return res.status(200).json({ success: true, count: data.length, data });
        } catch (error) {
            next(error);
        }
    }

    async buscarTecnicos(req, res, next) {
        try {
            const { q } = req.query;
            const { data, mensaje } = await grupoService.buscarTecnicos(q);
            return res.status(200).json({ success: true, data, mensaje });
        } catch (error) {
            next(error);
        }
    }

    async crear(req, res, next) {
        try {
            const idGrupo = await grupoService.crearGrupo(req.body, req.usuario.sub);
            return res.status(201).json({ success: true, message: 'Grupo creado correctamente.', data: { idGrupo } });
        } catch (error) {
            if (error.message.startsWith('VALIDACION_FALLIDA')) {
                return res.status(400).json({ success: false, message: error.message.replace('VALIDACION_FALLIDA: ', '') });
            }
            next(error);
        }
    }

    async detalle(req, res, next) {
        try {
            const data = await grupoService.obtenerDetalleGrupo(req.params.id);
            return res.status(200).json({ success: true, data });
        } catch (error) {
            if (error.message === 'GRUPO_NO_ENCONTRADO') {
                return res.status(404).json({ success: false, message: 'No se encontró el grupo.' });
            }
            next(error);
        }
    }

    async bachesDisponibles(req, res, next) {
        try {
            const data = await grupoService.listarBachesDisponibles(req.params.id, req.query.parCodigo);
            return res.status(200).json({ success: true, data });
        } catch (error) {
            if (error.message === 'GRUPO_NO_ENCONTRADO') {
                return res.status(404).json({ success: false, message: 'No se encontró el grupo.' });
            }
            next(error);
        }
    }

    async asignarTarea(req, res, next) {
        try {
            await grupoService.asignarTarea(req.params.id, req.body.idRequerimiento, req.usuario.sub);
            return res.status(201).json({ success: true, message: 'Bache asignado al grupo.' });
        } catch (error) {
            if (error.message.startsWith('VALIDACION_FALLIDA')) {
                return res.status(400).json({ success: false, message: error.message.replace('VALIDACION_FALLIDA: ', '') });
            }
            if (error.message === 'BACHE_YA_ASIGNADO') {
                return res.status(409).json({ success: false, message: 'Ese bache ya está asignado a otro grupo.' });
            }
            next(error);
        }
    }

    async quitarTarea(req, res, next) {
        try {
            await grupoService.quitarTarea(req.params.id, req.params.idRequerimiento);
            return res.status(200).json({ success: true, message: 'Tarea removida del grupo.' });
        } catch (error) {
            if (error.message === 'TAREA_NO_ENCONTRADA') {
                return res.status(404).json({ success: false, message: 'Esa tarea no existe en este grupo.' });
            }
            next(error);
        }
    }

    async agregarTecnico(req, res, next) {
        try {
            await grupoService.agregarTecnico(req.params.id, req.body.idUsuario);
            return res.status(201).json({ success: true, message: 'Técnico agregado al grupo.' });
        } catch (error) {
            if (error.message.startsWith('VALIDACION_FALLIDA')) {
                return res.status(400).json({ success: false, message: error.message.replace('VALIDACION_FALLIDA: ', '') });
            }
            if (error.message === 'TECNICO_YA_EN_GRUPO') {
                return res.status(409).json({ success: false, message: 'Ese técnico ya pertenece a este grupo.' });
            }
            if (error.message.startsWith('TECNICO_EN_OTRO_GRUPO')) {
                return res.status(409).json({ success: false, message: error.message.replace('TECNICO_EN_OTRO_GRUPO: ', '') });
            }
            next(error);
        }
    }

    async quitarTecnico(req, res, next) {
        try {
            await grupoService.quitarTecnico(req.params.id, req.params.idUsuario);
            return res.status(200).json({ success: true, message: 'Técnico quitado del grupo.' });
        } catch (error) {
            if (error.message.startsWith('VALIDACION_FALLIDA')) {
                return res.status(400).json({ success: false, message: error.message.replace('VALIDACION_FALLIDA: ', '') });
            }
            if (error.message === 'TECNICO_NO_ENCONTRADO') {
                return res.status(404).json({ success: false, message: 'Ese técnico no pertenece a este grupo.' });
            }
            next(error);
        }
    }

    async parroquiasDeGrupo(req, res, next) {
        try {
            const data = await grupoService.obtenerParroquiasDeGrupo(req.params.id);
            return res.status(200).json({ success: true, data });
        } catch (error) {
            next(error);
        }
    }

    async parroquiasDisponibles(req, res, next) {
        try {
            const data = await grupoService.obtenerParroquiasDisponibles();
            return res.status(200).json({ success: true, data });
        } catch (error) {
            next(error);
        }
    }

    async asignarParroquias(req, res, next) {
        try {
            await grupoService.asignarParroquias(req.params.id, req.body.parroquias, req.usuario.sub);
            return res.status(201).json({ success: true, message: 'Parroquias asignadas al grupo.' });
        } catch (error) {
            if (error.message.startsWith('VALIDACION_FALLIDA')) {
                return res.status(400).json({ success: false, message: error.message.replace('VALIDACION_FALLIDA: ', '') });
            }
            if (error.message === 'PARROQUIA_YA_ASIGNADA') {
                return res.status(409).json({ success: false, message: 'Alguna de esas parroquias ya está a cargo de otro grupo.' });
            }
            next(error);
        }
    }

    async quitarParroquia(req, res, next) {
        try {
            await grupoService.quitarParroquia(req.params.id, req.params.codigo);
            return res.status(200).json({ success: true, message: 'Parroquia removida del grupo.' });
        } catch (error) {
            if (error.message === 'PARROQUIA_NO_ENCONTRADA') {
                return res.status(404).json({ success: false, message: 'Esa parroquia no está asignada a este grupo.' });
            }
            next(error);
        }
    }

    async previsualizarBachesPorParroquia(req, res, next) {
        try {
            const data = await grupoService.previsualizarBachesPorParroquia(req.params.id);
            return res.status(200).json({ success: true, data });
        } catch (error) {
            next(error);
        }
    }

    async asignarBachesPorParroquia(req, res, next) {
        try {
            const data = await grupoService.asignarBachesPorParroquia(req.params.id, req.usuario.sub);
            return res.status(201).json({ success: true, message: `Se asignaron ${data.asignados} baches al grupo.`, data });
        } catch (error) {
            next(error);
        }
    }
}

export default new GrupoController();
