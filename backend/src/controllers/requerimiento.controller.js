import requerimientoService from '../services/requerimiento.service.js';

class RequerimientoController {
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