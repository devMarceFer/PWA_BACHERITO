import mistareaService from '../services/mistarea.service.js';

class MiTareaController {
    async listar(req, res, next) {
        try {
            const data = await mistareaService.obtenerMisTareas(req.usuario.sub);
            return res.status(200).json({ success: true, ...data });
        } catch (error) {
            next(error);
        }
    }

    async marcarDescargado(req, res, next) {
        try {
            await mistareaService.marcarDescargado(req.usuario.sub);
            return res.status(200).json({ success: true, message: 'Tareas marcadas como descargadas.' });
        } catch (error) {
            next(error);
        }
    }

    async atender(req, res, next) {
        try {
            await mistareaService.marcarAtendido(req.params.id, req.usuario.sub, req.body.estado);
            return res.status(200).json({ success: true, message: 'Estado del bache actualizado.' });
        } catch (error) {
            if (error.message.startsWith('VALIDACION_FALLIDA')) {
                return res.status(400).json({ success: false, message: error.message.replace('VALIDACION_FALLIDA: ', '') });
            }
            if (error.message === 'NO_AUTORIZADO') {
                return res.status(403).json({ success: false, message: 'Ese bache no está asignado a ninguno de tus grupos.' });
            }
            next(error);
        }
    }
}

export default new MiTareaController();
