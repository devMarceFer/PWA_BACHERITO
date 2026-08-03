import oracledb from 'oracledb';
import { executeWithRetry } from '../utils/db.retry.util.js';

class ParroquiaRepository {
    async findByCanton(canCodigo) {
        return executeWithRetry(async () => {
            let connection;
            try {
                connection = await oracledb.getConnection();
                const sql = `
                    SELECT PAR_NOMBRE, PAR_CODIGO
                    FROM GADMAPPS.PAR_PARROQUIAS
                    WHERE CAN_CODIGO = :canCodigo
                    ORDER BY 1
                `;
                const result = await connection.execute(sql, { canCodigo });
                return result.rows;
            } finally {
                if (connection) await connection.close();
            }
        });
    }
}

export default new ParroquiaRepository();
