import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CardComponent } from '../../../shared/components/card/card.component';
import { AuthService } from '../../../core/services/auth.service';
import { AsignarGrupoService } from '../../admin/asignar-grupo/asignar-grupo.service';
import { ReporteService } from '../../../core/services/reporte.service';
import { MisTareasService } from '../../../core/services/mis-tareas.service';

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
  private misTareasService = inject(MisTareasService);

  cargando = signal(false);
  totalHuecos = signal(0);
  pendientes = signal(0);
  enProgreso = signal(0);
  resueltos = signal(0);
  // Total de pendientes por sincronizar de este dispositivo: baches reportados offline (reportesOff)
  // + cambios de estado que quedaron en cola sin llegar al servidor (tareasTecnicoOff.pendienteSubir).
  // Antes solo contaba reportes, así que la barra podía decir "Todo sincronizado" con respuestas de
  // "Atendido"/"Mantenimiento" sin enviar (mismo bug ya corregido en panel-tecnico).
  pendientesSincronizar = signal(0);

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

  // Un solo camino de sincronización en toda la app: igual que panel-tecnico, este botón ya no
  // sube nada directamente (ese botón no conocía la cola de respuestas y podía disparar un
  // alert() de error sin que nada hubiera fallado). Ahora solo lleva a /sincronizacion, que sí
  // sabe subir reportes y respuestas juntos.
  irASincronizacion() {
    this.router.navigate(['/sincronizacion']);
  }

  private async actualizarPendientesSincronizar() {
    const [reportesPendientes, respuestasPendientes] = await Promise.all([
      this.reporteService.contarPendientesSincronizacion(),
      this.misTareasService.contarRespuestasPendientes()
    ]);
    this.pendientesSincronizar.set(reportesPendientes + respuestasPendientes);
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
