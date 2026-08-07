import authService from '../services/auth.service.js';
import { UsuarioModel } from '../models/usuario.model.js';
import { extraerBearer } from '../utils/bearer.util.js';

const ORIGENES_PERMITIDOS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map(origen => origen.trim())
    .filter(Boolean);

// Determina el redirect_uri que se usó al iniciar el flujo OAuth2 en el navegador. Cognito exige
// que el redirect_uri del canje del código sea idéntico al de /oauth2/authorize.
// IMPORTANTE: Este valor DEBE coincidir EXACTAMENTE con lo registrado en Cognito.
function resolverRedirectUri(req) {
    // Si está configurado en .env, usarlo directamente (es la forma más confiable)
    if (process.env.OAUTH_REDIRECT_URI) {
        const redirectUri = process.env.OAUTH_REDIRECT_URI.trim();
        console.log(`✅ [OAuth] redirect_uri desde .env: ${redirectUri}`);
        return redirectUri;
    }

    // Fallback: construir desde el origen de la petición
    const origen = req.get('origin');
    if (origen && ORIGENES_PERMITIDOS.includes(origen)) {
        const fallback = `${origen}/auth/callback`;
        console.log(`✅ [OAuth] redirect_uri desde origin: ${fallback}`);
        return fallback;
    }

    // Último recurso: usar el primer origen permitido
    const ultimo = `${ORIGENES_PERMITIDOS[0]}/auth/callback`;
    console.log(`✅ [OAuth] redirect_uri desde ALLOWED_ORIGINS[0]: ${ultimo}`);
    return ultimo;
}

// Mapa centralizado de códigos de error de autenticación
const ERRORES_AUTH = {
    'SIN_ACCESO_SATELITE': { status: 403, message: 'El usuario no tiene acceso a esta aplicación.' },
    'SOLO_FUNCIONARIOS': { status: 403, message: 'Esta aplicación es exclusiva para funcionarios municipales.' },
    'SIN_MODULOS_ASIGNADOS': { status: 403, message: 'Tu cuenta no tiene módulos asignados. Contacta al administrador.' },
    'USUARIO_BLOQUEADO': { status: 403, message: 'El usuario se encuentra bloqueado.' },
    'USUARIO_INACTIVO': { status: 403, message: 'El usuario se encuentra inactivo.' },
    'SISTEMA_NO_CONFIGURADO': { status: 500, message: 'El sistema no está configurado correctamente.' },
    'TOKEN_INVALIDO': { status: 401, message: 'El token de sesión no es válido o expiró.' },
    'TOKEN_SIN_EMAIL': { status: 401, message: 'El token de sesión no es válido o expiró.' },
    'USUARIO_NO_REGISTRADO': { status: 403, message: 'El usuario no está registrado en esta aplicación.' },
    'ERROR_COGNITO': { status: 401, message: 'Error en la autenticación con Cognito. Intenta de nuevo.' }
};

class AuthController {
    // Maneja errores de autenticación de forma centralizada
    manejarErrorAuth(error, res, next) {
        const errorConfig = ERRORES_AUTH[error.message];
        if (errorConfig) {
            return res.status(errorConfig.status).json({ success: false, message: errorConfig.message });
        }
        // Caso especial: errores de Cognito que incluyen texto específico
        if (typeof error.message === 'string' && error.message.includes('intercambiar código')) {
            const config = ERRORES_AUTH['ERROR_COGNITO'];
            return res.status(config.status).json({ success: false, message: config.message });
        }
        next(error);
    }
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
            this.manejarErrorAuth(error, res, next);
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

    async verificarSesion(req, res, next) {
        try {
            // requireAuth ya valida que el token sea válido y que la sesión no esté revocada
            // en RBAC_SESIONES. Si llegamos aquí, la sesión es válida.
            const usuario = req.usuario;
            return res.status(200).json({
                success: true,
                message: 'Sesión válida',
                usuario: {
                    idUsuario: usuario.sub,
                    email: usuario.email,
                    tipoUsuario: usuario.tipoUsuario
                },
                autorizaciones: usuario.modulos
            });
        } catch (error) {
            next(error);
        }
    }

    async manejarCallbackCognito(req, res, next) {
        try {
            const { code, state } = req.body;

            if (!code) {
                return res.status(400).json({
                    success: false,
                    message: 'El código de autorización es requerido.'
                });
            }

            // Validación de state para proteger contra CSRF: el cliente debe enviar el state
            // generado en /oauth2/authorize. Si no coincide, rechazar la petición.
            if (state) {
                // En este caso, solo se valida su presencia. El cliente es responsable de validar
                // que coincida con el guardado en sessionStorage. El backend no mantiene estado de sesión.
                console.log(`✅ [OAuth] State recibido: ${state.substring(0, 10)}...`);
            }

            // El redirect_uri debe ser BYTE A BYTE el mismo que se envió a /oauth2/authorize,
            // es decir el del FRONTEND (http://localhost:4201/auth/callback), no el host del
            // backend. Se toma el configurado en .env para máxima confiabilidad.
            const redirectUri = resolverRedirectUri(req);

            const tokens = await authService.intercambiarCodigoPorTokens(code, redirectUri);

            const resultado = await authService.iniciarSesion({
                idTokenJwt: tokens.idToken,
                ipOrigen: req.ip,
                userAgent: req.headers['user-agent']
            });

            return res.status(200).json({
                success: true,
                ...resultado
            });
        } catch (error) {
            this.manejarErrorAuth(error, res, next);
        }
    }
}

export default new AuthController();
