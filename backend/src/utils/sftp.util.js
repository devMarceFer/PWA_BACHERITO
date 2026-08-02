import SftpClient from 'ssh2-sftp-client';
import 'dotenv/config';

const REMOTE_DIR = process.env.SFTP_REMOTE_DIR || '/archivo/Bacherito';
const PUBLIC_URL_BASE = process.env.SFTP_PUBLIC_URL_BASE || `https://file.ambato.gob.ec${REMOTE_DIR}`;

// Sube un buffer (imagen decodificada desde base64) al servidor SFTP municipal
// y devuelve { nombreArchivo, url } para guardar en NOMBRE_IMAGEN / FOTOGRAFIA.
export async function subirImagenSftp(buffer, nombreArchivo) {
    const sftp = new SftpClient();

    try {
        await sftp.connect({
            host: process.env.SFTP_HOST,
            port: Number(process.env.SFTP_PORT) || 22,
            username: process.env.SFTP_USER,
            password: process.env.SFTP_PASSWORD
        });

        const rutaRemota = `${REMOTE_DIR}/${nombreArchivo}`;
        await sftp.put(buffer, rutaRemota);

        return {
            nombreArchivo,
            url: `${PUBLIC_URL_BASE}/${nombreArchivo}`
        };
    } finally {
        await sftp.end();
    }
}
