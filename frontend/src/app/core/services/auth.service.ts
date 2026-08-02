import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, map, of, switchMap, tap } from 'rxjs';
import { CognitoService } from './cognito.service';
import { environment } from '../../../environments/environment';

// Se distingue de un error de credenciales: el login fue válido, pero el usuario
// no está asignado (por Cognito Groups) al satélite que corresponde a este frontend.
export class SinAccesoSateliteError extends Error {
  constructor() {
    super('El usuario no tiene acceso al satélite ' + environment.cognito.satelite);
    this.name = 'SinAccesoSateliteError';
  }
}

export interface Autorizacion {
  modulo: string;
  rol: string;
}

interface RespuestaLogin {
  success: boolean;
  token: string;
  expiraEn: string;
  usuario: {
    idUsuario: number;
    email: string;
    nombre: string;
    apellido: string;
    tipoUsuario: string;
  };
  autorizaciones: Autorizacion[];
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private cognitoService = inject(CognitoService);
  private http = inject(HttpClient);

  private readonly API_URL = `${environment.apiUrl}/auth`;

  // Inicializa los Signals leyendo directamente si ya existe una sesión guardada
  isLoggedIn = signal<boolean>(localStorage.getItem('isLoggedIn') === 'true');
  usuarioActual = signal<string | null>(localStorage.getItem('userEmail'));
  nombreActual = signal<string | null>(localStorage.getItem('userName'));
  telefonoActual = signal<string | null>(localStorage.getItem('userPhone'));
  // Cédula: en este User Pool el username de Cognito ES la cédula (así se configuró el alta),
  // por eso se lee del claim 'cognito:username' del ID Token en vez de pedirla aparte.
  cedulaActual = signal<string | null>(localStorage.getItem('userCedula'));
  // JWT propio (emitido por nuestro backend a partir del ID Token de Cognito), usado por el
  // interceptor HTTP para autenticar las llamadas hacia environment.apiUrl.
  appToken = signal<string | null>(localStorage.getItem('appToken'));
  // Módulos/rol que el backend autorizó para este usuario (GADMAPPS.V_AUTORIZACION_USUARIOS),
  // usado para mostrar/ocultar pantallas y por los guards de ruta.
  autorizaciones = signal<Autorizacion[]>(JSON.parse(localStorage.getItem('autorizaciones') || '[]'));

  tieneAcceso(modulo: string): boolean {
    return this.autorizaciones().some((autorizacion) => autorizacion.modulo === modulo);
  }

  // Llamado por la pantalla de validación justo después de confirmar el código de Cognito,
  // para dar de alta al funcionario en RBAC_USUARIOS (requiere que la cédula exista en la
  // vista institucional de funcionarios; el backend rechaza el alta si no).
  registrarUsuarioBackend(datos: { correo: string; cedula: string; nombre: string; apellido: string }): Observable<void> {
    return this.http.post<void>(`${this.API_URL}/registro-cognito`, datos);
  }

  login(usuario: string, contrasena: string): Observable<boolean> {
    return this.cognitoService.iniciarSesion(usuario, contrasena).pipe(
      switchMap((session) => {
        const grupos = this.cognitoService.obtenerGruposDeSesion(session);

        if (!grupos.includes(environment.cognito.satelite)) {
          throw new SinAccesoSateliteError();
        }

        const idTokenJwt = session.getIdToken().getJwtToken();
        const payload = session.getIdToken().payload;
        const correo = (payload['email'] as string | undefined) ?? usuario;
        const nombre = (payload['name'] as string | undefined) ?? '';
        const telefono = (payload['phone_number'] as string | undefined) ?? '';
        const cedula = (payload['cognito:username'] as string | undefined) ?? '';

        const headers = new HttpHeaders({ Authorization: `Bearer ${idTokenJwt}` });

        return this.http.post<RespuestaLogin>(`${this.API_URL}/login`, {}, { headers }).pipe(
          tap((respuesta) => {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userEmail', correo);
            localStorage.setItem('userName', nombre);
            localStorage.setItem('userPhone', telefono);
            localStorage.setItem('userCedula', cedula);
            localStorage.setItem('appToken', respuesta.token);
            localStorage.setItem('appTokenExpira', respuesta.expiraEn);
            localStorage.setItem('autorizaciones', JSON.stringify(respuesta.autorizaciones));

            this.isLoggedIn.set(true);
            this.usuarioActual.set(correo);
            this.nombreActual.set(nombre);
            this.telefonoActual.set(telefono);
            this.cedulaActual.set(cedula);
            this.appToken.set(respuesta.token);
            this.autorizaciones.set(respuesta.autorizaciones);
          }),
          map(() => true)
        );
      })
    );
  }

  logout() {
    const token = this.appToken();

    const limpiar = () => {
      // Cierra la sesión en Cognito (invalida los tokens cacheados por el SDK) y limpia nuestro propio estado
      this.cognitoService.cerrarSesion();

      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userName');
      localStorage.removeItem('userPhone');
      localStorage.removeItem('userCedula');
      localStorage.removeItem('appToken');
      localStorage.removeItem('appTokenExpira');
      localStorage.removeItem('autorizaciones');
      this.isLoggedIn.set(false);
      this.usuarioActual.set(null);
      this.nombreActual.set(null);
      this.telefonoActual.set(null);
      this.cedulaActual.set(null);
      this.appToken.set(null);
      this.autorizaciones.set([]);
    };

    if (!token) {
      limpiar();
      return;
    }

    // Revoca la sesión en RBAC_SESIONES; si la llamada falla (sin red, backend caído) igual
    // cerramos la sesión localmente, no debe bloquear al usuario para salir de la app.
    this.http.post(`${this.API_URL}/logout`, {}, {
      headers: new HttpHeaders({ Authorization: `Bearer ${token}` })
    }).pipe(
      catchError(() => of(null))
    ).subscribe(() => limpiar());
  }
}
