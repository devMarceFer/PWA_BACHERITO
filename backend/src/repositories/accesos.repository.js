import oracledb from 'oracledb';
import { executeWithRetry } from '../utils/db.retry.util.js';

class AccesosRepository {
    async findSistemasConModulos() {
        return executeWithRetry(async () => {
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
        });
    }

    async findRoles() {
        return executeWithRetry(async () => {
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
        });
    }

    async buscarUsuarios(q) {
        return executeWithRetry(async () => {
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
        });
    }

    async findUsuarioPorId(idUsuario) {
        return executeWithRetry(async () => {
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
        });
    }

    async findAccesosDeUsuario(idUsuario) {
        return executeWithRetry(async () => {
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
        });
    }

    async otorgarAccesos(idUsuario, otorgamientos, asignadoPor) {
        return executeWithRetry(async () => {
            let connection;
            try {
                connection = await oracledb.getConnection();
                let otorgados = 0;
                let reactivados = 0;

                for (const { idModulo, idRol } of otorgamientos) {
                    const binds = { idUsuario, idModulo, idRol };

                    const activa = await connection.execute(
                        `SELECT ID_UMR FROM GADMAPPS.RBAC_USUARIO_MODULO_ROL
                         WHERE ID_USUARIO = :idUsuario AND ID_MODULO = :idModulo
                           AND ID_ROL = :idRol AND ESTADO = 'S'`,
                        binds
                    );
                    if (activa.rows.length > 0) continue;

                    const reactivacion = await connection.execute(
                        `UPDATE GADMAPPS.RBAC_USUARIO_MODULO_ROL
                         SET ESTADO = 'S', ASIGNADO_POR = :asignadoPor
                         WHERE ID_USUARIO = :idUsuario AND ID_MODULO = :idModulo
                           AND ID_ROL = :idRol AND ESTADO = 'N'`,
                        { ...binds, asignadoPor },
                        { autoCommit: false }
                    );
                    if (reactivacion.rowsAffected > 0) {
                        reactivados++;
                        continue;
                    }

                    try {
                        await connection.execute(
                            `INSERT INTO GADMAPPS.RBAC_USUARIO_MODULO_ROL
                                (ID_USUARIO, ID_MODULO, ID_ROL, ASIGNADO_POR)
                             VALUES (:idUsuario, :idModulo, :idRol, :asignadoPor)`,
                            { ...binds, asignadoPor },
                            { autoCommit: false }
                        );
                        otorgados++;
                    } catch (errorInsert) {
                        if (errorInsert.errorNum !== 1) throw errorInsert;
                    }
                }

                await connection.commit();
                return { otorgados, reactivados };
            } catch (error) {
                if (connection) await connection.rollback();
                throw error;
            } finally {
                if (connection) await connection.close();
            }
        });
    }

    async revocarAcceso(idUsuario, idModulo, idRol) {
        return executeWithRetry(async () => {
            let connection;
            try {
                connection = await oracledb.getConnection();
                const result = await connection.execute(
                    `UPDATE GADMAPPS.RBAC_USUARIO_MODULO_ROL SET ESTADO = 'N'
                     WHERE ID_USUARIO = :idUsuario AND ID_MODULO = :idModulo
                       AND ID_ROL = :idRol AND ESTADO = 'S'`,
                    { idUsuario, idModulo, idRol },
                    { autoCommit: true }
                );
                return result.rowsAffected;
            } finally {
                if (connection) await connection.close();
            }
        });
    }

    async findNombreModulo(idModulo) {
        return executeWithRetry(async () => {
            let connection;
            try {
                connection = await oracledb.getConnection();
                const result = await connection.execute(
                    `SELECT NOMBRE FROM GADMAPPS.RBAC_MODULOS WHERE ID_MODULO = :idModulo`,
                    { idModulo }
                );
                return result.rows.length > 0 ? result.rows[0].NOMBRE : null;
            } finally {
                if (connection) await connection.close();
            }
        });
    }
}

export default new AccesosRepository();
