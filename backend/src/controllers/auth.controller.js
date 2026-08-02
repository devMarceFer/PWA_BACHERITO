import authService from '../services/auth.service.js';
import { UsuarioModel } from '../models/usuario.model.js';
import { extraerBearer } from '../utils/bearer.util.js';

class AuthController {
    async registrarCognito(req, res, next) {
        try {
            const datos = {
                correo: (req.body.correo || '').trim().toLowerCase(),
                cedula: (req.body.cedula || '').trim(),
                nombre: (req.body.nombre || '').trim(),
                apellido: (req.body.apellido || '').trim()
            };

            const validacion = UsuarioModel.validarParaRegistro(datos);
            if (!validacion.valido) {
                return res.status(400).json({ success: false, message: validacion.error });
            }

            const usuario = await authService.registrarUsuarioCognito(datos);
            const status = usuario.creado ? 201 : 200;
            const message = usuario.creado ? 'Usuario registrado correctamente.' : 'El usuario ya estaba registrado.';
            return res.status(status).json({ success: true, message, data: usuario });
        } catch (error) {
            if (error.message === 'NO_ES_FUNCIONARIO') {
                return res.status(403).json({ success: false, message: 'Solo funcionarios municipales pueden registrarse en esta aplicación.' });
            }
            if (error.message === 'CEDULA_YA_REGISTRADA') {
                return res.status(409).json({ success: false, message: 'Esta cédula ya tiene una cuenta registrada con otro correo.' });
            }
            next(error);
        }
    }

    async login(req, res, next) {
        try {
            const idTokenJwt = extraerBearer(req);
            if (!idTokenJwt) {
                return res.status(401).json({ success: false, message: 'Falta el token de autenticación de Cognito.' });
            }

            const resultado = await authService.iniciarSesion({
                idTokenJwt,
                ipOrigen: req.ip,
                userAgent: req.headers['user-agent']
            });

            return res.status(200).json({ success: true, ...resultado });
        } catch (error) {
            if (error.message === 'SIN_ACCESO_SATELITE') {
                return res.status(403).json({ success: false, message: 'El usuario no tiene acceso a esta aplicación.' });
            }
            if (error.message === 'SOLO_FUNCIONARIOS') {
                return res.status(403).json({ success: false, message: 'Esta aplicación es exclusiva para funcionarios municipales.' });
            }
            if (error.message === 'SIN_MODULOS_ASIGNADOS') {
                return res.status(403).json({ success: false, message: 'Tu cuenta no tiene módulos asignados. Contacta al administrador.' });
            }
            if (error.message === 'USUARIO_BLOQUEADO') {
                return res.status(403).json({ success: false, message: 'El usuario se encuentra bloqueado.' });
            }
            if (error.message === 'USUARIO_INACTIVO') {
                return res.status(403).json({ success: false, message: 'El usuario se encuentra inactivo.' });
            }
            if (error.message === 'SISTEMA_NO_CONFIGURADO') {
                return res.status(500).json({ success: false, message: 'El sistema no está configurado correctamente.' });
            }
            if (error.message === 'TOKEN_INVALIDO' || error.message === 'TOKEN_SIN_EMAIL') {
                return res.status(401).json({ success: false, message: 'El token de sesión no es válido o expiró.' });
            }
            next(error);
        }
    }

    async logout(req, res, next) {
        const token = extraerBearer(req);
        if (!token) {
            return res.status(200).json({ success: true, message: 'Sesión cerrada.' });
        }

        try {
            await authService.cerrarSesion(token);
            return res.status(200).json({ success: true, message: 'Sesión cerrada correctamente.' });
        } catch (error) {
            if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
                return res.status(200).json({ success: true, message: 'Sesión cerrada.' });
            }
            next(error);
        }
    }
}

export default new AuthController();
