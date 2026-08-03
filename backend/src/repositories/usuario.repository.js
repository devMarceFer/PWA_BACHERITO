import oracledb from 'oracledb';
import { executeWithRetry } from '../utils/db.retry.util.js';

class UsuarioRepository {
    async findByEmail(email) {
        return executeWithRetry(async () => {
            let connection;
            try {
                connection = await oracledb.getConnection();
                const sql = `
                    SELECT ID_USUARIO, TIPO_USUARIO, TIPO_DOCUMENTO, NUM_DOCUMENTO, EMAIL, NOMBRE, APELLIDO,
                           ACTIVEDIRECTORY, BLOQUEADO, ESTADO
                    FROM GADMAPPS.RBAC_USUARIOS
                    WHERE EMAIL = :email
                `;
                const result = await connection.execute(sql, { email });
                return result.rows;
            } finally {
                if (connection) await connection.close();
            }
        });
    }

    async save(usuario) {
        return executeWithRetry(async () => {
            let connection;
            try {
                connection = await oracledb.getConnection();
                const sql = `
                    INSERT INTO GADMAPPS.RBAC_USUARIOS (
                        TIPO_USUARIO, TIPO_DOCUMENTO, NUM_DOCUMENTO, EMAIL, PASSWORD_HASH, NOMBRE, APELLIDO, ACTIVEDIRECTORY
                    ) VALUES (
                        :tipoUsuario, :tipoDocumento, :numDocumento, :email, :passwordHash, :nombre, :apellido, :activeDirectory
                    )
                    RETURNING ID_USUARIO INTO :idUsuario
                `;
                const result = await connection.execute(sql, {
                    tipoUsuario: usuario.tipoUsuario,
                    tipoDocumento: usuario.tipoDocumento,
                    numDocumento: usuario.numDocumento,
                    email: usuario.email,
                    passwordHash: usuario.passwordHash,
                    nombre: usuario.nombre,
                    apellido: usuario.apellido,
                    activeDirectory: usuario.activeDirectory,
                    idUsuario: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
                }, { autoCommit: true });
                return result.outBinds.idUsuario[0];
            } finally {
                if (connection) await connection.close();
            }
        });
    }

    async updateUltimoAcceso(idUsuario) {
        return executeWithRetry(async () => {
            let connection;
            try {
                connection = await oracledb.getConnection();
                const sql = `
                    UPDATE GADMAPPS.RBAC_USUARIOS
                    SET ULTIMO_ACCESO = CURRENT_TIMESTAMP, ACTUALIZADO_EN = CURRENT_TIMESTAMP
                    WHERE ID_USUARIO = :idUsuario
                `;
                const result = await connection.execute(sql, { idUsuario }, { autoCommit: true });
                return result.rowsAffected;
            } finally {
                if (connection) await connection.close();
            }
        });
    }
}

export default new UsuarioRepository();
