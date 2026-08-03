import grupoRepository from '../repositories/grupo.repository.js';
import { GrupoModel, TecnicoModel, TareaModel, BacheDisponibleModel, BacheMapaModel, ResumenAdminModel, ParroquiaGrupoModel, ConteoParroquiaModel } from '../models/grupo.model.js';

// Institución responsable del Bacherito en GADMAPPS.OP_BACHERITO_REQ (columna VARCHAR2).
const INSTITUCION_BACHERITO = '61';

class GrupoService {
    // Totales institucionales para el Panel de Control del administrador.
    async obtenerResumenAdmin() {
        const fila = await grupoRepository.obtenerResumenAdmin(INSTITUCION_BACHERITO);
        return new ResumenAdminModel(fila);
    }

    // Mapa de supervisión del administrador: todos los baches con su grupo/técnico(s), de solo
    // lectura (el administrador no cambia estados desde aquí).
    async obtenerMapaAdmin() {
        const rawData = await grupoRepository.obtenerMapaAdmin(INSTITUCION_BACHERITO);
        return BacheMapaModel.fromDatabaseArray(rawData);
    }

    async listarGrupos() {
        const [gruposRaw, tecnicosRaw] = await Promise.all([
            grupoRepository.findAll(),
            grupoRepository.findTecnicosDeGruposActivos()
        ]);

        const grupos = GrupoModel.fromDatabaseArray(gruposRaw);
        const tecnicosPorGrupo = new Map();

        for (const fila of tecnicosRaw) {
            const lista = tecnicosPorGrupo.get(fila.ID_GRUPO) ?? [];
            lista.push(new TecnicoModel(fila));
            tecnicosPorGrupo.set(fila.ID_GRUPO, lista);
        }

        for (const grupo of grupos) {
            grupo.tecnicos = tecnicosPorGrupo.get(grupo.idGrupo) ?? [];
        }

        return grupos;
    }

    // Cuando no hay candidatos, arma un mensaje explicando por qué (usuario inexistente, inactivo,
    // sin rol de técnico, o ya asignado a otro grupo) en vez de dejar al administrador sin pistas.
    async buscarTecnicos(query) {
        const texto = (query || '').trim();
        if (!texto) return { data: [], mensaje: null };

        const rawData = await grupoRepository.buscarTecnicos(texto);
        if (rawData.length > 0) {
            return { data: TecnicoModel.fromDatabaseArray(rawData), mensaje: null };
        }

        const candidatos = await grupoRepository.diagnosticarTecnico(texto);
        return { data: [], mensaje: this.construirMensajeSinResultados(candidatos) };
    }

    construirMensajeSinResultados(candidatos) {
        if (candidatos.length === 0) {
            return 'No existe ningún usuario con ese nombre o cédula.';
        }

        const razones = candidatos.map(candidato => {
            const nombreCompleto = `${candidato.NOMBRE} ${candidato.APELLIDO}`;
            if (candidato.ESTADO_USUARIO !== 'S') {
                return `${nombreCompleto} está inactivo.`;
            }
            if (!candidato.TIENE_ROL_TECNICO) {
                return `${nombreCompleto} no tiene el rol de técnico asignado.`;
            }
            if (candidato.GRUPO_ACTUAL) {
                return `${nombreCompleto} ya pertenece al grupo "${candidato.GRUPO_ACTUAL}".`;
            }
            return `${nombreCompleto} no cumple los requisitos para ser agregado.`;
        });

        return razones.join(' ');
    }

    async crearGrupo(datos, creadoPor) {
        const validacion = GrupoModel.validarParaCreacion(datos);
        if (!validacion.valido) {
            throw new Error(`VALIDACION_FALLIDA: ${validacion.error}`);
        }

        const idsTecnicos = datos.tecnicos.map(Number);

        // Un técnico solo puede pertenecer a un grupo a la vez.
        for (const idUsuario of idsTecnicos) {
            const grupoActual = await grupoRepository.obtenerGrupoDeTecnico(idUsuario);
            if (grupoActual) {
                throw new Error(`VALIDACION_FALLIDA: ${grupoActual.NOMBRE} ${grupoActual.APELLIDO} ya pertenece al grupo "${grupoActual.NOMBRE_GRUPO}". Un técnico solo puede pertenecer a un grupo a la vez.`);
            }
        }

        return grupoRepository.crear({
            nombre: datos.nombre.trim(),
            creadoPor,
            tecnicos: idsTecnicos
        });
    }

    // Grupo + técnicos + tareas asignadas, para la pantalla de detalle.
    async obtenerDetalleGrupo(idGrupo) {
        const grupos = await grupoRepository.findById(idGrupo);
        if (grupos.length === 0) {
            throw new Error('GRUPO_NO_ENCONTRADO');
        }

        const [tecnicosRaw, tareasRaw] = await Promise.all([
            grupoRepository.findTecnicosPorGrupo(idGrupo),
            grupoRepository.findTareas(idGrupo)
        ]);

        const grupo = new GrupoModel(grupos[0]);
        grupo.tecnicos = TecnicoModel.fromDatabaseArray(tecnicosRaw);
        grupo.tareas = TareaModel.fromDatabaseArray(tareasRaw);
        return grupo;
    }

