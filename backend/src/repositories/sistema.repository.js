import oracledb from 'oracledb';

class SistemaRepository {
    async findByNombre(nombre) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const sql = `
                SELECT ID_SISTEMA, NOMBRE, TOKEN_EXPIRACION_MIN, ESTADO
                FROM GADMAPPS.RBAC_SISTEMAS
                WHERE NOMBRE = :nombre
            `;
            const result = await connection.execute(sql, { nombre });
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }
}

export default new SistemaRepository();
