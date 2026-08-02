import autorizacionRepository from '../repositories/autorizacion.repository.js';
import { AutorizacionModel } from '../models/autorizacion.model.js';

const NOMBRE_SISTEMA = process.env.SISTEMA_NOMBRE;

class AutorizacionService {
    async obtenerAutorizaciones(idUsuario) {
        const rawData = await autorizacionRepository.findByUsuarioYSistema(idUsuario, NOMBRE_SISTEMA);
        return AutorizacionModel.fromDatabaseArray(rawData);
    }
}

export default new AutorizacionService();
