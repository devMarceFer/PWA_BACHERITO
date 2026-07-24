import oracledb from 'oracledb';

class RequerimientoRepository {
    async findActivos() {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const sql = `
                SELECT 
                    NOMBRES, COORDENADAX, COORDENADAY, TELEFONO, RURAL_URBANA, FECHA_INGRESO, X, Y,
                    (SELECT PAR_NOMBRE FROM GADMAPPS.PAR_PARROQUIAS WHERE PAR_CODIGO = PARROQUIA) AS PAR_NOMBRE,
                    (SELECT NOMBRE_CUADR FROM GADMAPPS.OP_BACHERITO_CUA WHERE ID_CUADRILLA = CUADRILLA_RESPONSABLE) AS CUADRILLA_RESPONSABLE,
                    CASE 
                        WHEN ESTADO = 'I' THEN 'INGRESADO'
                        WHEN ESTADO = 'E' THEN 'EN PROCESO'
                        WHEN ESTADO = 'R' THEN 'REASIGNADO'
                    END AS ESTADO
                FROM GADMAPPS.OP_BACHERITO_REQ 
                WHERE ESTADO <> 'A'
            `;
            const result = await connection.execute(sql);
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }

    async updateEstado(id, nuevoEstado) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const sql = `
                UPDATE GADMAPPS.OP_BACHERITO_REQ
                SET ESTADO = :nuevoEstado, FECHA_ATENCION = SYSDATE
                WHERE ID = :id
            `;
            const result = await connection.execute(sql, { nuevoEstado, id }, { autoCommit: true });
            return result.rowsAffected;
        } finally {
            if (connection) await connection.close();
        }
    }

    async save(data) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const sql = `
                INSERT INTO GADMAPPS.OP_BACHERITO_REQ (
                    NOMBRES, COORDENADAX, COORDENADAY, PARROQUIA, TELEFONO, ESTADO, RURAL_URBANA, FECHA_INGRESO, X, Y
                ) VALUES (
                    :nombres, :coordenadaX, :coordenadaY, :parroquia, :telefono, 'I', :ruralUrbana, SYSDATE, :x, :y
                )
            `;
            const result = await connection.execute(sql, {
                nombres: data.nombres,
                coordenadaX: data.coordenadaX,
                coordenadaY: data.coordenadaY,
                parroquia: data.parroquia,
                telefono: data.telefono || null,
                ruralUrbana: data.ruralUrbana,
                x: data.x,
                y: data.y
            }, { autoCommit: true });
            return result.rowsAffected;
        } finally {
            if (connection) await connection.close();
        }
    }
}

export default new RequerimientoRepository();