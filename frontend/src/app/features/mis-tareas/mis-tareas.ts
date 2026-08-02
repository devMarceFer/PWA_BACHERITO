import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MisTareasService } from '../../core/services/mis-tareas.service';
import { ConnectionService } from '../../core/db/services/connection.service';
import { TareaTecnicoOffline } from '../../core/db/offline-db';
import { LABEL_POR_ESTADO } from '../../core/utils/estado-bache.util';
import { NavbarTopComponent } from '../../shared/components/toolbar/toolbar.component';
import { NavigationDrawerComponent } from '../../shared/components/navigation_drawer/navigation_drawer.component';

// Pantalla de solo lectura: el cambio de estado real (con foto y elección Atendido/Mantenimiento)
// se hace desde el mapa de seguimiento, no desde aquí, para evitar marcar algo por accidente.
@Component({
  selector: 'app-mis-tareas',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    NavbarTopComponent,
    NavigationDrawerComponent
  ],
  templateUrl: './mis-tareas.html'
})
export class MisTareasComponent implements OnInit {
  private misTareasService = inject(MisTareasService);
  private connectionService = inject(ConnectionService);

  menuAbierto = signal(false);
  tareas = signal<TareaTecnicoOffline[]>([]);
  cargando = signal(false);
  enLinea = this.connectionService.isOnline;

  async ngOnInit() {
    await this.cargarTareas();
  }

  // Mientras hay conexión, consulta siempre al servidor (refleja el grupo actual del técnico
  // en tiempo real); si el técnico cambió de grupo, la copia local (tareasTecnicoOff) puede
  // haber quedado con tareas de un grupo anterior hasta la próxima descarga manual, y mostrar
  // solo esa copia daría tareas que ya no le corresponden. Solo cae a la copia local cuando de
  // verdad no hay conexión o el servidor no responde.
  private async cargarTareas() {
    this.cargando.set(true);
    try {
      const { tareas } = await this.misTareasService.obtenerResumenServidor();
      this.tareas.set(tareas.map(t => ({
        idRequerimiento: t.idRequerimiento,
        estado: t.estadoCrudo,
        nombreReporto: t.nombres,
        coordenadaX: t.coordenadaX,
        coordenadaY: t.coordenadaY,
        fechaIngreso: t.fechaIngreso,
        pendienteSubir: 0
      })));
    } catch (error) {
      this.tareas.set(await this.misTareasService.obtenerTareasLocales());
    }
    this.cargando.set(false);
  }

  labelEstado(codigo: string): string {
    return LABEL_POR_ESTADO[codigo] ?? codigo;
  }
}
