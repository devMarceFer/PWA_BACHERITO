import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CognitoService } from '../../../core/services/cognito.service';
import { AuthService } from '../../../core/services/auth.service';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputErrorComponent } from '../../../shared/components/message_error/msg_error.component';
import { NavbarTopComponent } from '../../../shared/components/toolbar/toolbar.component';

const TOTAL_DIGITOS = 6;
const SEGUNDOS_REENVIO = 30;

@Component({
  selector: 'app-cognito-validar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    ButtonComponent,
    InputErrorComponent,
    NavbarTopComponent
  ],
  templateUrl: './validar.html'
})
export class ValidarComponent implements OnInit, OnDestroy {
  private cognitoService = inject(CognitoService);
  private authService = inject(AuthService);
  private router = inject(Router);

  digitos = signal<string[]>(new Array(TOTAL_DIGITOS).fill(''));
  errorValidacion = signal<string | null>(null);
  cargando = signal(false);
  segundosReenvio = signal(0);

  private intervaloReenvio?: ReturnType<typeof setInterval>;

  get correo(): string {
    return this.cognitoService.correoPendiente() ?? 'tu correo';
  }

  get codigoCompleto(): string {
    return this.digitos().join('');
  }

  ngOnInit() {
    this.iniciarConteoReenvio();
  }

  ngOnDestroy() {
    if (this.intervaloReenvio) {
      clearInterval(this.intervaloReenvio);
    }
  }

  onDigitoInput(indice: number, event: Event, siguiente?: HTMLInputElement) {
    const input = event.target as HTMLInputElement;
    const valor = input.value.replace(/[^0-9]/g, '').slice(-1);

    this.digitos.update(actual => {
      const copia = [...actual];
      copia[indice] = valor;
      return copia;
    });
    input.value = valor;

    if (valor && siguiente) {
      siguiente.focus();
    }
  }

  onDigitoKeydown(indice: number, event: KeyboardEvent, anterior?: HTMLInputElement) {
    if (event.key === 'Backspace' && !this.digitos()[indice] && anterior) {
      anterior.focus();
    }
  }

  reenviarCodigo() {
    if (this.segundosReenvio() > 0) return;

    this.cognitoService.reenviarCodigo().subscribe(() => {
      this.iniciarConteoReenvio();
    });
  }

  onSubmit(event?: Event) {
    if (event) {
      event.preventDefault();
    }

    if (this.codigoCompleto.length !== TOTAL_DIGITOS) return;

    this.errorValidacion.set(null);
    this.cargando.set(true);

    this.cognitoService.verificarCodigo(this.codigoCompleto).subscribe({
      next: (exito) => {
        if (!exito) {
          this.cargando.set(false);
          this.errorValidacion.set('Código incorrecto. Intenta de nuevo.');
          return;
        }

        this.registrarEnBackend();
      },
      error: () => {
        this.cargando.set(false);
        this.errorValidacion.set('Ocurrió un error al verificar el código.');
      }
    });
  }

  // Da de alta al funcionario en RBAC_USUARIOS (requiere cédula válida en la vista institucional).
  // Si esta llamada falla (red, backend caído), no bloqueamos al usuario: el login vuelve a
  // intentar el alta como red de seguridad.
  private registrarEnBackend() {
    const datos = this.cognitoService.obtenerDatosPendientes();

    if (!datos) {
      this.cargando.set(false);
      this.router.navigate(['/login']);
      return;
    }

    this.authService.registrarUsuarioBackend(datos).subscribe({
      next: () => {
        this.cargando.set(false);
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error('No se pudo registrar al usuario en el backend, se reintentará en el login:', error);
        this.cargando.set(false);
        this.router.navigate(['/login']);
      }
    });
  }

  private iniciarConteoReenvio() {
    if (this.intervaloReenvio) {
      clearInterval(this.intervaloReenvio);
    }

    this.segundosReenvio.set(SEGUNDOS_REENVIO);
    this.intervaloReenvio = setInterval(() => {
      this.segundosReenvio.update(s => {
        if (s <= 1) {
          clearInterval(this.intervaloReenvio);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }
}
