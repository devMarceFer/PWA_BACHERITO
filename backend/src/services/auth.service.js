import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import usuarioRepository from '../repositories/usuario.repository.js';
import sistemaRepository from '../repositories/sistema.repository.js';
import sesionRepository from '../repositories/sesion.repository.js';
import autorizacionService from './autorizacion.service.js';
import funcionarioService from './funcionario.service.js';
import { UsuarioModel } from '../models/usuario.model.js';
import { verificarIdTokenCognito } from '../utils/cognito-verifier.util.js';

const NOMBRE_SISTEMA = process.env.SISTEMA_NOMBRE;
const JWT_SECRET = process.env.JWT_SECRET;
const COGNITO_DOMAIN = process.env.COGNITO_DOMAIN;
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID;
const COGNITO_CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET;

class AuthService {
    // Se llama justo después de que el funcionario confirma el código de verificación en Cognito.
    // Bacherito es exclusiva para funcionarios municipales: la cédula debe existir en la vista
    // institucional de funcionarios, si no, se rechaza el alta. Idempotente: si el correo ya está
    // registrado (reintento del cliente), no falla, devuelve el existente.
    async registrarUsuarioCognito(datos) {
        const existentes = await usuarioRepository.findByEmail(datos.correo);
        if (existentes.length > 0) {
            return { ...UsuarioModel.fromDatabaseArray(existentes)[0], creado: false };
        }

        let funcionario = null;
        let nombre = datos.nombre;
        let apellido = datos.apellido;

        // Intenta obtener datos del funcionario desde VW_TH_FUNCIONARIOS
        // Si no existe, permite el registro igualmente (usuario ya tendrá permisos en RBAC)
        try {
            funcionario = await funcionarioService.buscarPorCedula(datos.cedula);
            nombre = funcionario.nombres || datos.nombre;
            apellido = funcionario.apellidos || datos.apellido;
            console.log(`✅ [Registro] Funcionario encontrado en VW_TH_FUNCIONARIOS: ${datos.cedula}`);
        } catch (error) {
            console.warn(`⚠️ [Registro] Funcionario NO encontrado en VW_TH_FUNCIONARIOS (${datos.cedula}), pero permitiendo registro. Usuario deberá tener módulos asignados en RBAC.`);
            // No lanzar error - permitir que se registre si ya tiene permisos
        }

        // Los datos de identidad se toman de VW_TH_FUNCIONARIOS si existen,
        // sino se usan los datos que envía el cliente
        const passwordHashPlaceholder = await bcrypt.hash(crypto.randomUUID(), 10); // nunca podrá usarse para autenticar localmente

        try {
            const idUsuario = await usuarioRepository.save({
                tipoUsuario: 'F',
                tipoDocumento: 'C',
                numDocumento: datos.cedula,
                email: datos.correo,
                passwordHash: passwordHashPlaceholder,
                nombre,
                apellido,
                activeDirectory: 'N'
            });

            return { idUsuario, email: datos.correo, nombre, apellido, creado: true };
        } catch (error) {
            if (error.errorNum === 1) {
                // ORA-00001: puede ser el mismo correo insertado justo antes por otra petición
                // concurrente, o esta misma cédula ya registrada bajo otro correo.
                const usuarios = await usuarioRepository.findByEmail(datos.correo);
                if (usuarios.length > 0) return { ...UsuarioModel.fromDatabaseArray(usuarios)[0], creado: false };
                throw new Error('CEDULA_YA_REGISTRADA');
            }
            throw error;
        }
    }

