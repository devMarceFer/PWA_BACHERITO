import jwt from 'jsonwebtoken';
import { extraerBearer } from '../utils/bearer.util.js';

const JWT_SECRET = process.env.JWT_SECRET;

// Valida el JWT propio (emitido en /auth/login) y cuelga el payload decodificado en req.usuario
// para que los middlewares/controladores siguientes puedan revisar módulos/rol sin volver a tocar la BD.
export function requireAuth(req, res, next) {
    const token = extraerBearer(req);
    if (!token) {
        return res.status(401).json({ success: false, message: 'Falta el token de autenticación.' });
    }

    try {
        req.usuario = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'El token de sesión no es válido o expiró.' });
    }
}

// Debe usarse después de requireAuth. Revisa el arreglo de módulos embebido en el JWT
// ({ m: NOMBRE_MODULO, r: NOMBRE_ROL }), calculado en el login a partir de V_AUTORIZACION_USUARIOS.
export function requireModulo(nombreModulo) {
    return (req, res, next) => {
        const modulos = Array.isArray(req.usuario?.modulos) ? req.usuario.modulos : [];
        const tieneAcceso = modulos.some(modulo => modulo.m === nombreModulo);

        if (!tieneAcceso) {
            return res.status(403).json({ success: false, message: 'No tienes acceso a este módulo.' });
        }
        next();
    };
}
