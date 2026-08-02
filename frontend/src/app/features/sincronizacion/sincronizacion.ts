import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CardComponent } from '../../shared/components/card/card.component';
import { NavbarTopComponent } from '../../shared/components/toolbar/toolbar.component';
import { NavigationDrawerComponent } from '../../shared/components/navigation_drawer/navigation_drawer.component';
import { SincronizacionService } from '../../core/db/services/sincronizacion.service';
import { ConnectionService } from '../../core/db/services/connection.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-sincronizacion',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    CardComponent,
    NavbarTopComponent,
    NavigationDrawerComponent
  ],
  templateUrl: './sincronizacion.html'
})
export class SincronizacionComponent implements OnInit {
  private sincronizacionService = inject(SincronizacionService);
  private connectionService = inject(ConnectionService);
  private authService = inject(AuthService);

  menuAbierto = signal(false);
  enLinea = this.connectionService.isOnline;

  // La pantalla es visible para cualquier usuario autenticado (D2 - owner decision), pero
  // GET /api/mis-tareas está protegido en el backend con requireModulo('MIS_TAREAS') y
  // respondería 403 para quien no lo tenga. La tarjeta de descarga se oculta para esos usuarios.
  puedeDescargarRecursos = computed(() => this.authService.tieneAcceso('MIS_TAREAS'));

  reportesPendientes = this.sincronizacionService.reportesPendientes;
  reportesSincronizados = this.sincronizacionService.reportesSincronizados;
  respuestasPendientes = this.sincronizacionService.respuestasPendientes;
  ultimaDescarga = this.sincronizacionService.ultimaDescarga;
  ultimoEnvio = this.sincronizacionService.ultimoEnvio;
  ocupado = this.sincronizacionService.ocupado;

  // Resultado de la última operación, que se muestra dentro de la pantalla (no con alert()).
  mensaje = signal<{ texto: string; ok: boolean } | null>(null);
  // Primer diálogo de "Borrar caché". Con pendientes, confirmarlo no borra todavía: abre el
  // segundo diálogo (confirmandoBorradoFinal). Sin pendientes, el borrado ocurre de una vez.
  confirmandoBorrado = signal(false);
  // Segunda confirmación (owner decision, spec D4 / criterio 7): solo se llega aquí cuando hay
  // pendientes, y solo desde aquí se ejecuta borrarCache().
  confirmandoBorradoFinal = signal(false);

  // La descarga reemplaza la copia local completa: se bloquea mientras haya respuestas sin enviar
  // para no borrarlas en silencio.
  puedeDescargar = computed(() =>
    this.enLinea() && !this.ocupado() && this.respuestasPendientes() === 0
  );

  puedeSubir = computed(() => this.enLinea() && !this.ocupado());

  totalPendientes = computed(() => this.respuestasPendientes() + this.reportesPendientes());

  motivoBloqueoDescarga = computed(() => {
    if (!this.enLinea()) return 'Necesitas conexión a internet';
    const pendientes = this.respuestasPendientes();
    if (pendientes > 0) {
      return `Tienes ${pendientes} ${pendientes === 1 ? 'respuesta' : 'respuestas'} sin enviar. Súbelas antes de descargar.`;
    }
    return null;
  });

  async ngOnInit() {
    await this.sincronizacionService.refrescarContadores();
  }

  async descargar() {
    this.mensaje.set(null);
    const resultado = await this.sincronizacionService.descargarRecursos();
    this.mensaje.set({ texto: resultado.mensaje, ok: resultado.ok });
  }

  async subir() {
    this.mensaje.set(null);
    const resultado = await this.sincronizacionService.subirRespuestas();
    this.mensaje.set({ texto: resultado.mensaje, ok: resultado.ok });
  }

  abrirConfirmacionBorrado() {
    this.mensaje.set(null);
    this.confirmandoBorrado.set(true);
  }

  cancelarBorrado() {
    this.confirmandoBorrado.set(false);
    this.confirmandoBorradoFinal.set(false);
  }

  // Botón "Borrar de todos modos" / "Borrar caché" del primer diálogo. Sin pendientes, es la
  // única confirmación que exige el flujo y se borra de inmediato. Con pendientes, todavía no se
  // borra nada: se pasa al segundo diálogo, que es el que de verdad ejecuta el borrado.
  continuarBorrado() {
    if (this.totalPendientes() > 0) {
      this.confirmandoBorrado.set(false);
      this.confirmandoBorradoFinal.set(true);
      return;
    }
    this.confirmarBorrado();
  }

  async confirmarBorrado() {
    const resultado = await this.sincronizacionService.borrarCache();
    this.confirmandoBorrado.set(false);
    this.confirmandoBorradoFinal.set(false);
    this.mensaje.set({ texto: resultado.mensaje, ok: resultado.ok });
  }
}
