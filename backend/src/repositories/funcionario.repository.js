import oracledb from 'oracledb';

class FuncionarioRepository {
    async findByCedula(cedula) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const sql = `
                SELECT CORREO, NOMBRES, APELLIDOS, CELULAR1
                FROM GADMAPPS.VW_TH_FUNCIONARIOS
                WHERE CEDULA = :cedula
            `;
            const result = await connection.execute(sql, { cedula });
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }
}

export default new FuncionarioRepository();
