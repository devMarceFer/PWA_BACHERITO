// Agrupa las filas planas de la consulta de catálogo (un renglón por módulo, con las
// columnas del sistema repetidas) en la forma anidada que consume el frontend.
export class SistemaCatalogoModel {
    static fromDatabaseArray(rows) {
        const porSistema = new Map();

        for (const row of rows) {
            if (!porSistema.has(row.ID_SISTEMA)) {
                porSistema.set(row.ID_SISTEMA, {
                    idSistema: row.ID_SISTEMA,
                    nombre: row.SISTEMA,
                    modulos: []
                });
            }
            porSistema.get(row.ID_SISTEMA).modulos.push({
                idModulo: row.ID_MODULO,
                nombre: row.MODULO,
                descripcion: row.DESCRIPCION
            });
        }

        return Array.from(porSistema.values());
    }
}

export class RolModel {
    constructor(dbRow) {
        this.idRol = dbRow.ID_ROL;
        this.nombre = dbRow.NOMBRE;
    }

    static fromDatabaseArray(rows) {
        return rows.map(row => new RolModel(row));
    }
}

export class UsuarioAccesoModel {
    constructor(dbRow) {
        this.idUsuario = dbRow.ID_USUARIO;
        this.nombre = dbRow.NOMBRE;
        this.apellido = dbRow.APELLIDO;
        this.numDocumento = dbRow.NUM_DOCUMENTO;
        this.email = dbRow.EMAIL;
        this.estado = dbRow.ESTADO;
        this.bloqueado = dbRow.BLOQUEADO;
        this.totalAccesosActivos = dbRow.TOTAL_ACCESOS_ACTIVOS;
    }

    static fromDatabaseArray(rows) {
        return rows.map(row => new UsuarioAccesoModel(row));
    }
}

export class AccesoModel {
    constructor(dbRow) {
        this.idUmr = dbRow.ID_UMR;
        this.idSistema = dbRow.ID_SISTEMA;
        this.sistema = dbRow.SISTEMA;
        this.idModulo = dbRow.ID_MODULO;
        this.modulo = dbRow.MODULO;
        this.idRol = dbRow.ID_ROL;
        this.rol = dbRow.ROL;
        this.estado = dbRow.ESTADO;
        this.creadoEn = dbRow.CREADO_EN;
    }

    static fromDatabaseArray(rows) {
        return rows.map(row => new AccesoModel(row));
    }
}
