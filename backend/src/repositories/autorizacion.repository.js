import oracledb from 'oracledb';
import { executeWithRetry } from '../utils/db.retry.util.js';

class AutorizacionRepository {
    async findByUsuarioYSistema(idUsuario, sistemaNombre) {
        return executeWithRetry(async () => {
            let connection;
            try {
                connection = await oracledb.getConnection();
                const sql = `
                    SELECT MODULO, ROL
                    FROM GADMAPPS.VW_AUTORIZACION_USUARIOS
                    WHERE ID_USUARIO = :idUsuario
                    AND SISTEMA = :sistemaNombre
                `;
                const result = await connection.execute(sql, { idUsuario, sistemaNombre });
                return result.rows;
            } finally {
                if (connection) await connection.close();
            }
        });
    }
}

export default new AutorizacionRepository();
