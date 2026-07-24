import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import usuarioRepository from '../repositories/usuario.repository.js';
import sistemaRepository from '../repositories/sistema.repository.js';
import sesionRepository from '../repositories/sesion.repository.js';
import { UsuarioModel } from '../models/usuario.model.js';
import { verificarIdTokenCognito } from '../utils/cognito-verifier.util.js';

const NOMBRE_SISTEMA = process.env.SISTEMA_NOMBRE;
const JWT_SECRET = process.env.JWT_SECRET;

class AuthService {
    // Se llama justo después de que el ciudadano confirma el código de verificación en Cognito.
    // Idempotente: si el correo ya está registrado (reintento del cliente), no falla, devuelve el existente.
    async registrarUsuarioCognito(datos) {
        const existentes = await usuarioRepository.findByEmail(datos.correo);
        if (existentes.length > 0) {
            return { ...UsuarioModel.fromDatabaseArray(existentes)[0], creado: false };
        }

        // Cognito es dueño de las credenciales reales del ciudadano; RBAC_USUARIOS exige estas
        // columnas NOT NULL/UNIQUE pero todavía no recolectamos cédula/RUC en el alta por Cognito.
        // Se guardan valores temporales, únicos y claramente marcados como pendientes, hasta que
        // exista la pantalla de "completar perfil" (onboarding) que actualice el documento real.
        const numDocumentoPendiente = `PEND${crypto.randomBytes(8).toString('hex')}`; // 20 caracteres, único
        const passwordHashPlaceholder = await bcrypt.hash(crypto.randomUUID(), 10); // nunca podrá usarse para autenticar localmente

        try {
            const idUsuario = await usuarioRepository.save({
                tipoUsuario: 'C',
                tipoDocumento: 'P',
                numDocumento: numDocumentoPendiente,
                email: datos.correo,
                passwordHash: passwordHashPlaceholder,
                nombre: datos.nombre,
                apellido: datos.apellido,
                activeDirectory: 'N'
            });

            return { idUsuario, email: datos.correo, nombre: datos.nombre, apellido: datos.apellido, creado: true };
        } catch (error) {
            if (error.errorNum === 1) {
                // ORA-00001: otra petición concurrente insertó el mismo correo justo antes.
                const usuarios = await usuarioRepository.findByEmail(datos.correo);
                if (usuarios.length > 0) return { ...UsuarioModel.fromDatabaseArray(usuarios)[0], creado: false };
            }
            throw error;
        }
    }

    // Se llama cuando el usuario hace clic en "Iniciar sesión" y Cognito ya validó su contraseña.
    // Verifica el ID Token, crea el registro de sesión (RBAC_SESIONES) y firma un JWT propio cuya
    // duración proviene de RBAC_SISTEMAS.TOKEN_EXPIRACION_MIN para el sistema BACHERITO.
    async iniciarSesion({ idTokenJwt, ipOrigen, userAgent }) {
        let claims;
        try {
            claims = await verificarIdTokenCognito(idTokenJwt);
        } catch (error) {
            // Cualquier fallo de verificación (firma, emisor, audiencia, expiración, formato) se
            // homologa a un único código de negocio; el detalle técnico solo interesa en los logs.
            console.error('❌ [Cognito ID Token inválido]:', error.message);
            throw new Error('TOKEN_INVALIDO');
        }

        const grupos = Array.isArray(claims['cognito:groups']) ? claims['cognito:groups'] : [];
        if (!grupos.includes(NOMBRE_SISTEMA)) {
            throw new Error('SIN_ACCESO_SATELITE');
        }

        const email = claims.email;
        if (!email) {
            throw new Error('TOKEN_SIN_EMAIL');
        }

        let usuarios = await usuarioRepository.findByEmail(email);

        if (usuarios.length === 0) {
            // Red de seguridad: si el alta posterior a la verificación no se completó por algún motivo,
            // se resuelve aquí mismo con los datos que trae el propio ID Token verificado.
            // OJO: Oracle guarda un VARCHAR2 vacío ('') como NULL, lo que violaría el NOT NULL
            // de NOMBRE/APELLIDO. Por eso los valores de reserva nunca deben ser cadena vacía.
            await this.registrarUsuarioCognito({
                correo: email,
                nombre: claims.given_name || claims.name || 'Ciudadano',
                apellido: claims.family_name || 'Sin apellido'
            });
            usuarios = await usuarioRepository.findByEmail(email);
        }

        const usuario = UsuarioModel.fromDatabaseArray(usuarios)[0];

        if (usuario.bloqueado === 1) {
            throw new Error('USUARIO_BLOQUEADO');
        }
        if (usuario.estado !== 'S') {
            throw new Error('USUARIO_INACTIVO');
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

        const token = jwt.sign(
            { sub: usuario.idUsuario, email: usuario.email, tipoUsuario: usuario.tipoUsuario },
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
            }
        };
    }

    // Revoca la sesión asociada al JWT propio (best-effort: un token ya inválido/expirado no es un error de negocio).
    async cerrarSesion(jwtPropio) {
        const payload = jwt.verify(jwtPropio, JWT_SECRET, { algorithms: ['HS256'] });
        await sesionRepository.revocarPorJti(payload.jti);
    }
}

export default new AuthService();
