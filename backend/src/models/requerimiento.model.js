export class RequerimientoModel {
    // Validador estático para la inserción de datos (Regla de negocio/entidad).
    // X/Y (UTM) los calcula el backend a partir de coordenadaX/coordenadaY, no vienen del cliente.
    static validarParaInsercion(data) {
        const { nombres, coordenadaX, coordenadaY, parroquia } = data;
        if (!nombres || !coordenadaX || !coordenadaY || !parroquia) {
            return { valido: false, error: 'Faltan campos obligatorios en el modelo de Requerimiento.' };
        }
        return { valido: true };
    }
}