    // Baches que todavía no están asignados a ningún grupo. parCodigo es opcional:
    // si no viene, trae baches de todas las parroquias (filtro "Todo").
    async listarBachesDisponibles(idGrupo, parCodigo) {
        const grupos = await grupoRepository.findById(idGrupo);
        if (grupos.length === 0) {
            throw new Error('GRUPO_NO_ENCONTRADO');
        }

        const rawData = await grupoRepository.findBachesDisponibles(parCodigo ? Number(parCodigo) : null);
        return BacheDisponibleModel.fromDatabaseArray(rawData);
    }

    async asignarTarea(idGrupo, idRequerimiento, asignadoPor) {
        if (!idRequerimiento || Number.isNaN(Number(idRequerimiento))) {
            throw new Error('VALIDACION_FALLIDA: El bache a asignar no es válido.');
        }

        try {
            await grupoRepository.asignarTarea({
                idGrupo: Number(idGrupo),
                idRequerimiento: Number(idRequerimiento),
                asignadoPor
            });
        } catch (error) {
            if (error.errorNum === 1) {
                throw new Error('BACHE_YA_ASIGNADO');
            }
            throw error;
        }
    }

    async quitarTarea(idGrupo, idRequerimiento) {
        const filasAfectadas = await grupoRepository.quitarTarea(Number(idGrupo), Number(idRequerimiento));
        if (filasAfectadas === 0) {
            throw new Error('TAREA_NO_ENCONTRADA');
        }
    }

    // Agregar un técnico a un grupo ya creado. No hace falta reasignar las tareas del grupo: se
    // relacionan por ID_GRUPO, así que el técnico nuevo las ve automáticamente.
    async agregarTecnico(idGrupo, idUsuario) {
        const id = Number(idGrupo);
        const usuario = Number(idUsuario);
        if (!id || !usuario || Number.isNaN(usuario)) {
            throw new Error('VALIDACION_FALLIDA: El técnico a agregar no es válido.');
        }

        // Un técnico solo puede pertenecer a un grupo a la vez.
        const grupoActual = await grupoRepository.obtenerGrupoDeTecnico(usuario);
        if (grupoActual && grupoActual.ID_GRUPO !== id) {
            throw new Error(`TECNICO_EN_OTRO_GRUPO: ${grupoActual.NOMBRE} ${grupoActual.APELLIDO} ya pertenece al grupo "${grupoActual.NOMBRE_GRUPO}". Un técnico solo puede pertenecer a un grupo a la vez.`);
        }

        try {
            await grupoRepository.agregarTecnico(id, usuario);
        } catch (error) {
            if (error.errorNum === 1) {
                throw new Error('TECNICO_YA_EN_GRUPO');
            }
            throw error;
        }
    }

    // No se permite dejar un grupo sin ningún técnico (las tareas quedarían sin nadie que las vea).
    async quitarTecnico(idGrupo, idUsuario) {
        const id = Number(idGrupo);
        const usuario = Number(idUsuario);

        const totalTecnicos = await grupoRepository.contarTecnicos(id);
        if (totalTecnicos <= 1) {
            throw new Error('VALIDACION_FALLIDA: El grupo debe tener al menos un técnico. Agrega otro antes de quitar este.');
        }

        const filasAfectadas = await grupoRepository.quitarTecnico(id, usuario);
        if (filasAfectadas === 0) {
            throw new Error('TECNICO_NO_ENCONTRADO');
        }
    }

    async obtenerParroquiasDeGrupo(idGrupo) {
        const filas = await grupoRepository.findParroquiasDeGrupo(idGrupo);
        return ParroquiaGrupoModel.fromDatabaseArray(filas);
    }

    async obtenerParroquiasDisponibles() {
        const filas = await grupoRepository.findParroquiasDisponibles();
        return ParroquiaGrupoModel.fromDatabaseArray(filas);
    }

    // Agrega parroquias al grupo (no reemplaza las que ya tenía).
    // ORA-00001 = violación de UNIQUE(PAR_CODIGO): la parroquia ya es de otro grupo.
    async asignarParroquias(idGrupo, parroquias, asignadoPor) {
        if (!Array.isArray(parroquias) || parroquias.length === 0) {
            throw new Error('VALIDACION_FALLIDA: Debes seleccionar al menos una parroquia.');
        }
        if (parroquias.some(codigo => !codigo || Number.isNaN(Number(codigo)))) {
            throw new Error('VALIDACION_FALLIDA: La lista de parroquias contiene un código inválido.');
        }

        try {
            await grupoRepository.asignarParroquias(idGrupo, parroquias.map(Number), asignadoPor);
        } catch (error) {
            if (error.errorNum === 1) {
                throw new Error('PARROQUIA_YA_ASIGNADA');
            }
            throw error;
        }
    }

    // Quitar una parroquia solo cambia el territorio del grupo. Los baches que ya se le
    // asignaron se quedan con él (decisión D2): puede haber un técnico con el trabajo en curso.
    async quitarParroquia(idGrupo, parCodigo) {
        const filasBorradas = await grupoRepository.quitarParroquia(idGrupo, parCodigo);
        if (filasBorradas === 0) {
            throw new Error('PARROQUIA_NO_ENCONTRADA');
        }
    }
}

export default new GrupoService();
