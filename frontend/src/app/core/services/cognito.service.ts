import { Injectable, signal } from '@angular/core';
import { Observable, Subscriber } from 'rxjs';
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  CognitoUserSession
} from 'amazon-cognito-identity-js';
import { environment } from '../../../environments/environment';
import { CrearCuentaCognito } from '../../features/cognito/models/crear-cuenta-cognito.model';

@Injectable({
  providedIn: 'root'
})
export class CognitoService {
  private readonly userPool = new CognitoUserPool({
    UserPoolId: environment.cognito.userPoolId,
    ClientId: environment.cognito.clientId
  });

  // Correo pendiente de verificación, compartido entre las pantallas crear -> validar
  correoPendiente = signal<string | null>(null);
  // Username de Cognito (la cédula/RUC/pasaporte del formulario) pendiente de confirmar
  private usuarioPendiente: string | null = null;
  // Nombre/apellido pendientes: Cognito no los expone hasta que el usuario inicia sesión,
  // pero la pantalla de validación los necesita de inmediato para darlos de alta en RBAC_USUARIOS.
  private nombrePendiente: string | null = null;
  private apellidoPendiente: string | null = null;

  crearCuenta(datos: CrearCuentaCognito): Observable<boolean> {
    return new Observable(observer => {
      const atributos = [
        new CognitoUserAttribute({ Name: 'email', Value: datos.correo }),
        new CognitoUserAttribute({ Name: 'given_name', Value: datos.primerNombre }),
        new CognitoUserAttribute({ Name: 'family_name', Value: datos.primerApellido }),
        new CognitoUserAttribute({ Name: 'name', Value: `${datos.primerNombre} ${datos.primerApellido}` }),
        new CognitoUserAttribute({ Name: 'phone_number', Value: this.aFormatoE164(datos.telefono) })
      ];

      this.userPool.signUp(
        datos.cedula,
        datos.contrasena,
        atributos,
        [],
        (error) => {
          if (error) {
            observer.error(error);
            return;
          }

          this.usuarioPendiente = datos.cedula;
          this.nombrePendiente = datos.primerNombre;
          this.apellidoPendiente = datos.primerApellido;
          this.correoPendiente.set(datos.correo);
          observer.next(true);
          observer.complete();
        }
      );
    });
  }

  // Datos recolectados durante el registro, disponibles justo después de confirmar el código de verificación.
  // La cédula es el mismo valor usado como Username de Cognito (usuarioPendiente).
  obtenerDatosPendientes(): { correo: string; cedula: string; nombre: string; apellido: string } | null {
    const correo = this.correoPendiente();
    if (!correo || !this.usuarioPendiente || !this.nombrePendiente || !this.apellidoPendiente) return null;
    return { correo, cedula: this.usuarioPendiente, nombre: this.nombrePendiente, apellido: this.apellidoPendiente };
  }

  // Admite tanto el nombreUsuario de Cognito como el correo (el User Pool tiene el email configurado como alias de inicio de sesión)
  iniciarSesion(usuarioOCorreo: string, contrasena: string): Observable<CognitoUserSession> {
    return new Observable(observer => {
      const cognitoUser = new CognitoUser({ Username: usuarioOCorreo, Pool: this.userPool });
      const detallesAuth = new AuthenticationDetails({ Username: usuarioOCorreo, Password: contrasena });

      cognitoUser.authenticateUser(detallesAuth, {
        onSuccess: (session) => {
          observer.next(session);
          observer.complete();
        },
        onFailure: (error) => {
          observer.error(error);
        }
      });
    });
  }

  // Los "satélites" (Bacherito, Mascotas, NovenoFotoradar) son Grupos de Cognito;
  // el ID token trae la lista de grupos a los que el usuario fue asignado por el administrador.
  obtenerGruposDeSesion(session: CognitoUserSession): string[] {
    const grupos = session.getIdToken().payload['cognito:groups'];
    return Array.isArray(grupos) ? grupos : [];
  }

  // Revalida la sesión cacheada por el SDK (renueva el access token si el refresh token sigue vigente).
  sesionValida(): Observable<boolean> {
    return new Observable(observer => {
      const usuarioActual = this.userPool.getCurrentUser();
      if (!usuarioActual) {
        observer.next(false);
        observer.complete();
        return;
      }

      usuarioActual.getSession((error: Error | null, session: CognitoUserSession | null) => {
        observer.next(!error && !!session && session.isValid());
        observer.complete();
      });
    });
  }

  // Cierra la sesión local del SDK (borra los tokens que amazon-cognito-identity-js cachea en localStorage).
  cerrarSesion(): void {
    this.userPool.getCurrentUser()?.signOut();
  }

  verificarCodigo(codigo: string): Observable<boolean> {
    return new Observable(observer => {
      const usuarioCognito = this.obtenerUsuarioPendiente(observer);
      if (!usuarioCognito) return;

      usuarioCognito.confirmRegistration(codigo, true, (error) => {
        if (error) {
          observer.error(error);
          return;
        }
        observer.next(true);
        observer.complete();
      });
    });
  }

  reenviarCodigo(): Observable<boolean> {
    return new Observable(observer => {
      const usuarioCognito = this.obtenerUsuarioPendiente(observer);
      if (!usuarioCognito) return;

      usuarioCognito.resendConfirmationCode((error) => {
        if (error) {
          observer.error(error);
          return;
        }
        observer.next(true);
        observer.complete();
      });
    });
  }

  private obtenerUsuarioPendiente(observer: Subscriber<boolean>): CognitoUser | null {
    if (!this.usuarioPendiente) {
      observer.error(new Error('No hay ningún registro pendiente de verificación.'));
      return null;
    }

    return new CognitoUser({
      Username: this.usuarioPendiente,
      Pool: this.userPool
    });
  }

  // Cognito exige formato E.164 (+<código país><número>); convierte números locales ecuatorianos (0987654321 -> +593987654321)
  private aFormatoE164(telefono: string): string {
    const limpio = telefono.trim();
    if (limpio.startsWith('+')) return limpio;
    return `+593${limpio.replace(/^0/, '')}`;
  }
}
