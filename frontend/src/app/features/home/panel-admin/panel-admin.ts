import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CardComponent } from '../../../shared/components/card/card.component';
import { AuthService } from '../../../core/services/auth.service';
import { AsignarGrupoService } from '../../admin/asignar-grupo/asignar-grupo.service';
import { ReporteService } from '../../../core/services/reporte.service';
import { SyncService } from '../../../core/db/services/sync.service';

@Component({
  selector: 'app-panel-admin',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    CardComponent
  ],
  templateUrl: './panel-admin.html'
})
export class PanelAdminComponent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private asignarGrupoService = inject(AsignarGrupoService);
  private reporteService = inject(ReporteService);
  private syncService = inject(SyncService);

  cargando = signal(false);
  totalHuecos = signal(0);
  pendientes = signal(0);
  enProgreso = signal(0);
  resueltos = signal(0);
  // Baches reportados por este admin mientras estaba offline, aún sin subir al servidor
  // (mismo mecanismo que el panel del técnico: reportesOff en IndexedDB).
  pendientesSincronizar = signal(0);
  subiendoReporte = signal(false);

  get nombreAdmin(): string {
    return this.authService.nombreActual() || this.authService.usuarioActual() || 'Funcionario';
  }

  ngOnInit() {
    this.cargarResumen();
    this.actualizarPendientesSincronizar();
  }

  irAGrupos() {
    this.router.navigate(['/admin/grupos']);
  }

  async subirReporte() {
    this.subiendoReporte.set(true);

    const pendientesAntes = this.pendientesSincronizar();
    await this.syncService.sincronizarReportesPendientes();
    await this.actualizarPendientesSincronizar();

    this.subiendoReporte.set(false);

    if (this.pendientesSincronizar() === pendientesAntes && pendientesAntes > 0) {
      alert('No se pudo subir el reporte. Verifica tu conexión e intenta de nuevo.');
    }
  }

  private async actualizarPendientesSincronizar() {
    this.pendientesSincronizar.set(await this.reporteService.contarPendientesSincronizacion());
  }

  private cargarResumen() {
    this.cargando.set(true);
    this.asignarGrupoService.obtenerResumenAdmin().subscribe({
      next: (respuesta) => {
        this.totalHuecos.set(respuesta.data.totalHuecos);
        this.pendientes.set(respuesta.data.pendientes);
        this.enProgreso.set(respuesta.data.enProgreso);
        this.resueltos.set(respuesta.data.resueltos);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
      }
    });
  }
}
