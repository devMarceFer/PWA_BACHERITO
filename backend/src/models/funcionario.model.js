export class FuncionarioModel {
    constructor(dbRow) {
        this.correo = dbRow.CORREO;
        this.nombres = dbRow.NOMBRES;
        this.apellidos = dbRow.APELLIDOS;
        this.celular1 = dbRow.CELULAR1;
    }

    static fromDatabaseArray(rows) {
        return rows.map(row => new FuncionarioModel(row));
    }

    // La vista solo indexa por cédula ecuatoriana (10 dígitos); RUC/Pasaporte no aplican a esta búsqueda.
    static cedulaValida(cedula) {
        return typeof cedula === 'string' && /^\d{10}$/.test(cedula);
    }
}
