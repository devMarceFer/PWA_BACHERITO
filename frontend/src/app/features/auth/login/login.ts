import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService, SinAccesoSateliteError } from '../../../core/services/auth.service';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputErrorComponent } from '../../../shared/components/message_error/msg_error.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatIconModule,
    ButtonComponent,
    InputErrorComponent
  ],
  templateUrl: './login.html'
})

export class LoginComponent {
  private authService = inject(AuthService);  // Inyecta el servicio de autenticación
  private router = inject(Router);            // Inyecta el enrutador

  usuario = signal('');                       // Señal para almacenar el usuario
  contrasena = signal('');                    // Señal para la contraseña
  errorLogin = signal<string | null>(null);   // Señal para mensajes de error
  ocultarContrasena = signal(true);           // Señal para mostrar/ocultar contraseña
  cargando = signal(false);                   // Señal para estado de carga

  toggleVisibilidad() { this.ocultarContrasena.update(v => !v); }

  onSubmit(event?: Event) {
    if (event) {
      event.preventDefault(); // 🛑 Detiene la recarga física del navegador
    }

    if (!this.usuario() || !this.contrasena()) return;

    this.cargando.set(true);        // Activa estado de carga
    this.errorLogin.set(null);      // Limpia errores previos

    this.authService.login(this.usuario(), this.contrasena()).subscribe
    (
      {
        next: (success) => {
          this.cargando.set(false);
          if (success) {
            this.router.navigate(['/home']); // Redirige al inicio
          } else {
            this.errorLogin.set('Credenciales incorrectas. Intenta de nuevo.');
          }
        },
        error: (err) => {
          console.error('Error al iniciar sesión en Cognito:', err);
          this.cargando.set(false);

          if (err instanceof SinAccesoSateliteError) {
            alert('Aún no tienes acceso a este satélite. Contacta al administrador para que te asigne los permisos correspondientes.');
            return;
          }

          this.errorLogin.set(this.mensajeError(err));
        }
      }
    );
  }

  private mensajeError(err: any): string {
    switch (err?.code) {
      case 'UserNotConfirmedException':
        return 'Tu cuenta aún no ha sido verificada. Revisa tu correo.';
      case 'NotAuthorizedException':
      case 'UserNotFoundException':
        return 'Credenciales incorrectas. Intenta de nuevo.';
      default:
        // Errores propios del backend (bloqueado, inactivo, token inválido, etc.) llegan como
        // HttpErrorResponse con { success:false, message } en el cuerpo.
        return err?.error?.message || 'Ocurrió un error al conectar con el servidor.';
    }
  }
}