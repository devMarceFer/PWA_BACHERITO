import accesosService from '../services/accesos.service.js';

// El middleware global de errores siempre responde 500 e ignora statusCode, así que cada
// caso de negocio se traduce a su código HTTP acá, antes de delegar en next(error).
class AccesosController {
    async catalogo(req, res, next) {
        try {
            const data = await accesosService.obtenerCatalogo();
            return res.status(200).json({ success: true, data });
        } catch (error) {
            next(error);
        }
    }

    async buscarUsuarios(req, res, next) {
        try {
            const data = await accesosService.buscarUsuarios(req.query.q);
            return res.status(200).json({ success: true, count: data.length, data });
        } catch (error) {
            if (error.message.startsWith('VALIDACION_FALLIDA')) {
                return res.status(400).json({ success: false, message: error.message.replace('VALIDACION_FALLIDA: ', '') });
            }
            next(error);
        }
    }

    async detalleUsuario(req, res, next) {
        try {
            const data = await accesosService.obtenerDetalleUsuario(req.params.id);
            return res.status(200).json({ success: true, data });
        } catch (error) {
            if (error.message === 'USUARIO_NO_ENCONTRADO') {
                return res.status(404).json({ success: false, message: 'No se encontró el usuario.' });
            }
            next(error);
        }
    }

    async otorgar(req, res, next) {
        try {
            // ASIGNADO_POR sale del token, nunca del cuerpo (D9).
            const data = await accesosService.otorgarAccesos(
                req.params.id, req.body.otorgamientos, req.usuario.sub
            );
            return res.status(201).json({
                success: true,
                message: `Se otorgaron ${data.otorgados} accesos nuevos y se reactivaron ${data.reactivados}.`,
                data
            });
        } catch (error) {
            if (error.message.startsWith('VALIDACION_FALLIDA')) {
                return res.status(400).json({ success: false, message: error.message.replace('VALIDACION_FALLIDA: ', '') });
            }
            if (error.message === 'USUARIO_NO_ENCONTRADO') {
                return res.status(404).json({ success: false, message: 'No se encontró el usuario.' });
            }
            if (error.message === 'MODULO_O_ROL_INVALIDO') {
                return res.status(400).json({ success: false, message: 'Alguno de los módulos o roles seleccionados no existe o está inactivo.' });
            }
            next(error);
        }
    }

    async revocar(req, res, next) {
        try {
            await accesosService.revocarAcceso(
                req.params.id, req.params.idModulo, req.params.idRol, req.usuario.sub
            );
            return res.status(200).json({ success: true, message: 'Acceso revocado.' });
        } catch (error) {
            if (error.message === 'AUTO_REVOCACION_PROHIBIDA') {
                return res.status(409).json({
                    success: false,
                    message: 'No puedes quitarte a ti mismo el acceso a la gestión de accesos: quedarías sin forma de recuperarlo.'
                });
            }
            if (error.message === 'ACCESO_NO_ENCONTRADO') {
                return res.status(404).json({ success: false, message: 'Ese acceso no existe o ya estaba revocado.' });
            }
            next(error);
        }
    }
}

export default new AccesosController();
