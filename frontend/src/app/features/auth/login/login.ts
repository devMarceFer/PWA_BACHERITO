import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

/**
 * LoginComponent: Pantalla de acceso con dos opciones:
 * 1. Iniciar sesión con Microsoft (Cognito/Azure)
 * 2. Email + Contraseña (autenticación local)
 *
 * Flujo:
 * - Microsoft: Redirige a Cognito → /auth/callback → /home
 * - Email: POST /api/auth/login → genera JWT → /home
 * - Crear cuenta: Click "Crea ahora" → /crear-cuenta
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './login.html'
})
export class LoginComponent {
  private router = inject(Router);
  private authService = inject(AuthService);

  usuario = signal('');
  contrasena = signal('');
  ocultarContrasena = signal(true);
  cargando = signal(false);
  errorLogin = signal<string | null>(null);

  toggleVisibilidad() {
    this.ocultarContrasena.update(v => !v);
  }

  async loginConAzure() {
    this.cargando.set(true);
    this.errorLogin.set(null);

    try {
      // Redirigir directamente a Azure AD (federated login)
      // El tenant, client_id y redirect_uri están configurados en Azure AD
      this.iniciarSesionConAzure();
    } catch (error) {
      this.cargando.set(false);
      this.errorLogin.set('Error al conectar con Microsoft. Intenta de nuevo.');
      console.error('Error en loginConAzure:', error);
    }
  }

  onSubmit(event?: Event) {
    if (event) event.preventDefault();
    if (!this.usuario() || !this.contrasena()) return;

    this.cargando.set(true);
    this.errorLogin.set(null);

    this.authService.login(this.usuario(), this.contrasena()).subscribe({
      next: (success) => {
        this.cargando.set(false);
        if (success) {
          this.router.navigate(['/home']);
        } else {
          this.errorLogin.set('Credenciales incorrectas. Intenta de nuevo.');
        }
      },
      error: (err) => {
        this.cargando.set(false);
        this.errorLogin.set(err?.error?.message || 'Error al iniciar sesión.');
      }
    });
  }

  irACrearCuenta() {
    this.router.navigate(['/crear-cuenta']);
  }

  private getCognitoDomain(): string {
    return environment.cognito.oauth.domain;
  }

  private getCognitoClientId(): string {
    return environment.cognito.clientId;
  }

  private getRedirectUri(): string {
    // Debe coincidir EXACTAMENTE con una de las "Callback URLs" registradas en el App Client
    // de Cognito y con el redirect_uri que el backend usa al canjear el código.
    return encodeURIComponent(environment.cognito.oauth.redirectSignIn);
  }

  private iniciarSesionConAzure(): void {
    // Flujo OAuth2 Authorization Code Grant contra Cognito, con federación a Azure AD.
    //
    // IMPORTANTE: no se debe ir directo a login.microsoftonline.com apuntando el redirect_uri
    // al /oauth2/idpresponse de Cognito. Ese endpoint solo acepta un `state` generado por el
    // propio Cognito (es donde viaja el app client y la callback URL original); con un state
    // propio Cognito no sabe a dónde devolver al usuario y la autenticación falla.
    // El punto de entrada correcto es /oauth2/authorize con identity_provider=<IdP de Azure>,
    // que es quien redirige a Azure AD y luego devuelve el código a /auth/callback.

    const domain = this.getCognitoDomain();
    const clientId = this.getCognitoClientId();
    const redirectUri = this.getRedirectUri();
    const scope = encodeURIComponent('openid email profile');
    const identityProvider = encodeURIComponent(environment.cognito.oauth.identityProvider);

    // State para protección CSRF: se guarda para poder validarlo en /auth/callback
    const state = this.generarState();
    sessionStorage.setItem('oauth_state', state);

    window.location.href =
      `https://${domain}/oauth2/authorize?client_id=${clientId}&response_type=code&scope=${scope}&redirect_uri=${redirectUri}&identity_provider=${identityProvider}&state=${state}`;
  }

  private generarState(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
}