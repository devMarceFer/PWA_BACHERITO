export class AutorizacionModel {
    constructor(dbRow) {
        this.modulo = dbRow.MODULO;
        this.rol = dbRow.ROL;
    }

    static fromDatabaseArray(rows) {
        return rows.map(row => new AutorizacionModel(row));
    }
}
