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

        let funcionario;
        try {
            funcionario = await funcionarioService.buscarPorCedula(datos.cedula);
        } catch (error) {
            throw new Error('NO_ES_FUNCIONARIO');
        }

        // Los datos de identidad se toman de la vista institucional, no de lo que envía el
        // cliente, para que una petición manipulada no pueda registrar un nombre/apellido falso.
        const nombre = funcionario.nombres || datos.nombre;
        const apellido = funcionario.apellidos || datos.apellido;
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
            // se resuelve aquí mismo con los datos que trae el propio ID Token verificado. El username
            // de Cognito ES la cédula (así se configuró el alta), por eso sirve para la validación de funcionario.
            try {
                await this.registrarUsuarioCognito({
                    correo: email,
                    cedula: claims['cognito:username'],
                    nombre: claims.given_name || claims.name || 'Ciudadano',
                    apellido: claims.family_name || 'Sin apellido'
                });
            } catch (error) {
                throw new Error('SOLO_FUNCIONARIOS');
            }
            usuarios = await usuarioRepository.findByEmail(email);
        }

        const usuario = UsuarioModel.fromDatabaseArray(usuarios)[0];

        if (usuario.bloqueado === 1) {
            throw new Error('USUARIO_BLOQUEADO');
        }
        if (usuario.estado !== 'S') {
            throw new Error('USUARIO_INACTIVO');
        }
        // Bacherito es exclusiva para funcionarios municipales: un ciudadano (registrado antes de
        // este cambio, o dado de alta por otra vía) no puede iniciar sesión aunque su cuenta esté activa.
        if (usuario.tipoUsuario !== 'F') {
            throw new Error('SOLO_FUNCIONARIOS');
        }

        const autorizaciones = await autorizacionService.obtenerAutorizaciones(usuario.idUsuario);
        if (autorizaciones.length === 0) {
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
}

export default new AuthService();
