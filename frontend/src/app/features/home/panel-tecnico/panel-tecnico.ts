import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CardComponent } from '../../../shared/components/card/card.component';
import { AuthService } from '../../../core/services/auth.service';
import { ConnectionService } from '../../../core/db/services/connection.service';
import { MisTareasService } from '../../../core/services/mis-tareas.service';
import { ReporteService } from '../../../core/services/reporte.service';
import { SyncService } from '../../../core/db/services/sync.service';
import { LABEL_POR_ESTADO } from '../../../core/utils/estado-bache.util';

interface TareaVista {
  idRequerimiento: number;
  nombre: string;
  parroquia?: string;
  estadoCodigo: string;
  estadoLabel: string;
  fechaIngreso: string;
}

@Component({
  selector: 'app-panel-tecnico',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    CardComponent
  ],
  templateUrl: './panel-tecnico.html'
})
export class PanelTecnicoComponent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private connectionService = inject(ConnectionService);
  private misTareasService = inject(MisTareasService);
  private reporteService = inject(ReporteService);
  private syncService = inject(SyncService);

  enLinea = this.connectionService.isOnline;
  tareasTotal = signal(0);
  huecosPendientes = signal(0);
  huecosEnProgreso = signal(0);
  huecosResueltos = signal(0);
  tareasPendientesPreview = signal<TareaVista[]>([]);
  descargandoTareas = signal(false);
  // Controla si se muestra "Descargar Tareas": true mientras el servidor diga que hay
  // asignaciones nuevas (OP_BACHERITO_GRUPO_TAREAS.ESTADO='I') sin bajar a este dispositivo.
  // Si no hay conexión, cae al respaldo local (¿ya descargó algo alguna vez?).
  mostrarBotonDescarga = signal(true);
  // Total de pendientes por sincronizar de este dispositivo: baches reportados offline (reportesOff)
  pendientesSincronizar = signal(0);
  subiendoReporte = signal(false);

  get nombreTecnico(): string {
    return this.authService.nombreActual() || this.authService.usuarioActual() || 'Funcionario';
  }

  async ngOnInit() {
    await this.actualizarProgresoTareas();
  }

  irAMisTareas() {
    this.router.navigate(['/mis-tareas']);
  }

  async descargarTareas() {
    this.descargandoTareas.set(true);
    try {
      await this.misTareasService.descargarTareas();
      await this.actualizarProgresoTareas();
    } catch (error) {
      console.error('No se pudieron descargar las tareas:', error);
      alert('No se pudo descargar la información. Verifica tu conexión e intenta de nuevo.');
    }
    this.descargandoTareas.set(false);
  }

  async subirReporte() {
    this.subiendoReporte.set(true);

    const pendientesAntes = this.pendientesSincronizar();
    await this.syncService.sincronizarReportesPendientes();
    await this.actualizarProgresoTareas();

    this.subiendoReporte.set(false);

    if (this.pendientesSincronizar() === pendientesAntes && pendientesAntes > 0) {
      alert('No se pudo subir el reporte. Verifica tu conexión e intenta de nuevo.');
    }
  }

  // Muestra de inmediato cuántos baches tiene que atender el técnico, consultando al servidor
  // directamente (no depende de que ya haya descargado la información para trabajar offline).
  // Si no hay conexión, cae de vuelta a lo que ya tenga guardado localmente en el dispositivo.
  private async actualizarProgresoTareas() {
    try {
      const { total, tareas, pendientesDescarga } = await this.misTareasService.obtenerResumenServidor();
      this.tareasTotal.set(total);
      this.mostrarBotonDescarga.set(pendientesDescarga > 0);
      this.aplicarBuckets(tareas.map(t => ({
        idRequerimiento: t.idRequerimiento,
        nombre: t.nombres,
        parroquia: t.parroquiaNombre,
        estadoCodigo: t.estadoCrudo,
        estadoLabel: t.estado,
        fechaIngreso: t.fechaIngreso
      })));
    } catch (error) {
      const locales = await this.misTareasService.obtenerTareasLocales();
      this.tareasTotal.set(locales.length);
      this.mostrarBotonDescarga.set(!(await this.misTareasService.tieneTareasDescargadas()));
      this.aplicarBuckets(locales.map(t => ({
        idRequerimiento: t.idRequerimiento,
        nombre: t.nombreReporto,
        estadoCodigo: t.estado,
        estadoLabel: LABEL_POR_ESTADO[t.estado] ?? t.estado,
        fechaIngreso: t.fechaIngreso
      })));
    }

    this.pendientesSincronizar.set(await this.reporteService.contarPendientesSincronizacion());
  }

  // Ingresado/Reasignado -> Pendientes, En proceso -> En progreso, Atendido -> Resueltos
  // (mismos códigos reales de OP_BACHERITO_REQ.ESTADO que ya usa el resto de la app).
  private aplicarBuckets(tareas: TareaVista[]) {
    let pendientes = 0;
    let enProgreso = 0;
    let resueltos = 0;

    for (const tarea of tareas) {
      if (tarea.estadoCodigo === 'A') resueltos++;
      else if (tarea.estadoCodigo === 'E') enProgreso++;
      else pendientes++;
    }

    this.huecosPendientes.set(pendientes);
    this.huecosEnProgreso.set(enProgreso);
    this.huecosResueltos.set(resueltos);
    this.tareasPendientesPreview.set(tareas.filter(t => t.estadoCodigo !== 'A').slice(0, 3));
  }
}
