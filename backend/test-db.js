import oracledb from 'oracledb';
import 'dotenv/config';

async function testConnection() {
    console.log('--- Iniciando Prueba de Conexión a Oracle ---');
    console.log(`Intentando conectar a: ${process.env.DB_CONNECTION_STRING}`);
    console.log(`Usuario: ${process.env.DB_USER}`);
    
    let connection;

    try {
        // Intentar establecer una conexión directa (Thin mode por defecto en v6+)
        connection = await oracledb.getConnection({
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            connectString: process.env.DB_CONNECTION_STRING
        });

        console.log('✅ ¡Conexión física establecida con éxito!');

        // Ejecutar un query de verificación rápida en la tabla dummy de Oracle
        const result = await connection.execute('SELECT USER, SYSDATE FROM DUAL');
        
        console.log('✅ Consulta de prueba ejecutada correctamente.');
        console.log('Resultado de la Base de Datos:', result.rows);

    } catch (error) {
        console.error('❌ Error de conexión o configuración:');
        console.error(error);
    } finally {
        if (connection) {
            try {
                await connection.close();
                console.log('Conexión de prueba cerrada limpiamente.');
            } catch (err) {
                console.error('Error al cerrar la conexión:', err);
            }
        }
    }
}

testConnection();