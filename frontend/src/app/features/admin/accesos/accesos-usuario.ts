import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AccesosService, Acceso, Catalogo, DetalleUsuario, Otorgamiento } from './accesos.service';
import { AuthService } from '../../../core/services/auth.service';
import { ButtonComponent } from '../../../shared/components/button/button.component';

// El módulo que protege esta misma pantalla: el botón de revocárselo a uno mismo va
// deshabilitado. El backend además lo rechaza con 409, esto es solo la mitad visible.
const MODULO_DE_GESTION = 'GESTIONAR_ACCESOS';

@Component({
  selector: 'app-accesos-usuario',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, ButtonComponent],
  templateUrl: './accesos-usuario.html'
})
export class AccesosUsuarioComponent {
  private accesosService = inject(AccesosService);
  private authService = inject(AuthService);

  idUsuario = input.required<number>();
  cambio = output<void>();

  detalle = signal<DetalleUsuario | null>(null);
  catalogo = signal<Catalogo | null>(null);
  cargando = signal(false);

  errorCarga = signal<string | null>(null);
  errorOtorgar = signal<string | null>(null);
  errorRevocar = signal<string | null>(null);
  mensajeExito = signal<string | null>(null);

  guardando = signal(false);
  revocando = signal<number | null>(null);
  mostrarRevocados = signal(false);

  // idModulo -> idRol elegido en el selector. Solo los que tienen rol elegido se envían.
  seleccion = signal<Map<number, number>>(new Map());

  accesosActivos = computed(() => this.detalle()?.accesos.filter(a => a.estado === 'S') ?? []);
  accesosRevocados = computed(() => this.detalle()?.accesos.filter(a => a.estado === 'N') ?? []);
  sinAccesos = computed(() => this.detalle() !== null && this.accesosActivos().length === 0);

  // AuthService no expone el id numérico del usuario en sesión, solo usuarioActual() (correo)
  // y cedulaActual(). Se compara por correo, que es único en RBAC_USUARIOS.
  esElActor = computed(() => this.detalle()?.usuario.email === this.authService.usuarioActual());

  constructor() {
    // Recarga sola cuando el padre cambia de usuario seleccionado.
    effect(() => {
      const id = this.idUsuario();
      this.cargar(id);
    });
  }

  private cargar(idUsuario: number) {
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.mensajeExito.set(null);
    this.seleccion.set(new Map());

    this.accesosService.obtenerCatalogo().subscribe({
      next: (respuestaCatalogo) => {
        this.catalogo.set(respuestaCatalogo.data);

        this.accesosService.obtenerDetalleUsuario(idUsuario).subscribe({
          next: (respuestaDetalle) => {
            this.detalle.set(respuestaDetalle.data);
            this.cargando.set(false);
          },
          error: () => {
            this.errorCarga.set('No se pudieron cargar los accesos de esta persona.');
            this.cargando.set(false);
          }
        });
      },
      error: () => {
        this.errorCarga.set('No se pudo cargar el catálogo de módulos y roles.');
        this.cargando.set(false);
      }
    });
  }

  // El par (módulo, rol) exacto ya está activo. NO se oculta el módulo entero: alguien con
  // MIS_TAREAS como TECNICO puede además necesitarlo como ADMIN, que es justo lo que la
  // clave UNIQUE(ID_USUARIO, ID_MODULO, ID_ROL) permite.
  yaTiene(idModulo: number, idRol: number): boolean {
    return this.accesosActivos().some(a => a.idModulo === idModulo && a.idRol === idRol);
  }

  rolElegido(idModulo: number): number | null {
    return this.seleccion().get(idModulo) ?? null;
  }

  elegirRol(idModulo: number, valor: string) {
    const mapa = new Map(this.seleccion());
    const idRol = Number(valor);

    if (!idRol) {
      mapa.delete(idModulo);
    } else {
      mapa.set(idModulo, idRol);
    }
    this.seleccion.set(mapa);
  }

  otorgamientosPendientes = computed<Otorgamiento[]>(() =>
    Array.from(this.seleccion().entries())
      .map(([idModulo, idRol]) => ({ idModulo, idRol }))
      .filter(par => !this.yaTiene(par.idModulo, par.idRol))
  );

  // Se deshabilita revocarse a uno mismo el módulo de gestión (D6): es la única puerta de
  // entrada, y sin él nadie podría devolvérselo desde la aplicación. Esta es solo la mitad
  // visible: el backend valida lo mismo por req.usuario.sub y responde 409.
  puedeRevocar(acceso: Acceso): boolean {
    return !(acceso.modulo === MODULO_DE_GESTION && this.esElActor());
  }

  otorgar() {
    const pendientes = this.otorgamientosPendientes();
    if (pendientes.length === 0) {
      this.errorOtorgar.set('Elige al menos un módulo con su rol.');
      return;
    }

    this.guardando.set(true);
    this.errorOtorgar.set(null);
    this.mensajeExito.set(null);

    this.accesosService.otorgar(this.idUsuario(), pendientes).subscribe({
      next: (respuesta) => {
        this.mensajeExito.set(respuesta.message);
        this.guardando.set(false);
        this.seleccion.set(new Map());
        this.cargar(this.idUsuario());
        this.cambio.emit();
      },
      error: (respuesta) => {
        this.errorOtorgar.set(respuesta?.error?.message ?? 'No se pudieron otorgar los accesos.');
        this.guardando.set(false);
      }
    });
  }

  revocar(acceso: Acceso) {
    this.revocando.set(acceso.idUmr);
    this.errorRevocar.set(null);
    this.mensajeExito.set(null);

    this.accesosService.revocar(this.idUsuario(), acceso.idModulo, acceso.idRol).subscribe({
      next: () => {
        this.revocando.set(null);
        this.cargar(this.idUsuario());
        this.cambio.emit();
      },
      error: (respuesta) => {
        this.errorRevocar.set(respuesta?.error?.message ?? 'No se pudo revocar el acceso.');
        this.revocando.set(null);
      }
    });
  }
}
