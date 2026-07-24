export class UsuarioModel {
    constructor(dbRow) {
        this.idUsuario = dbRow.ID_USUARIO;
        this.tipoUsuario = dbRow.TIPO_USUARIO;
        this.tipoDocumento = dbRow.TIPO_DOCUMENTO;
        this.numDocumento = dbRow.NUM_DOCUMENTO;
        this.email = dbRow.EMAIL;
        this.nombre = dbRow.NOMBRE;
        this.apellido = dbRow.APELLIDO;
        this.activeDirectory = dbRow.ACTIVEDIRECTORY;
        this.bloqueado = dbRow.BLOQUEADO;
        this.estado = dbRow.ESTADO;
    }

    static fromDatabaseArray(rows) {
        return rows.map(row => new UsuarioModel(row));
    }

    // Validador estático para el registro post-verificación de Cognito (Regla de negocio/entidad)
    static validarParaRegistro(data) {
        const correoValido = typeof data.correo === 'string'
            && data.correo.length <= 100
            && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.correo);
        if (!correoValido) {
            return { valido: false, error: 'El correo electrónico no es válido o supera los 100 caracteres.' };
        }
        if (!data.nombre || typeof data.nombre !== 'string' || !data.nombre.trim() || data.nombre.length > 100) {
            return { valido: false, error: 'El nombre es obligatorio y debe tener máximo 100 caracteres.' };
        }
        if (!data.apellido || typeof data.apellido !== 'string' || !data.apellido.trim() || data.apellido.length > 100) {
            return { valido: false, error: 'El apellido es obligatorio y debe tener máximo 100 caracteres.' };
        }
        return { valido: true };
    }
}
