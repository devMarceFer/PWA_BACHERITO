import oracledb from 'oracledb';

// Institución responsable del Bacherito en GADMAPPS.OP_BACHERITO_REQ (columna VARCHAR2).
const INSTITUCION_BACHERITO = '61';

// Criterio único de selección de baches asignables a un grupo: los de sus parroquias, no
// atendidos, de la institución del Bacherito, y que no estén ya asignados a ningún grupo.
// Vive en un solo lugar A PROPÓSITO: la previsualización y la asignación masiva DEBEN
// seleccionar exactamente el mismo conjunto. Si divergen, el administrador confirma un
// número y se asigna otro.
const CRITERIO_BACHES_DE_PARROQUIAS_DEL_GRUPO = `
    r.PARROQUIA IN (
        SELECT PAR_CODIGO FROM GADMAPPS.OP_BACHERITO_GRUPO_PARROQUIAS WHERE ID_GRUPO = :idGrupo
    )
    AND r.ESTADO <> 'A'
    AND r.INSTITUCION_RESPONSABLE = :institucion
    AND r.ID NOT IN (SELECT ID_REQUERIMIENTO FROM GADMAPPS.OP_BACHERITO_GRUPO_TAREAS)
`;

class GrupoRepository {
    async findAll() {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const sql = `
                SELECT
                    g.ID_GRUPO, g.NOMBRE, g.FECHA_CREACION,
                    (SELECT COUNT(*) FROM GADMAPPS.OP_BACHERITO_GRUPO_TAREAS t
                     WHERE t.ID_GRUPO = g.ID_GRUPO) AS BACHES_REPORTADOS,
                    (SELECT COUNT(*) FROM GADMAPPS.OP_BACHERITO_GRUPO_TAREAS t
                     JOIN GADMAPPS.OP_BACHERITO_REQ r ON r.ID = t.ID_REQUERIMIENTO
                     WHERE t.ID_GRUPO = g.ID_GRUPO AND r.ESTADO = 'A') AS BACHES_ATENDIDOS
                FROM GADMAPPS.OP_BACHERITO_GRUPOS g
                WHERE g.ESTADO = 'S'
                ORDER BY g.FECHA_CREACION DESC
            `;
            const result = await connection.execute(sql);
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }

