import oracledb from 'oracledb';

class AccesosRepository {
    // Solo sistemas y módulos activos: un módulo dado de baja no debe poder otorgarse.
    async findSistemasConModulos() {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const result = await connection.execute(`
                SELECT s.ID_SISTEMA, s.NOMBRE AS SISTEMA,
                       m.ID_MODULO, m.NOMBRE AS MODULO, m.DESCRIPCION
                FROM GADMAPPS.RBAC_SISTEMAS s
                JOIN GADMAPPS.RBAC_MODULOS m ON m.ID_SISTEMA = s.ID_SISTEMA
                WHERE s.ESTADO = 'S' AND m.ESTADO = 'S'
                ORDER BY s.NOMBRE, m.NOMBRE
            `);
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }

    async findRoles() {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const result = await connection.execute(`
                SELECT ID_ROL, NOMBRE FROM GADMAPPS.RBAC_ROLES
                WHERE ESTADO = 'S' ORDER BY NOMBRE
            `);
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }

    // A diferencia de grupo.repository.js:buscarTecnicos, acá NO se filtra por rol ni por
    // accesos: el objetivo es encontrar a cualquiera, sobre todo a quien todavía no tiene nada.
    async buscarUsuarios(q) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const result = await connection.execute(`
                SELECT u.ID_USUARIO, u.NOMBRE, u.APELLIDO, u.NUM_DOCUMENTO, u.EMAIL,
                       u.ESTADO, u.BLOQUEADO,
                       (SELECT COUNT(*) FROM GADMAPPS.RBAC_USUARIO_MODULO_ROL umr
                        WHERE umr.ID_USUARIO = u.ID_USUARIO AND umr.ESTADO = 'S') AS TOTAL_ACCESOS_ACTIVOS
                FROM GADMAPPS.RBAC_USUARIOS u
                WHERE UPPER(u.NOMBRE || ' ' || u.APELLIDO) LIKE UPPER('%' || :q || '%')
                   OR u.NUM_DOCUMENTO LIKE '%' || :q || '%'
                   OR UPPER(u.EMAIL) LIKE UPPER('%' || :q || '%')
                ORDER BY u.APELLIDO, u.NOMBRE
                FETCH FIRST 20 ROWS ONLY
            `, { q });
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }

    async findUsuarioPorId(idUsuario) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const result = await connection.execute(`
                SELECT u.ID_USUARIO, u.NOMBRE, u.APELLIDO, u.NUM_DOCUMENTO, u.EMAIL,
                       u.ESTADO, u.BLOQUEADO,
                       (SELECT COUNT(*) FROM GADMAPPS.RBAC_USUARIO_MODULO_ROL umr
                        WHERE umr.ID_USUARIO = u.ID_USUARIO AND umr.ESTADO = 'S') AS TOTAL_ACCESOS_ACTIVOS
                FROM GADMAPPS.RBAC_USUARIOS u
                WHERE u.ID_USUARIO = :idUsuario
            `, { idUsuario });
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }

    // Activos y revocados: la pantalla muestra los revocados colapsados (D4).
    async findAccesosDeUsuario(idUsuario) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const result = await connection.execute(`
                SELECT umr.ID_UMR, s.ID_SISTEMA, s.NOMBRE AS SISTEMA,
                       m.ID_MODULO, m.NOMBRE AS MODULO,
                       r.ID_ROL, r.NOMBRE AS ROL,
                       umr.ESTADO, umr.CREADO_EN
                FROM GADMAPPS.RBAC_USUARIO_MODULO_ROL umr
                JOIN GADMAPPS.RBAC_MODULOS m  ON m.ID_MODULO = umr.ID_MODULO
                JOIN GADMAPPS.RBAC_SISTEMAS s ON s.ID_SISTEMA = m.ID_SISTEMA
                JOIN GADMAPPS.RBAC_ROLES r    ON r.ID_ROL = umr.ID_ROL
                WHERE umr.ID_USUARIO = :idUsuario
                ORDER BY umr.ESTADO DESC, s.NOMBRE, m.NOMBRE, r.NOMBRE
            `, { idUsuario });
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }
}

export default new AccesosRepository();
