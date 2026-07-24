import parroquiaService from '../services/parroquia.service.js';

class ParroquiaController {
    async getParroquias(req, res, next) {
        try {
            const { canton } = req.query;
            const data = await parroquiaService.listarParroquiasPorCanton(canton);
            
            return res.status(200).json({ success: true, count: data.length, data });
        } catch (error) {
            next(error); // Delega el control al Middleware de errores global
        }
    }
}

export default new ParroquiaController();