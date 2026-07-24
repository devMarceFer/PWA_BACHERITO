export class ParroquiaModel {
    constructor(dbRow) {
        this.nombre = dbRow.PAR_NOMBRE;
        this.codigo = dbRow.PAR_CODIGO;
    }

    static fromDatabaseArray(rows) {
        return rows.map(row => new ParroquiaModel(row));
    }
}