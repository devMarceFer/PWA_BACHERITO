import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CardComponent } from '../../shared/components/card/card.component';
import { NavbarTopComponent } from '../../shared/components/toolbar/toolbar.component';
import { NavigationDrawerComponent } from '../../shared/components/navigation_drawer/navigation_drawer.component';
import { SincronizacionService } from '../../core/db/services/sincronizacion.service';
import { ConnectionService } from '../../core/db/services/connection.service';

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

  menuAbierto = signal(false);
  enLinea = this.connectionService.isOnline;

  reportesPendientes = this.sincronizacionService.reportesPendientes;
  reportesSincronizados = this.sincronizacionService.reportesSincronizados;
  respuestasPendientes = this.sincronizacionService.respuestasPendientes;
  ultimaDescarga = this.sincronizacionService.ultimaDescarga;
  ultimoEnvio = this.sincronizacionService.ultimoEnvio;
  ocupado = this.sincronizacionService.ocupado;

  // Resultado de la última operación, que se muestra dentro de la pantalla (no con alert()).
  mensaje = signal<{ texto: string; ok: boolean } | null>(null);
  confirmandoBorrado = signal(false);

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
  }

  async confirmarBorrado() {
    await this.sincronizacionService.borrarCache();
    this.confirmandoBorrado.set(false);
    this.mensaje.set({ texto: 'Se eliminaron los datos del dispositivo.', ok: true });
  }
}