    async findById(idGrupo) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const sql = `
                SELECT g.ID_GRUPO, g.NOMBRE, g.FECHA_CREACION
                FROM GADMAPPS.OP_BACHERITO_GRUPOS g
                WHERE g.ID_GRUPO = :idGrupo AND g.ESTADO = 'S'
            `;
            const result = await connection.execute(sql, { idGrupo });
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }

    async findTecnicosPorGrupo(idGrupo) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const sql = `
                SELECT u.ID_USUARIO, u.NOMBRE, u.APELLIDO, u.NUM_DOCUMENTO
                FROM GADMAPPS.OP_BACHERITO_GRUPO_TECNICOS gt
                JOIN GADMAPPS.RBAC_USUARIOS u ON u.ID_USUARIO = gt.ID_USUARIO
                WHERE gt.ID_GRUPO = :idGrupo
            `;
            const result = await connection.execute(sql, { idGrupo });
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }

    async findTareas(idGrupo) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const sql = `
                SELECT
                    t.ID_TAREA, t.FECHA_ASIGNACION, r.ID AS ID_REQUERIMIENTO, r.NOMBRES, r.FECHA_INGRESO,
                    (SELECT PAR_NOMBRE FROM GADMAPPS.PAR_PARROQUIAS WHERE PAR_CODIGO = r.PARROQUIA) AS PAR_NOMBRE,
                    CASE
                        WHEN r.ESTADO = 'I' THEN 'INGRESADO'
                        WHEN r.ESTADO = 'E' THEN 'EN PROCESO'
                        WHEN r.ESTADO = 'R' THEN 'REASIGNADO'
                        WHEN r.ESTADO = 'A' THEN 'ATENDIDO'
                    END AS ESTADO
                FROM GADMAPPS.OP_BACHERITO_GRUPO_TAREAS t
                JOIN GADMAPPS.OP_BACHERITO_REQ r ON r.ID = t.ID_REQUERIMIENTO
                WHERE t.ID_GRUPO = :idGrupo
                ORDER BY t.FECHA_ASIGNACION DESC
            `;
            const result = await connection.execute(sql, { idGrupo });
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }

    // parCodigo es opcional: null/undefined trae baches disponibles de todas las parroquias.
    async findBachesDisponibles(parCodigo) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const sql = `
                SELECT
                    r.ID, r.NOMBRES, r.FECHA_INGRESO,
                    (SELECT PAR_NOMBRE FROM GADMAPPS.PAR_PARROQUIAS WHERE PAR_CODIGO = r.PARROQUIA) AS PAR_NOMBRE,
                    CASE
                        WHEN r.ESTADO = 'I' THEN 'INGRESADO'
                        WHEN r.ESTADO = 'E' THEN 'EN PROCESO'
                        WHEN r.ESTADO = 'R' THEN 'REASIGNADO'
                    END AS ESTADO
                FROM GADMAPPS.OP_BACHERITO_REQ r
                WHERE (:parCodigo IS NULL OR r.PARROQUIA = :parCodigo)
                AND r.ESTADO <> 'A'
                AND r.INSTITUCION_RESPONSABLE = :institucion
                AND r.ID NOT IN (SELECT ID_REQUERIMIENTO FROM GADMAPPS.OP_BACHERITO_GRUPO_TAREAS)
                ORDER BY r.FECHA_INGRESO DESC
            `;
            const result = await connection.execute(sql, { parCodigo: parCodigo ?? null, institucion: INSTITUCION_BACHERITO });
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }

    // Asignar un bache a un grupo marca al técnico como responsable: OP_BACHERITO_REQ.ESTADO
    // pasa a 'R' (Reasignado), en la misma transacción que la fila de OP_BACHERITO_GRUPO_TAREAS.
    async asignarTarea({ idGrupo, idRequerimiento, asignadoPor }) {
        let connection;
        try {
            connection = await oracledb.getConnection();

            await connection.execute(
                `INSERT INTO GADMAPPS.OP_BACHERITO_GRUPO_TAREAS (ID_GRUPO, ID_REQUERIMIENTO, ASIGNADO_POR)
                 VALUES (:idGrupo, :idRequerimiento, :asignadoPor)`,
                { idGrupo, idRequerimiento, asignadoPor },
                { autoCommit: false }
            );

            await connection.execute(
                `UPDATE GADMAPPS.OP_BACHERITO_REQ SET ESTADO = 'R' WHERE ID = :idRequerimiento`,
                { idRequerimiento },
                { autoCommit: false }
            );

            await connection.commit();
        } catch (error) {
            if (connection) await connection.rollback();
            throw error;
        } finally {
            if (connection) await connection.close();
        }
    }

    // Quitar la tarea revierte el bache a 'I' (Ingresado) para que vuelva a aparecer como
    // disponible; solo si seguía en 'R' (si ya fue atendido, 'A' no se toca).
    async quitarTarea(idGrupo, idRequerimiento) {
        let connection;
        try {
            connection = await oracledb.getConnection();

            const result = await connection.execute(
                `DELETE FROM GADMAPPS.OP_BACHERITO_GRUPO_TAREAS
                 WHERE ID_GRUPO = :idGrupo AND ID_REQUERIMIENTO = :idRequerimiento`,
                { idGrupo, idRequerimiento },
                { autoCommit: false }
            );

            await connection.execute(
                `UPDATE GADMAPPS.OP_BACHERITO_REQ SET ESTADO = 'I' WHERE ID = :idRequerimiento AND ESTADO = 'R'`,
                { idRequerimiento },
                { autoCommit: false }
            );

            await connection.commit();
            return result.rowsAffected;
        } catch (error) {
            if (connection) await connection.rollback();
            throw error;
        } finally {
            if (connection) await connection.close();
        }
    }

    // Todos los baches de la institución con su grupo/técnico(s) asignado, para el mapa de
    // supervisión del administrador (GET solo lectura: el admin no puede cambiar el estado desde
    // aquí, solo ver a quién está asignado cada bache).
    async obtenerMapaAdmin(institucion) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const sql = `
                SELECT
                    r.ID, r.NOMBRES, r.COORDENADAX, r.COORDENADAY, r.FECHA_INGRESO,
                    r.ESTADO AS ESTADO_CRUDO,
                    CASE
                        WHEN r.ESTADO = 'I' THEN 'INGRESADO'
                        WHEN r.ESTADO = 'E' THEN 'EN PROCESO'
                        WHEN r.ESTADO = 'R' THEN 'REASIGNADO'
                        WHEN r.ESTADO = 'A' THEN 'ATENDIDO'
                        WHEN r.ESTADO = 'N' THEN 'NUEVO'
                        WHEN r.ESTADO = 'M' THEN 'MANTENIMIENTO'
                    END AS ESTADO,
                    (SELECT PAR_NOMBRE FROM GADMAPPS.PAR_PARROQUIAS WHERE PAR_CODIGO = r.PARROQUIA) AS PAR_NOMBRE,
                    g.NOMBRE AS NOMBRE_GRUPO,
                    (SELECT LISTAGG(u.NOMBRE || ' ' || u.APELLIDO, ', ') WITHIN GROUP (ORDER BY u.NOMBRE)
                     FROM GADMAPPS.OP_BACHERITO_GRUPO_TECNICOS gt2
                     JOIN GADMAPPS.RBAC_USUARIOS u ON u.ID_USUARIO = gt2.ID_USUARIO
                     WHERE gt2.ID_GRUPO = g.ID_GRUPO) AS TECNICOS
                FROM GADMAPPS.OP_BACHERITO_REQ r
                LEFT JOIN GADMAPPS.OP_BACHERITO_GRUPO_TAREAS t ON t.ID_REQUERIMIENTO = r.ID
                LEFT JOIN GADMAPPS.OP_BACHERITO_GRUPOS g ON g.ID_GRUPO = t.ID_GRUPO AND g.ESTADO = 'S'
                WHERE r.INSTITUCION_RESPONSABLE = :institucion
                ORDER BY r.FECHA_INGRESO DESC
            `;
            const result = await connection.execute(sql, { institucion });
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }

    // Resumen institucional para el Panel de Control del administrador: totales de
    // GADMAPPS.OP_BACHERITO_REQ filtrados por institución responsable (no por grupo).
    async obtenerResumenAdmin(institucion) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const sql = `
                SELECT
                    COUNT(*) AS TOTAL,
                    SUM(CASE WHEN r.ESTADO <> 'A' THEN 1 ELSE 0 END) AS PENDIENTES,
                    SUM(CASE WHEN r.ESTADO = 'A' THEN 1 ELSE 0 END) AS RESUELTOS,
                    SUM(CASE WHEN r.ESTADO = 'R' THEN 1 ELSE 0 END) AS EN_PROGRESO
                FROM GADMAPPS.OP_BACHERITO_REQ r
                WHERE r.INSTITUCION_RESPONSABLE = :institucion
            `;
            const result = await connection.execute(sql, { institucion });
            return result.rows[0];
        } finally {
            if (connection) await connection.close();
        }
    }

    async findTecnicosDeGruposActivos() {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const sql = `
                SELECT gt.ID_GRUPO, u.ID_USUARIO, u.NOMBRE, u.APELLIDO, u.NUM_DOCUMENTO
                FROM GADMAPPS.OP_BACHERITO_GRUPO_TECNICOS gt
                JOIN GADMAPPS.RBAC_USUARIOS u ON u.ID_USUARIO = gt.ID_USUARIO
                JOIN GADMAPPS.OP_BACHERITO_GRUPOS g ON g.ID_GRUPO = gt.ID_GRUPO
                WHERE g.ESTADO = 'S'
            `;
            const result = await connection.execute(sql);
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }

    // Solo usuarios con el rol TECNICO realmente asignado en RBAC_USUARIO_MODULO_ROL (no
    // cualquier funcionario), activos tanto en RBAC_USUARIOS como en esa asignación de rol, y que
    // no pertenezcan ya a otro grupo activo: un técnico solo puede estar en un grupo a la vez.
    async buscarTecnicos(query) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const sql = `
                SELECT DISTINCT u.ID_USUARIO, u.NOMBRE, u.APELLIDO, u.NUM_DOCUMENTO
                FROM GADMAPPS.RBAC_USUARIOS u
                JOIN GADMAPPS.RBAC_USUARIO_MODULO_ROL umr ON umr.ID_USUARIO = u.ID_USUARIO
                JOIN GADMAPPS.RBAC_ROLES r ON r.ID_ROL = umr.ID_ROL
                WHERE u.ESTADO = 'S'
                AND umr.ESTADO = 'S'
                AND r.NOMBRE = 'TECNICO'
                AND (UPPER(u.NOMBRE || ' ' || u.APELLIDO) LIKE UPPER('%' || :q || '%') OR u.NUM_DOCUMENTO LIKE '%' || :q || '%')
                AND NOT EXISTS (
                    SELECT 1 FROM GADMAPPS.OP_BACHERITO_GRUPO_TECNICOS gt
                    JOIN GADMAPPS.OP_BACHERITO_GRUPOS g ON g.ID_GRUPO = gt.ID_GRUPO
                    WHERE gt.ID_USUARIO = u.ID_USUARIO AND g.ESTADO = 'S'
                )
                FETCH FIRST 20 ROWS ONLY
            `;
            const result = await connection.execute(sql, { q: query });
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }

    // Cuando buscarTecnicos no encuentra candidatos válidos, esta consulta explica por qué:
    // busca coincidencias de nombre/cédula sin el filtro de rol/estado/grupo, para poder decirle
    // al administrador si el usuario no existe, está inactivo, no es técnico o ya tiene grupo.
    async diagnosticarTecnico(query) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const sql = `
                SELECT
                    u.NOMBRE, u.APELLIDO, u.ESTADO AS ESTADO_USUARIO,
                    (SELECT COUNT(*) FROM GADMAPPS.RBAC_USUARIO_MODULO_ROL umr
                     JOIN GADMAPPS.RBAC_ROLES r ON r.ID_ROL = umr.ID_ROL
                     WHERE umr.ID_USUARIO = u.ID_USUARIO AND umr.ESTADO = 'S' AND r.NOMBRE = 'TECNICO') AS TIENE_ROL_TECNICO,
                    (SELECT g.NOMBRE FROM GADMAPPS.OP_BACHERITO_GRUPO_TECNICOS gt
                     JOIN GADMAPPS.OP_BACHERITO_GRUPOS g ON g.ID_GRUPO = gt.ID_GRUPO
                     WHERE gt.ID_USUARIO = u.ID_USUARIO AND g.ESTADO = 'S'
                     FETCH FIRST 1 ROWS ONLY) AS GRUPO_ACTUAL
                FROM GADMAPPS.RBAC_USUARIOS u
                WHERE (UPPER(u.NOMBRE || ' ' || u.APELLIDO) LIKE UPPER('%' || :q || '%') OR u.NUM_DOCUMENTO LIKE '%' || :q || '%')
                FETCH FIRST 5 ROWS ONLY
            `;
            const result = await connection.execute(sql, { q: query });
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }

    // Grupo activo (si existe) al que ya pertenece un técnico, para impedir asignarlo a un
    // segundo grupo (un técnico solo puede pertenecer a un grupo a la vez).
    async obtenerGrupoDeTecnico(idUsuario) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const sql = `
                SELECT g.ID_GRUPO, g.NOMBRE AS NOMBRE_GRUPO, u.NOMBRE, u.APELLIDO
                FROM GADMAPPS.OP_BACHERITO_GRUPO_TECNICOS gt
                JOIN GADMAPPS.OP_BACHERITO_GRUPOS g ON g.ID_GRUPO = gt.ID_GRUPO
                JOIN GADMAPPS.RBAC_USUARIOS u ON u.ID_USUARIO = gt.ID_USUARIO
                WHERE gt.ID_USUARIO = :idUsuario AND g.ESTADO = 'S'
                FETCH FIRST 1 ROWS ONLY
            `;
            const result = await connection.execute(sql, { idUsuario });
            return result.rows[0] || null;
        } finally {
            if (connection) await connection.close();
        }
    }

    async contarTecnicos(idGrupo) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const result = await connection.execute(
                `SELECT COUNT(*) AS C FROM GADMAPPS.OP_BACHERITO_GRUPO_TECNICOS WHERE ID_GRUPO = :idGrupo`,
                { idGrupo }
            );
            return result.rows[0].C;
        } finally {
            if (connection) await connection.close();
        }
    }

    // Agregar un técnico a un grupo ya existente le da acceso automático a las tareas que el
    // grupo ya tenía asignadas (OP_BACHERITO_GRUPO_TAREAS se relaciona por ID_GRUPO, no por
    // técnico individual), sin necesidad de reasignar nada.
    async agregarTecnico(idGrupo, idUsuario) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            await connection.execute(
                `INSERT INTO GADMAPPS.OP_BACHERITO_GRUPO_TECNICOS (ID_GRUPO, ID_USUARIO) VALUES (:idGrupo, :idUsuario)`,
                { idGrupo, idUsuario },
                { autoCommit: true }
            );
        } finally {
            if (connection) await connection.close();
        }
    }

    async quitarTecnico(idGrupo, idUsuario) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const result = await connection.execute(
                `DELETE FROM GADMAPPS.OP_BACHERITO_GRUPO_TECNICOS WHERE ID_GRUPO = :idGrupo AND ID_USUARIO = :idUsuario`,
                { idGrupo, idUsuario },
                { autoCommit: true }
            );
            return result.rowsAffected;
        } finally {
            if (connection) await connection.close();
        }
    }

    async crear({ nombre, creadoPor, tecnicos }) {
        let connection;
        try {
            connection = await oracledb.getConnection();

            const resultGrupo = await connection.execute(
                `INSERT INTO GADMAPPS.OP_BACHERITO_GRUPOS (NOMBRE, CREADO_POR) VALUES (:nombre, :creadoPor) RETURNING ID_GRUPO INTO :idGrupo`,
                {
                    nombre,
                    creadoPor,
                    idGrupo: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
                },
                { autoCommit: false }
            );
            const idGrupo = resultGrupo.outBinds.idGrupo[0];

            const binds = tecnicos.map(idUsuario => ({ idGrupo, idUsuario }));
            await connection.executeMany(
                `INSERT INTO GADMAPPS.OP_BACHERITO_GRUPO_TECNICOS (ID_GRUPO, ID_USUARIO) VALUES (:idGrupo, :idUsuario)`,
                binds,
                { autoCommit: false }
            );

            await connection.commit();
            return idGrupo;
        } catch (error) {
            if (connection) await connection.rollback();
            throw error;
        } finally {
            if (connection) await connection.close();
        }
    }

    async findParroquiasDeGrupo(idGrupo) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const result = await connection.execute(
                `SELECT gp.PAR_CODIGO,
                        (SELECT PAR_NOMBRE FROM GADMAPPS.PAR_PARROQUIAS WHERE PAR_CODIGO = gp.PAR_CODIGO) AS PAR_NOMBRE
                 FROM GADMAPPS.OP_BACHERITO_GRUPO_PARROQUIAS gp
                 WHERE gp.ID_GRUPO = :idGrupo
                 ORDER BY PAR_NOMBRE`,
                { idGrupo }
            );
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }

    // Parroquias que todavía no tiene ningún grupo. Alimenta el selector del administrador,
    // para que no pueda ni intentar una ya tomada.
    async findParroquiasDisponibles() {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const result = await connection.execute(
                `SELECT p.PAR_CODIGO, p.PAR_NOMBRE
                 FROM GADMAPPS.PAR_PARROQUIAS p
                 WHERE p.PAR_CODIGO NOT IN (SELECT PAR_CODIGO FROM GADMAPPS.OP_BACHERITO_GRUPO_PARROQUIAS)
                 ORDER BY p.PAR_NOMBRE`
            );
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }

    // Agrega parroquias al grupo. Transaccional: si una viola el UNIQUE, no entra ninguna.
    async asignarParroquias(idGrupo, parCodigos, asignadoPor) {
        let connection;
        try {
            connection = await oracledb.getConnection();

            for (const parCodigo of parCodigos) {
                await connection.execute(
                    `INSERT INTO GADMAPPS.OP_BACHERITO_GRUPO_PARROQUIAS (ID_GRUPO, PAR_CODIGO, ASIGNADO_POR)
                     VALUES (:idGrupo, :parCodigo, :asignadoPor)`,
                    { idGrupo, parCodigo, asignadoPor },
                    { autoCommit: false }
                );
            }

            await connection.commit();
        } catch (error) {
            if (connection) await connection.rollback();
            throw error;
        } finally {
            if (connection) await connection.close();
        }
    }

    // Devuelve cuántas filas borró: 0 significa que esa parroquia no era de ese grupo.
    // NO toca OP_BACHERITO_GRUPO_TAREAS: quitar territorio no quita trabajo ya asignado.
    async quitarParroquia(idGrupo, parCodigo) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const result = await connection.execute(
                `DELETE FROM GADMAPPS.OP_BACHERITO_GRUPO_PARROQUIAS
                 WHERE ID_GRUPO = :idGrupo AND PAR_CODIGO = :parCodigo`,
                { idGrupo, parCodigo },
                { autoCommit: true }
            );
            return result.rowsAffected;
        } finally {
            if (connection) await connection.close();
        }
    }

    // Conteo por parroquia de los baches que la asignación masiva traería. Usa EXACTAMENTE
    // el mismo criterio que findIdsBachesDeParroquiasDeGrupo: si divergen, el administrador
    // confirma un número y se asigna otro.
    async contarBachesDeParroquiasDeGrupo(idGrupo, institucion) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const result = await connection.execute(
                `SELECT r.PARROQUIA AS PAR_CODIGO,
                        (SELECT PAR_NOMBRE FROM GADMAPPS.PAR_PARROQUIAS WHERE PAR_CODIGO = r.PARROQUIA) AS PAR_NOMBRE,
                        COUNT(*) AS CANTIDAD
                 FROM GADMAPPS.OP_BACHERITO_REQ r
                 WHERE ${CRITERIO_BACHES_DE_PARROQUIAS_DEL_GRUPO}
                 GROUP BY r.PARROQUIA
                 ORDER BY PAR_NOMBRE`,
                { idGrupo, institucion }
            );
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }

    // Mismo criterio que contarBachesDeParroquiasDeGrupo, pero devolviendo los ids a asignar.
    async findIdsBachesDeParroquiasDeGrupo(idGrupo, institucion) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const result = await connection.execute(
                `SELECT r.ID
                 FROM GADMAPPS.OP_BACHERITO_REQ r
                 WHERE ${CRITERIO_BACHES_DE_PARROQUIAS_DEL_GRUPO}
                 ORDER BY r.FECHA_INGRESO DESC`,
                { idGrupo, institucion }
            );
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }

    // Asigna N baches al grupo en UNA sola transacción: entran todos o ninguno.
    // Misma semántica que asignarTarea, extendida a varias filas.
    async asignarTareasMasivo(idGrupo, idsRequerimiento, asignadoPor) {
        let connection;
        try {
            connection = await oracledb.getConnection();

            for (const idRequerimiento of idsRequerimiento) {
                await connection.execute(
                    `INSERT INTO GADMAPPS.OP_BACHERITO_GRUPO_TAREAS (ID_GRUPO, ID_REQUERIMIENTO, ASIGNADO_POR)
                     VALUES (:idGrupo, :idRequerimiento, :asignadoPor)`,
                    { idGrupo, idRequerimiento, asignadoPor },
                    { autoCommit: false }
                );

                await connection.execute(
                    `UPDATE GADMAPPS.OP_BACHERITO_REQ SET ESTADO = 'R' WHERE ID = :idRequerimiento`,
                    { idRequerimiento },
                    { autoCommit: false }
                );
            }

            await connection.commit();
        } catch (error) {
            if (connection) await connection.rollback();
            throw error;
        } finally {
            if (connection) await connection.close();
        }
    }
}

export default new GrupoRepository();
