import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CognitoService } from '../../../core/services/cognito.service';
import { FuncionarioService } from '../../../core/services/funcionario.service';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputErrorComponent } from '../../../shared/components/message_error/msg_error.component';
import { NavbarTopComponent } from '../../../shared/components/toolbar/toolbar.component';

const REGEX_CEDULA = /^\d{10}$/;

@Component({
  selector: 'app-cognito-crear',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatIconModule,
    ButtonComponent,
    InputErrorComponent,
    NavbarTopComponent
  ],
  templateUrl: './crear.html'
})
export class CrearComponent {
  private cognitoService = inject(CognitoService);
  private funcionarioService = inject(FuncionarioService);
  private router = inject(Router);

  cedula = signal('');
  correo = signal('');
  primerNombre = signal('');
  primerApellido = signal('');
  telefono = signal('');
  contrasena = signal('');
  confirmarContrasena = signal('');
  ocultarContrasena = signal(true);
  ocultarConfirmar = signal(true);

  // Se activa cuando la cédula coincide con un funcionario municipal: nombre y apellido
  // pasan a ser de solo lectura porque provienen de la base institucional, no del ciudadano.
  datosFuncionarioCargados = signal(false);
  buscandoFuncionario = signal(false);
  errorBusquedaCedula = signal<string | null>(null);

  errorRegistro = signal<string | null>(null);
  cargando = signal(false);

  toggleVisibilidad() { this.ocultarContrasena.update(v => !v); }
  toggleVisibilidadConfirmar() { this.ocultarConfirmar.update(v => !v); }

  get formularioValido(): boolean {
    return !!(
      this.datosFuncionarioCargados() &&
      this.correo().trim() &&
      this.cedula().trim() &&
      this.primerNombre().trim() &&
      this.primerApellido().trim() &&
      this.telefono().trim() &&
      this.contrasena() &&
      this.confirmarContrasena()
    );
  }

  // Si el usuario vuelve a tocar la cédula tras una búsqueda exitosa, se descartan todos los
  // datos autocompletados (correo, teléfono, nombre, apellido) porque ya no corresponden a lo escrito.
  onCedulaChange(valor: string) {
    this.cedula.set(valor);
    this.errorBusquedaCedula.set(null);
    if (this.datosFuncionarioCargados()) {
      this.datosFuncionarioCargados.set(false);
      this.correo.set('');
      this.telefono.set('');
      this.primerNombre.set('');
      this.primerApellido.set('');
    }
  }

  buscarPorCedula() {
    const cedula = this.cedula().trim();
    if (!REGEX_CEDULA.test(cedula)) {
      this.errorBusquedaCedula.set('La búsqueda solo está disponible para cédulas de 10 dígitos.');
      return;
    }

    this.errorBusquedaCedula.set(null);
    this.buscandoFuncionario.set(true);

    this.funcionarioService.buscarPorCedula(cedula).subscribe((funcionario) => {
      this.buscandoFuncionario.set(false);

      if (!funcionario) {
        this.errorBusquedaCedula.set('No se encontró ningún funcionario con esa cédula.');
        return;
      }

      this.correo.set(funcionario.correo ?? '');
      this.telefono.set(funcionario.celular1 ?? '');
      this.primerNombre.set(funcionario.nombres ?? '');
      this.primerApellido.set(funcionario.apellidos ?? '');
      this.datosFuncionarioCargados.set(true);
    });
  }

  onSubmit(event?: Event) {
    if (event) {
      event.preventDefault();
    }

    if (!this.formularioValido) return;

    this.errorRegistro.set(null);

    if (!this.datosFuncionarioCargados()) {
      this.errorRegistro.set('Debes buscar y confirmar tu cédula como funcionario municipal antes de continuar.');
      return;
    }

    if (this.contrasena().length < 8) {
      this.errorRegistro.set('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (!/[a-z]/.test(this.contrasena()) || !/[A-Z]/.test(this.contrasena()) || !/[0-9]/.test(this.contrasena())) {
      this.errorRegistro.set('La contraseña debe incluir mayúsculas, minúsculas y números.');
      return;
    }

    if (this.contrasena() !== this.confirmarContrasena()) {
      this.errorRegistro.set('Las contraseñas no coinciden.');
      return;
    }

    this.cargando.set(true);

    this.cognitoService.crearCuenta({
      correo: this.correo().trim(),
      cedula: this.cedula().trim(),
      primerNombre: this.primerNombre().trim(),
      primerApellido: this.primerApellido().trim(),
      telefono: this.telefono().trim(),
      contrasena: this.contrasena()
    }).subscribe({
      next: (exito) => {
        this.cargando.set(false);
        if (exito) {
          this.router.navigate(['/cognito/validar']);
        } else {
          this.errorRegistro.set('No se pudo crear la cuenta. Intenta de nuevo.');
        }
      },
      error: (err) => {
        console.error('Error al crear cuenta en Cognito:', err);
        this.cargando.set(false);
        this.errorRegistro.set(this.mensajeError(err));
      }
    });
  }

  private mensajeError(err: any): string {
    switch (err?.code) {
      case 'UsernameExistsException':
        return 'Ese nombre de usuario ya está en uso. Elige otro.';
      case 'InvalidPasswordException':
        return 'La contraseña no cumple con la política de seguridad requerida.';
      case 'InvalidParameterException':
        return 'Revisa los datos ingresados: ' + (err.message ?? 'hay un campo inválido.');
      default:
        return 'Ocurrió un error al conectar con el servidor.';
    }
  }
}
