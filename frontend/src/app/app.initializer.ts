import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { CognitoService } from './core/services/cognito.service';
import { AuthService } from './core/services/auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../environments/environment';

/**
 * Servicio que valida la autenticación al arrancar la aplicación.
 * - Verifica si existe un token JWT válido en localStorage
 * - Verifica si la sesión de Cognito es válida
 * - Valida que el backend esté disponible (health check)
 *
 * Resultado:
 * - Token válido + Cognito válido → rutea a /home
 * - Token inválido o expirado → limpia y rutea a /login
 * - Backend no disponible → asume el usuario está autenticado localmente
 */
@Injectable({
  providedIn: 'root'
})
export class AppInitializerService {
  private cognitoService = inject(CognitoService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private http = inject(HttpClient);

  async validarAutenticacion(): Promise<void> {
    try {
      // 0. Rutas de retorno de OAuth2: NO tocar la navegación.
      // El APP_INITIALIZER corre antes de que se monte ningún componente, y en el callback
      // todavía no existe 'appToken' en localStorage (lo crea AuthCallbackComponent tras canjear
      // el código). Sin esta excepción se redirigía a /login, descartando el ?code=... de la URL:
      // el componente nunca se montaba y el backend nunca recibía la petición.
      if (this.esRutaDeCallbackOAuth()) {
        return;
      }

      // 1. Verificar si existe token en localStorage
      const appToken = localStorage.getItem('appToken');
      const tokenExpira = localStorage.getItem('appTokenExpira');

      if (!appToken || !tokenExpira) {
        // No hay token: usuario no autenticado
        await this.router.navigate(['/login']);
        return;
      }

      // 2. Verificar si el token no está expirado
      const expiraEn = new Date(tokenExpira);
      if (new Date() > expiraEn) {
        // Token expirado: limpiar y redirigir a login
        this.authService.logout();
        await this.router.navigate(['/login']);
        return;
      }

      // 3. Validar la sesión del SDK de Cognito (renueva refresh token si es necesario).
      // Solo aplica al login local con email + contraseña: en el login federado con
      // Microsoft/Azure los tokens nunca pasan por amazon-cognito-identity-js, así que
      // sesionValida() sería false y expulsaría al usuario pese a tener un JWT propio vigente.
      const sesionValida = await firstValueFrom(this.cognitoService.sesionValida());

      if (!sesionValida && !this.authService.tieneTokenPropioValido()) {
        // Sesión de Cognito inválida y sin JWT propio: limpiar y redirigir a login
        this.authService.logout();
        await this.router.navigate(['/login']);
        return;
      }

      // 4. Hacer ping al backend para verificar disponibilidad (timeout 3 segundos)
      try {
        await firstValueFrom(
          this.http.get(`${environment.apiUrl}/health`, {
            headers: new HttpHeaders({ Authorization: `Bearer ${appToken}` })
          }).pipe(timeout(3000))
        );
      } catch (error) {
        // Backend no disponible, pero el token es válido localmente
        // Permitir que el usuario continúe offline
        console.warn('Backend no disponible, continuando con sesión local', error);
      }

      // 5. Token, Cognito y backend (si está disponible) son válidos.
      // Solo se fuerza /home cuando se arrancó en la raíz; si el usuario abrió un deep link
      // (ej. /perfil) se respeta su destino, que ya está protegido por authGuard.
      if (this.esRutaRaiz()) {
        await this.router.navigate(['/home']);
      }

    } catch (error) {
      // Si algo falla de forma inesperada, ir a login
      console.error('Error durante validación de autenticación:', error);
      this.authService.logout();
      await this.router.navigate(['/login']);
    }
  }

  // Se lee de window.location y no del Router porque en el APP_INITIALIZER el router
  // todavía no ha resuelto ninguna ruta.
  private esRutaDeCallbackOAuth(): boolean {
    return window.location.pathname.startsWith('/auth/callback');
  }

  private esRutaRaiz(): boolean {
    const ruta = window.location.pathname;
    return ruta === '/' || ruta === '';
  }
}

/**
 * Factory function para usar en appConfig.providers
 * Retorna una Promise que se resuelve cuando la validación está completa
 */
export function initializeApp(appInitializer: AppInitializerService) {
  return () => appInitializer.validarAutenticacion();
}
