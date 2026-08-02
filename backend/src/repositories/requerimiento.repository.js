import oracledb from 'oracledb';
import { convertirAUtm } from '../utils/coordenadas.util.js';
import { decodificarImagenBase64, generarNombreArchivo } from '../utils/imagen.util.js';
import { subirImagenSftp } from '../utils/sftp.util.js';

class RequerimientoRepository {
    // Convierte lat/lon (WGS84) a UTM 17S y, si viene una foto en base64, la sube por SFTP
    // antes de insertar. Se usa tanto para el envío en vivo como para la sincronización de
    // reportes guardados offline: en ambos casos el cliente manda coordenadas crudas y la
    // foto en base64, y es el backend quien calcula X/Y y sube la imagen al directorio real.
    async save(data) {
        let connection;
        try {
            const { x, y } = convertirAUtm(data.coordenadaX, data.coordenadaY);

            let nombreImagen = null;
            let urlFotografia = null;

            if (data.foto) {
                const imagenDecodificada = decodificarImagenBase64(data.foto);
                if (imagenDecodificada) {
                    const nombreArchivo = generarNombreArchivo(imagenDecodificada.extension);
                    const subida = await subirImagenSftp(imagenDecodificada.buffer, nombreArchivo);
                    nombreImagen = subida.nombreArchivo;
                    urlFotografia = subida.url;
                }
            }

            connection = await oracledb.getConnection();
            const sql = `
                INSERT INTO GADMAPPS.OP_BACHERITO_REQ (
                    NOMBRES, COORDENADAX, COORDENADAY, PARROQUIA, TELEFONO, ESTADO, RURAL_URBANA,
                    FECHA_INGRESO, X, Y, FOTOGRAFIA, NOMBRE_IMAGEN
                ) VALUES (
                    :nombres, :coordenadaX, :coordenadaY, :parroquia, :telefono, 'I', :ruralUrbana,
                    SYSDATE, :x, :y, :fotografia, :nombreImagen
                )
            `;
            const result = await connection.execute(sql, {
                nombres: data.nombres,
                coordenadaX: data.coordenadaX,
                coordenadaY: data.coordenadaY,
                parroquia: data.parroquia,
                telefono: data.telefono || null,
                ruralUrbana: data.ruralUrbana || null,
                x,
                y,
                fotografia: urlFotografia,
                nombreImagen
            }, { autoCommit: true });
            return result.rowsAffected;
        } finally {
            if (connection) await connection.close();
        }
    }
}

export default new RequerimientoRepository();