export class RequerimientoModel {
    // Validador estático para la inserción de datos (Regla de negocio/entidad).
    // X/Y (UTM) los calcula el backend a partir de coordenadaX/coordenadaY, no vienen del cliente.
    static validarParaInsercion(data) {
        const { nombres, coordenadaX, coordenadaY, parroquia, foto } = data;

        // Nombres: validar tipo, presencia y longitud
        if (!nombres || typeof nombres !== 'string') {
            return { valido: false, error: 'El campo "nombres" es obligatorio y debe ser texto.' };
        }
        const nombresTrimmed = nombres.trim();
        if (nombresTrimmed.length < 1 || nombresTrimmed.length > 200) {
            return { valido: false, error: 'El campo "nombres" debe tener entre 1 y 200 caracteres.' };
        }

        // Coordenadas: validar que sean números en rango válido
        const x = Number(coordenadaX);
        const y = Number(coordenadaY);
        if (isNaN(x) || isNaN(y)) {
            return { valido: false, error: 'Las coordenadas "coordenadaX" y "coordenadaY" deben ser números válidos.' };
        }
        if (x < -90 || x > 90) {
            return { valido: false, error: 'La coordenada X debe estar entre -90 y 90 (latitud válida).' };
        }
        if (y < -180 || y > 180) {
            return { valido: false, error: 'La coordenada Y debe estar entre -180 y 180 (longitud válida).' };
        }

        // Parroquia: validar que sea número entero válido
        if (!parroquia) {
            return { valido: false, error: 'El campo "parroquia" es obligatorio.' };
        }
        const idParroquia = Number(parroquia);
        if (isNaN(idParroquia) || !Number.isInteger(idParroquia) || idParroquia < 1 || idParroquia > 99999) {
            return { valido: false, error: 'El campo "parroquia" debe ser un ID numérico válido (1-99999).' };
        }

        // Foto (opcional): validar formato base64 si existe
        if (foto && typeof foto !== 'string') {
            return { valido: false, error: 'El campo "foto" debe ser una cadena en formato base64.' };
        }

        return { valido: true };
    }
}