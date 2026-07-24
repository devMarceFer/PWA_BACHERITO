import oracledb from 'oracledb';

class SesionRepository {
    async save(sesion) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const sql = `
                INSERT INTO GADMAPPS.RBAC_SESIONES (
                    ID_USUARIO, TOKEN_JTI, IP_ORIGEN, USER_AGENT, EXPIRA_EN
                ) VALUES (
                    :idUsuario, :tokenJti, :ipOrigen, :userAgent, :expiraEn
                )
            `;
            const result = await connection.execute(sql, {
                idUsuario: sesion.idUsuario,
                tokenJti: sesion.tokenJti,
                ipOrigen: sesion.ipOrigen,
                userAgent: sesion.userAgent,
                expiraEn: sesion.expiraEn
            }, { autoCommit: true });
            return result.rowsAffected;
        } finally {
            if (connection) await connection.close();
        }
    }

    async revocarPorJti(tokenJti) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const sql = `
                UPDATE GADMAPPS.RBAC_SESIONES
                SET REVOCADO = 1
                WHERE TOKEN_JTI = :tokenJti
            `;
            const result = await connection.execute(sql, { tokenJti }, { autoCommit: true });
            return result.rowsAffected;
        } finally {
            if (connection) await connection.close();
        }
    }
}

export default new SesionRepository();
