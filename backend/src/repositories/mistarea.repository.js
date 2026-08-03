import oracledb from 'oracledb';
import { executeWithRetry } from '../utils/db.retry.util.js';

class MiTareaRepository {
    async findTareasDeTecnico(idUsuario) {
        return executeWithRetry(async () => {
            let connection;
            try {
                connection = await oracledb.getConnection();
                const sql = `
                    SELECT
                        r.ID AS ID_REQUERIMIENTO, r.NOMBRES, r.FECHA_INGRESO,
                        r.COORDENADAX, r.COORDENADAY,
                        (SELECT PAR_NOMBRE FROM GADMAPPS.PAR_PARROQUIAS WHERE PAR_CODIGO = r.PARROQUIA) AS PAR_NOMBRE,
                        r.ESTADO AS ESTADO_CRUDO,
                        CASE
                            WHEN r.ESTADO = 'I' THEN 'INGRESADO'
                            WHEN r.ESTADO = 'E' THEN 'EN PROCESO'
                            WHEN r.ESTADO = 'R' THEN 'REASIGNADO'
                            WHEN r.ESTADO = 'A' THEN 'ATENDIDO'
                        END AS ESTADO,
                        gt.ID_GRUPO, g.NOMBRE AS NOMBRE_GRUPO
                    FROM GADMAPPS.OP_BACHERITO_GRUPO_TECNICOS gt
                    JOIN GADMAPPS.OP_BACHERITO_GRUPO_TAREAS t ON t.ID_GRUPO = gt.ID_GRUPO
                    JOIN GADMAPPS.OP_BACHERITO_REQ r ON r.ID = t.ID_REQUERIMIENTO
                    JOIN GADMAPPS.OP_BACHERITO_GRUPOS g ON g.ID_GRUPO = gt.ID_GRUPO
                    WHERE gt.ID_USUARIO = :idUsuario
                    AND g.ESTADO = 'S'
                    ORDER BY t.FECHA_ASIGNACION DESC
                `;
                const result = await connection.execute(sql, { idUsuario });
                return result.rows;
            } finally {
                if (connection) await connection.close();
            }
        });
    }

    async contarPendientesDescarga(idUsuario) {
        return executeWithRetry(async () => {
            let connection;
            try {
                connection = await oracledb.getConnection();
                const sql = `
                    SELECT COUNT(*) AS C
                    FROM GADMAPPS.OP_BACHERITO_GRUPO_TECNICOS gt
                    JOIN GADMAPPS.OP_BACHERITO_GRUPO_TAREAS t ON t.ID_GRUPO = gt.ID_GRUPO
                    WHERE gt.ID_USUARIO = :idUsuario AND t.ESTADO = 'I'
                `;
                const result = await connection.execute(sql, { idUsuario });
                return result.rows[0].C;
            } finally {
                if (connection) await connection.close();
            }
        });
    }

    async marcarDescargado(idUsuario) {
        return executeWithRetry(async () => {
            let connection;
            try {
                connection = await oracledb.getConnection();
                const sql = `
                    UPDATE GADMAPPS.OP_BACHERITO_GRUPO_TAREAS
                    SET ESTADO = 'D'
                    WHERE ESTADO = 'I'
                    AND ID_GRUPO IN (SELECT ID_GRUPO FROM GADMAPPS.OP_BACHERITO_GRUPO_TECNICOS WHERE ID_USUARIO = :idUsuario)
                `;
                const result = await connection.execute(sql, { idUsuario }, { autoCommit: true });
                return result.rowsAffected;
            } finally {
                if (connection) await connection.close();
            }
        });
    }

    async finalizarAsignaciones(idRequerimiento) {
        return executeWithRetry(async () => {
            let connection;
            try {
                connection = await oracledb.getConnection();
                const sql = `
                    UPDATE GADMAPPS.OP_BACHERITO_GRUPO_TAREAS
                    SET ESTADO = 'F'
                    WHERE ID_REQUERIMIENTO = :idRequerimiento
                `;
                const result = await connection.execute(sql, { idRequerimiento }, { autoCommit: true });
                return result.rowsAffected;
            } finally {
                if (connection) await connection.close();
            }
        });
    }

    async perteneceATecnico(idRequerimiento, idUsuario) {
        return executeWithRetry(async () => {
            let connection;
            try {
                connection = await oracledb.getConnection();
                const sql = `
                    SELECT COUNT(*) AS C
                    FROM GADMAPPS.OP_BACHERITO_GRUPO_TECNICOS gt
                    JOIN GADMAPPS.OP_BACHERITO_GRUPO_TAREAS t ON t.ID_GRUPO = gt.ID_GRUPO
                    WHERE gt.ID_USUARIO = :idUsuario AND t.ID_REQUERIMIENTO = :idRequerimiento
                `;
                const result = await connection.execute(sql, { idUsuario, idRequerimiento });
                return result.rows[0].C > 0;
            } finally {
                if (connection) await connection.close();
            }
        });
    }

    async actualizarEstado(idRequerimiento, nuevoEstado) {
        return executeWithRetry(async () => {
            let connection;
            try {
                connection = await oracledb.getConnection();
                const sql = `
                    UPDATE GADMAPPS.OP_BACHERITO_REQ
                    SET ESTADO = :nuevoEstado, FECHA_ATENCION = SYSDATE
                    WHERE ID = :idRequerimiento
                `;
                const result = await connection.execute(sql, { idRequerimiento, nuevoEstado }, { autoCommit: true });
                return result.rowsAffected;
            } finally {
                if (connection) await connection.close();
            }
        });
    }
}

export default new MiTareaRepository();
