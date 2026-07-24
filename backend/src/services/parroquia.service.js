import parroquiaRepository from '../repositories/parroquia.repository.js';
import { ParroquiaModel } from '../models/parroquia.model.js';

class ParroquiaService {
    async listarParroquiasPorCanton(canCodigo) {
        const codigoBusqueda = canCodigo || '184';
        const rawData = await parroquiaRepository.findByCanton(codigoBusqueda);
        
        // Mapeamos los datos crudos de Oracle hacia la estructura del Modelo estructurado
        return ParroquiaModel.fromDatabaseArray(rawData);
    }
}

export default new ParroquiaService();