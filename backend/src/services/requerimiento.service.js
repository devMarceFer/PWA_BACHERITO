import requerimientoRepository from '../repositories/requerimiento.repository.js';
import { RequerimientoModel } from '../models/requerimiento.model.js';

class RequerimientoService {
    async registrarNuevo(body) {
        // Validación delegada al modelo
        const validacion = RequerimientoModel.validarParaInsercion(body);
        if (!validacion.valido) {
            throw new Error(`VALIDACION_FALLIDA: ${validacion.error}`);
        }

        const insertado = await requerimientoRepository.save(body);
        if (!insertado) throw new Error('INSERT_FAILED');
        
        return true;
    }
}

export default new RequerimientoService();