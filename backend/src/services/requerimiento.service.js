import requerimientoRepository from '../repositories/requerimiento.repository.js';
import { RequerimientoModel } from '../models/requerimiento.model.js';

class RequerimientoService {
    async obtenerTodosActivos() {
        const rawData = await requerimientoRepository.findActivos();
        return RequerimientoModel.fromDatabaseArray(rawData);
    }

    async cambiarEstado(id, estado) {
        const estadosPermitidos = ['I', 'E', 'R', 'A'];
        const estadoFormateado = estado ? estado.toUpperCase() : '';

        if (!estadosPermitidos.includes(estadoFormateado)) {
            throw new Error('ESTADO_INVALIDO');
        }

        const filasAfectadas = await requerimientoRepository.updateEstado(id, estadoFormateado);
        if (filasAfectadas === 0) throw new Error('NOT_FOUND');
        
        return true;
    }

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