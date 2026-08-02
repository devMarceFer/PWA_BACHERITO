import { v4 as uuidv4 } from 'uuid';

const EXTENSION_POR_MIME = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
};

// Recibe un data URL ("data:image/png;base64,...") y devuelve el buffer decodificado
// más la extensión real del archivo, para poder subirlo por SFTP.
export function decodificarImagenBase64(dataUrl) {
    const match = /^data:(image\/\w+);base64,(.+)$/.exec(dataUrl || '');
    if (!match) {
        return null;
    }

    const [, mime, base64] = match;
    const extension = EXTENSION_POR_MIME[mime] || 'jpg';
    const buffer = Buffer.from(base64, 'base64');

    return { buffer, extension };
}

// Nombre único para el archivo en el SFTP: yyyyMMddHHmmss_uuid.ext
export function generarNombreArchivo(extension) {
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').substring(0, 14);
    return `${timestamp}_${uuidv4()}.${extension}`;
}
