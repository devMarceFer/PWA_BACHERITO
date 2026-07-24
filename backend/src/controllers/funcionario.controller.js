import funcionarioService from '../services/funcionario.service.js';

class FuncionarioController {
    async buscarPorCedula(req, res, next) {
        try {
            const cedula = (req.query.cedula || '').trim();
            const funcionario = await funcionarioService.buscarPorCedula(cedula);
            return res.status(200).json({ success: true, data: funcionario });
        } catch (error) {
            if (error.message === 'CEDULA_INVALIDA') {
                return res.status(400).json({ success: false, message: 'La cédula debe tener 10 dígitos numéricos.' });
            }
            if (error.message === 'FUNCIONARIO_NO_ENCONTRADO') {
                return res.status(404).json({ success: false, message: 'No se encontró ningún funcionario con esa cédula.' });
            }
            next(error);
        }
    }
}

export default new FuncionarioController();