    // Se llama cuando el usuario hace clic en "Iniciar sesión" y Cognito ya validó su contraseña.
    // Verifica el ID Token, crea el registro de sesión (RBAC_SESIONES) y firma un JWT propio cuya
    // duración proviene de RBAC_SISTEMAS.TOKEN_EXPIRACION_MIN para el sistema BACHERITO.
    async iniciarSesion({ idTokenJwt, ipOrigen, userAgent }) {
        console.log(`🔐 [Login] Iniciando sesión...`);
        let claims;
        try {
            claims = await verificarIdTokenCognito(idTokenJwt);
        } catch (error) {
            // Cualquier fallo de verificación (firma, emisor, audiencia, expiración, formato) se
            // homologa a un único código de negocio; el detalle técnico solo interesa en los logs.
            console.error('❌ [Cognito ID Token inválido]:', error.message);
            throw new Error('TOKEN_INVALIDO');
        }

        const email = (claims.email || '').trim().toLowerCase();
        console.log(`📧 [Login] Email del token: ${email}`);

        const grupos = Array.isArray(claims['cognito:groups']) ? claims['cognito:groups'] : [];
        console.log(`👥 [Login] Grupos de Cognito: [${grupos.join(', ')}]`);
        if (!grupos.includes(NOMBRE_SISTEMA)) {
            console.error(`❌ [Login] Usuario ${email} NO está en grupo ${NOMBRE_SISTEMA}`);
            throw new Error('SIN_ACCESO_SATELITE');
        }

        if (!email) {
            throw new Error('TOKEN_SIN_EMAIL');
        }

        let usuarios = await usuarioRepository.findByEmail(email);

        if (usuarios.length === 0) {
            // Red de seguridad: si el alta posterior a la verificación no se completó por algún motivo,
            // se resuelve aquí mismo con los datos que trae el propio ID Token verificado.
            // Para usuarios federados (Azure AD), cognito:username puede ser un GUID (>20 chars)
            // que no cabe en NUM_DOCUMENTO VARCHAR2(20), causando ORA-12899.
            try {
                await this.registrarUsuarioCognito({
                    correo: email,
                    cedula: claims['cognito:username'],
                    nombre: claims.given_name || claims.name || 'Ciudadano',
                    apellido: claims.family_name || 'Sin apellido'
                });
            } catch (error) {
                // ORA-12899 = tamaño de columna insuficiente (usuario federado con username tipo GUID)
                if (error.errorNum === 12899) {
                    console.error(`❌ [Auto-registro] Username de Cognito demasiado largo (federado/Azure): ${claims['cognito:username']}`);
                    throw new Error('USUARIO_NO_REGISTRADO');
                }
                console.error(`❌ [Auto-registro] Error al registrar: ${error.message}`);
                throw new Error('USUARIO_NO_REGISTRADO');
            }
            usuarios = await usuarioRepository.findByEmail(email);
        }

        const usuario = UsuarioModel.fromDatabaseArray(usuarios)[0];
        console.log(`📋 [Login] Usuario encontrado: ${usuario.email} (ID: ${usuario.idUsuario}, Tipo: ${usuario.tipoUsuario}, Bloqueado: ${usuario.bloqueado}, Estado: ${usuario.estado})`);

        if (usuario.bloqueado === 1) {
            console.error(`❌ [Login] USUARIO_BLOQUEADO: ${usuario.email}`);
            throw new Error('USUARIO_BLOQUEADO');
        }
        if (usuario.estado !== 'S') {
            console.error(`❌ [Login] USUARIO_INACTIVO: ${usuario.email} (estado: ${usuario.estado})`);
            throw new Error('USUARIO_INACTIVO');
        }
        // Bacherito es exclusiva para funcionarios municipales: un ciudadano (registrado antes de
        // este cambio, o dado de alta por otra vía) no puede iniciar sesión aunque su cuenta esté activa.
        if (usuario.tipoUsuario !== 'F') {
            console.error(`❌ [Login] SOLO_FUNCIONARIOS: ${usuario.email} (tipo: ${usuario.tipoUsuario})`);
            throw new Error('SOLO_FUNCIONARIOS');
        }

        const autorizaciones = await autorizacionService.obtenerAutorizaciones(usuario.idUsuario);
        console.log(`📋 [Login] Autorizaciones obtenidas para ${usuario.email}: ${autorizaciones.length} módulos`);
        if (autorizaciones.length === 0) {
            console.error(`❌ [Login] SIN_MODULOS_ASIGNADOS: ${usuario.email}`);
            throw new Error('SIN_MODULOS_ASIGNADOS');
        }

        const sistemas = await sistemaRepository.findByNombre(NOMBRE_SISTEMA);
        if (sistemas.length === 0) {
            throw new Error('SISTEMA_NO_CONFIGURADO');
        }
        const tokenExpiracionMin = sistemas[0].TOKEN_EXPIRACION_MIN;
        if (!tokenExpiracionMin || tokenExpiracionMin <= 0) {
            throw new Error('SISTEMA_NO_CONFIGURADO');
        }

        const jti = crypto.randomUUID();
        const expiraEn = new Date(Date.now() + tokenExpiracionMin * 60 * 1000);
        const modulos = autorizaciones.map(autorizacion => ({ m: autorizacion.modulo, r: autorizacion.rol }));

        const token = jwt.sign(
            { sub: usuario.idUsuario, email: usuario.email, tipoUsuario: usuario.tipoUsuario, modulos },
            JWT_SECRET,
            { algorithm: 'HS256', expiresIn: tokenExpiracionMin * 60, jwtid: jti }
        );

        await sesionRepository.save({
            idUsuario: usuario.idUsuario,
            tokenJti: jti,
            ipOrigen: (ipOrigen || '').slice(0, 45),
            userAgent: (userAgent || '').slice(0, 500),
            expiraEn
        });

        await usuarioRepository.updateUltimoAcceso(usuario.idUsuario);

        return {
            token,
            expiraEn: expiraEn.toISOString(),
            usuario: {
                idUsuario: usuario.idUsuario,
                email: usuario.email,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                tipoUsuario: usuario.tipoUsuario
            },
            autorizaciones
        };
    }

