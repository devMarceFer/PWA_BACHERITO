import requerimientoService from '../services/requerimiento.service.js';

class RequerimientoController {
    async obtenerRequerimientos(req, res, next) {
        try {
            const data = await requerimientoService.obtenerTodosActivos();
            return res.status(200).json({ success: true, count: data.length, data });
        } catch (error) {
            next(error);
        }
    }

    async actualizarEstado(req, res, next) {
        try {
            const { id } = req.params;
            const { estado } = req.body;

            await requerimientoService.cambiarEstado(id, estado);
            return res.status(200).json({ success: true, message: 'Estado del requerimiento actualizado.' });
        } catch (error) {
            if (error.message === 'ESTADO_INVALIDO') {
                return res.status(400).json({ success: false, message: 'El estado enviado no es válido.' });
            }
            if (error.message === 'NOT_FOUND') {
                return res.status(404).json({ success: false, message: 'Requerimiento no encontrado.' });
            }
            next(error);
        }
    }

    async registrarRequerimiento(req, res, next) {
        try {
            await requerimientoService.registrarNuevo(req.body);
            return res.status(201).json({ success: true, message: 'Requerimiento de bache registrado correctamente.' });
        } catch (error) {
            if (error.message.startsWith('VALIDACION_FALLIDA')) {
                return res.status(400).json({ success: false, message: error.message });
            }
            next(error);
        }
    }
}

export default new RequerimientoController();