export class TareaTecnicoModel {
    constructor(dbRow) {
        this.idRequerimiento = dbRow.ID_REQUERIMIENTO;
        this.nombres = dbRow.NOMBRES;
        this.coordenadaX = dbRow.COORDENADAX;
        this.coordenadaY = dbRow.COORDENADAY;
        this.parroquiaNombre = dbRow.PAR_NOMBRE;
        this.estado = dbRow.ESTADO;
        this.estadoCrudo = dbRow.ESTADO_CRUDO;
        this.fechaIngreso = dbRow.FECHA_INGRESO;
        this.idGrupo = dbRow.ID_GRUPO;
        this.nombreGrupo = dbRow.NOMBRE_GRUPO;
    }

    static fromDatabaseArray(rows) {
        return rows.map(row => new TareaTecnicoModel(row));
    }
}