    // Revoca la sesión asociada al JWT propio (best-effort: un token ya inválido/expirado no es un error de negocio).
    async cerrarSesion(jwtPropio) {
        const payload = jwt.verify(jwtPropio, JWT_SECRET, { algorithms: ['HS256'] });
        await sesionRepository.revocarPorJti(payload.jti);
    }

    // Intercambia el código de autorización OAuth2 recibido de Cognito por tokens (id_token, access_token, refresh_token).
    // Este es el paso 2 del flujo Authorization Code Grant con Cognito Hosted UI / Azure AD federation.
    async intercambiarCodigoPorTokens(code, redirectUri) {
        if (!code) {
            throw new Error('El código de autorización es requerido');
        }

        if (!redirectUri) {
            throw new Error('El redirect_uri es requerido');
        }
        if (!COGNITO_DOMAIN || !COGNITO_CLIENT_ID) {
            throw new Error('Faltan COGNITO_DOMAIN o COGNITO_CLIENT_ID en la configuración');
        }

        const tokenUrl = `https://${COGNITO_DOMAIN}/oauth2/token`;

        const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
        const params = {
            grant_type: 'authorization_code',
            client_id: COGNITO_CLIENT_ID,
            code,
            redirect_uri: redirectUri,
        };

        // Si el App Client tiene secreto, Cognito exige autenticación HTTP Basic. Si no lo tiene,
        // enviar una cabecera Basic con secreto vacío hace que rechace la petición, así que se
        // autentica solo con el client_id del cuerpo.
        if (COGNITO_CLIENT_SECRET) {
            headers.Authorization = 'Basic ' + Buffer.from(
                `${COGNITO_CLIENT_ID}:${COGNITO_CLIENT_SECRET}`
            ).toString('base64');
        }

        try {
            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers,
                body: new URLSearchParams(params).toString(),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Cognito token exchange error:', response.status, errorData);
                throw new Error(`Cognito rechazó el intercambio: ${errorData.error || response.statusText}`);
            }

            const data = await response.json();
            if (!data.id_token) {
                throw new Error('Cognito no devolvió id_token (revisa que el scope openid esté habilitado)');
            }

            return {
                idToken: data.id_token,
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
            };
        } catch (error) {
            console.error('Error intercambiando código por tokens:', error.message);
            throw new Error(`Fallo al intercambiar código de autorización: ${error.message}`);
        }
    }
}

export default new AuthService();
