import accesosRepository from '../repositories/accesos.repository.js';
import {
    SistemaCatalogoModel,
    RolModel,
    UsuarioAccesoModel,
    AccesoModel
} from '../models/acceso.model.js';

class AccesosService {
    async obtenerCatalogo() {
        const [filasModulos, filasRoles] = await Promise.all([
            accesosRepository.findSistemasConModulos(),
            accesosRepository.findRoles()
        ]);

        return {
            sistemas: SistemaCatalogoModel.fromDatabaseArray(filasModulos),
            roles: RolModel.fromDatabaseArray(filasRoles)
        };
    }

    async buscarUsuarios(q) {
        if (!q || typeof q !== 'string' || !q.trim()) {
            throw new Error('VALIDACION_FALLIDA: Escribe una cédula, nombre o correo para buscar.');
        }
        const filas = await accesosRepository.buscarUsuarios(q.trim());
        return UsuarioAccesoModel.fromDatabaseArray(filas);
    }

    async obtenerDetalleUsuario(idUsuario) {
        const filasUsuario = await accesosRepository.findUsuarioPorId(idUsuario);
        if (filasUsuario.length === 0) {
            throw new Error('USUARIO_NO_ENCONTRADO');
        }

        const filasAccesos = await accesosRepository.findAccesosDeUsuario(idUsuario);

        return {
            usuario: UsuarioAccesoModel.fromDatabaseArray(filasUsuario)[0],
            accesos: AccesoModel.fromDatabaseArray(filasAccesos)
        };
    }
}

export default new AccesosService();
