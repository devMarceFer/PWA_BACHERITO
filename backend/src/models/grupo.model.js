export class GrupoModel {
    constructor(dbRow) {
        this.idGrupo = dbRow.ID_GRUPO;
        this.nombre = dbRow.NOMBRE;
        this.bachesReportados = dbRow.BACHES_REPORTADOS;
        this.bachesAtendidos = dbRow.BACHES_ATENDIDOS ?? 0;
        this.fechaCreacion = dbRow.FECHA_CREACION;
        this.tecnicos = [];
    }

    static fromDatabaseArray(rows) {
        return rows.map(row => new GrupoModel(row));
    }

    static validarParaCreacion(data) {
        if (!data.nombre || typeof data.nombre !== 'string' || !data.nombre.trim() || data.nombre.length > 100) {
            return { valido: false, error: 'El nombre del grupo es obligatorio y debe tener máximo 100 caracteres.' };
        }
        if (!Array.isArray(data.tecnicos) || data.tecnicos.length === 0) {
            return { valido: false, error: 'Debes asignar al menos un técnico al grupo.' };
        }
        if (data.tecnicos.some(id => !id || Number.isNaN(Number(id)))) {
            return { valido: false, error: 'La lista de técnicos contiene un identificador inválido.' };
        }
        return { valido: true };
    }
}

export class TecnicoModel {
    constructor(dbRow) {
        this.idUsuario = dbRow.ID_USUARIO;
        this.nombre = dbRow.NOMBRE;
        this.apellido = dbRow.APELLIDO;
        this.numDocumento = dbRow.NUM_DOCUMENTO;
    }

    static fromDatabaseArray(rows) {
        return rows.map(row => new TecnicoModel(row));
    }
}

export class TareaModel {
    constructor(dbRow) {
        this.idTarea = dbRow.ID_TAREA;
        this.idRequerimiento = dbRow.ID_REQUERIMIENTO;
        this.nombres = dbRow.NOMBRES;
        this.parroquiaNombre = dbRow.PAR_NOMBRE;
        this.estado = dbRow.ESTADO;
        this.fechaIngreso = dbRow.FECHA_INGRESO;
        this.fechaAsignacion = dbRow.FECHA_ASIGNACION;
    }

    static fromDatabaseArray(rows) {
        return rows.map(row => new TareaModel(row));
    }
}

// Resumen del Panel de Control del administrador (totales institucionales, no por grupo).
// "En progreso" son los baches ya reasignados a un técnico (ESTADO='R'); ese estado lo pone
// grupoRepository.asignarTarea al momento de asignar el bache a un grupo.
export class ResumenAdminModel {
    constructor(dbRow) {
        this.totalHuecos = Number(dbRow.TOTAL) || 0;
        this.pendientes = Number(dbRow.PENDIENTES) || 0;
        this.enProgreso = Number(dbRow.EN_PROGRESO) || 0;
        this.resueltos = Number(dbRow.RESUELTOS) || 0;
    }
}

// Bache para el mapa de supervisión del administrador: incluye el grupo/técnico(s) asignado
// (null si todavía no se asignó a ningún grupo), pero es de solo lectura.
export class BacheMapaModel {
    constructor(dbRow) {
        this.idRequerimiento = dbRow.ID;
        this.nombres = dbRow.NOMBRES;
        this.coordenadaX = dbRow.COORDENADAX;
        this.coordenadaY = dbRow.COORDENADAY;
        this.parroquiaNombre = dbRow.PAR_NOMBRE;
        this.estado = dbRow.ESTADO;
        this.estadoCrudo = dbRow.ESTADO_CRUDO;
        this.fechaIngreso = dbRow.FECHA_INGRESO;
        this.nombreGrupo = dbRow.NOMBRE_GRUPO || null;
        this.tecnicos = dbRow.TECNICOS || null;
    }

    static fromDatabaseArray(rows) {
        return rows.map(row => new BacheMapaModel(row));
    }
}

export class BacheDisponibleModel {
    constructor(dbRow) {
        this.idRequerimiento = dbRow.ID;
        this.nombres = dbRow.NOMBRES;
        this.parroquiaNombre = dbRow.PAR_NOMBRE;
        this.estado = dbRow.ESTADO;
        this.fechaIngreso = dbRow.FECHA_INGRESO;
    }

    static fromDatabaseArray(rows) {
        return rows.map(row => new BacheDisponibleModel(row));
    }
}

// Parroquia a cargo de un grupo de trabajo.
export class ParroquiaGrupoModel {
    constructor(dbRow) {
        this.parCodigo = dbRow.PAR_CODIGO;
        this.parNombre = dbRow.PAR_NOMBRE;
    }

    static fromDatabaseArray(rows) {
        return rows.map(row => new ParroquiaGrupoModel(row));
    }
}

// Conteo de baches pendientes en una parroquia, para la previsualización de la
// asignación masiva.
export class ConteoParroquiaModel {
    constructor(dbRow) {
        this.parCodigo = dbRow.PAR_CODIGO;
        this.parNombre = dbRow.PAR_NOMBRE;
        this.cantidad = Number(dbRow.CANTIDAD) || 0;
    }

    static fromDatabaseArray(rows) {
        return rows.map(row => new ConteoParroquiaModel(row));
    }
}
