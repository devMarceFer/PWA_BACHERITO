export class RequerimientoModel {
    constructor(dbRow) {
        this.id = dbRow.ID; // El autoincremental de Oracle
        this.nombres = dbRow.NOMBRES;
        this.coordenadaX = dbRow.COORDENADAX;
        this.coordenadaY = dbRow.COORDENADAY;
        this.parroquiaNombre = dbRow.PAR_NOMBRE || null;
        this.telefono = dbRow.TELEFONO;
        this.cuadrillaResponsable = dbRow.CUADRILLA_RESPONSABLE || null;
        this.estado = dbRow.ESTADO;
        this.ruralUrbana = dbRow.RURAL_URBANA;
        this.fechaIngreso = dbRow.FECHA_INGRESO;
        this.fechaAtencion = dbRow.FECHA_ATENCION || null;
        this.x = dbRow.X;
        this.y = dbRow.Y;
    }

    static fromDatabaseArray(rows) {
        return rows.map(row => new RequerimientoModel(row));
    }

    // Validador estático para la inserción de datos (Regla de negocio/entidad)
    static validarParaInsercion(data) {
        const { nombres, coordenadaX, coordenadaY, parroquia, ruralUrbana, x, y } = data;
        if (!nombres || !coordenadaX || !coordenadaY || !parroquia || !ruralUrbana || !x || !y) {
            return { valido: false, error: 'Faltan campos obligatorios en el modelo de Requerimiento.' };
        }
        return { valido: true };
    }
}