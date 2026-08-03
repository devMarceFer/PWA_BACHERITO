import accesosRepository from '../repositories/accesos.repository.js';
import {
    SistemaCatalogoModel,
    RolModel,
    UsuarioAccesoModel,
    AccesoModel
} from '../models/acceso.model.js';

// El módulo que protege esta misma pantalla. Nadie puede revocárselo a sí mismo (D6):
// es la única puerta de entrada, y si el último administrador se lo quita, no hay forma
// de devolvérselo desde la aplicación.
const MODULO_DE_GESTION = 'GESTIONAR_ACCESOS';

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

    async otorgarAccesos(idUsuario, otorgamientos, asignadoPor) {
        if (!Array.isArray(otorgamientos) || otorgamientos.length === 0) {
            throw new Error('VALIDACION_FALLIDA: Selecciona al menos un módulo con su rol.');
        }

        const filasUsuario = await accesosRepository.findUsuarioPorId(idUsuario);
        if (filasUsuario.length === 0) {
            throw new Error('USUARIO_NO_ENCONTRADO');
        }

        // Se valida contra el catálogo activo, que es la misma fuente que ve el administrador
        // en la pantalla: así un módulo dado de baja no puede otorgarse por API.
        const catalogo = await this.obtenerCatalogo();
        const modulosValidos = new Set(
            catalogo.sistemas.flatMap(sistema => sistema.modulos.map(modulo => modulo.idModulo))
        );
        const rolesValidos = new Set(catalogo.roles.map(rol => rol.idRol));

        // Se reconstruye cada par con solo idModulo/idRol: cualquier otro campo que venga en
        // el cuerpo (por ejemplo un ASIGNADO_POR falsificado) se descarta aquí (D9).
        const limpios = otorgamientos.map(({ idModulo, idRol }) => ({
            idModulo: Number(idModulo),
            idRol: Number(idRol)
        }));

        for (const { idModulo, idRol } of limpios) {
            if (!modulosValidos.has(idModulo) || !rolesValidos.has(idRol)) {
                throw new Error('MODULO_O_ROL_INVALIDO');
            }
        }

        return accesosRepository.otorgarAccesos(Number(idUsuario), limpios, asignadoPor);
    }

    async revocarAcceso(idUsuario, idModulo, idRol, idActor) {
        if (Number(idUsuario) === Number(idActor)) {
            const nombreModulo = await accesosRepository.findNombreModulo(Number(idModulo));
            if (nombreModulo === MODULO_DE_GESTION) {
                throw new Error('AUTO_REVOCACION_PROHIBIDA');
            }
        }

        const filasAfectadas = await accesosRepository.revocarAcceso(
            Number(idUsuario), Number(idModulo), Number(idRol)
        );
        if (filasAfectadas === 0) {
            throw new Error('ACCESO_NO_ENCONTRADO');
        }
    }
}

export default new AccesosService();
