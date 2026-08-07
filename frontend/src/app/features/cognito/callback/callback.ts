import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

interface RespuestaCallback {
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
  autorizaciones: Array<{ modulo: string; rol: string }>;
}

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="flex h-[100dvh] w-screen flex-col items-center justify-between bg-gradient-to-br from-primary-hover via-primary to-black p-8 box-border overflow-hidden select-none text-center">
      <div></div>
      <div class="flex flex-col items-center gap-6 animate-fade-in-up">
        <div class="space-y-1.5">
          <h1 class="text-2xl font-extrabold tracking-wide text-on-primary">
            Completando autenticación
          </h1>
          <p class="text-lg font-medium text-blue-200">
            Por favor espera...
          </p>
        </div>
      </div>
      <div class="pb-6">
        <div class="h-9 w-9 animate-spin rounded-full border-[3px] border-white/25 border-t-white"></div>
      </div>
    </div>
  `
})
export class AuthCallbackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  ngOnInit() {
    this.procesarCallback();
  }

  private async procesarCallback(): Promise<void> {
    try {
      const code = this.route.snapshot.queryParamMap.get('code');
      const state = this.route.snapshot.queryParamMap.get('state');
      const error = this.route.snapshot.queryParamMap.get('error');
      const errorDescription = this.route.snapshot.queryParamMap.get('error_description');

      if (error) {
        console.error('Error de Cognito:', error, errorDescription);
        await this.router.navigate(['/login'], {
          queryParams: { error: error }
        });
        return;
      }

      if (!code) {
        console.error('No se recibió código de autorización');
        await this.router.navigate(['/login']);
        return;
      }

      // Validación CSRF: el state debe coincidir con el generado antes de redirigir a Cognito.
      const stateEsperado = sessionStorage.getItem('oauth_state');
      sessionStorage.removeItem('oauth_state');
      if (!stateEsperado || state !== stateEsperado) {
        console.error('State OAuth no coincide; posible CSRF o sessionStorage limpio');
        await this.router.navigate(['/login'], { queryParams: { error: 'state_invalido' } });
        return;
      }

      // Enviar code y state al backend mediante POST para evitar exposición en logs/historial del navegador
      const response = await this.http.post<RespuestaCallback>(`${environment.apiUrl}/auth/callback`, {
        code,
        state,
        redirect_uri: environment.cognito.oauth.redirectSignIn
      }).toPromise();

      if (!response || !response.success) {
        throw new Error('Respuesta inválida del servidor');
      }

      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('userEmail', response.usuario.email);
      localStorage.setItem('userName', response.usuario.nombre);
      localStorage.setItem('userCedula', response.usuario.idUsuario.toString());
      localStorage.setItem('appToken', response.token);
      localStorage.setItem('appTokenExpira', response.expiraEn);
      localStorage.setItem('autorizaciones', JSON.stringify(response.autorizaciones));

      this.authService.isLoggedIn.set(true);
      this.authService.usuarioActual.set(response.usuario.email);
      this.authService.nombreActual.set(response.usuario.nombre);
      this.authService.appToken.set(response.token);
      this.authService.autorizaciones.set(response.autorizaciones);

      await this.router.navigate(['/home']);
    } catch (error) {
      console.error('Error procesando callback:', error);
      this.router.navigate(['/login'], {
        queryParams: { error: 'callback_failed' }
      });
    }
  }
}
