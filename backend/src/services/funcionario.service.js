import funcionarioRepository from '../repositories/funcionario.repository.js';
import { FuncionarioModel } from '../models/funcionario.model.js';

class FuncionarioService {
    async buscarPorCedula(cedula) {
        if (!FuncionarioModel.cedulaValida(cedula)) {
            throw new Error('CEDULA_INVALIDA');
        }

        const rawData = await funcionarioRepository.findByCedula(cedula);
        if (rawData.length === 0) {
            throw new Error('FUNCIONARIO_NO_ENCONTRADO');
        }

        return FuncionarioModel.fromDatabaseArray(rawData)[0];
    }
}

export default new FuncionarioService();
