import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { dbLocal, TareaTecnicoOffline } from '../db/offline-db';
import { ConnectionService } from '../db/services/connection.service';

// Forma que entrega el servidor en vivo (GET /api/mis-tareas): incluye parroquia/grupo, que no
// se guardan en la copia local (tareasTecnicoOff) porque no se pidieron para ese almacenamiento.
export interface TareaTecnicoServidor {
  idRequerimiento: number;
  nombres: string;
  coordenadaX: number;
  coordenadaY: number;
  parroquiaNombre: string;
  estado: string;       // Texto legible (INGRESADO, EN PROCESO, REASIGNADO, ATENDIDO)
  estadoCrudo: string;  // Código real de OP_BACHERITO_REQ.ESTADO (I/E/R/A)
  fechaIngreso: string;
  idGrupo: number;
  nombreGrupo: string;
}

interface RespuestaMisTareas {
  success: boolean;
  tareas: TareaTecnicoServidor[];
  total: number;
  atendidas: number;
  // Asignaciones (OP_BACHERITO_GRUPO_TAREAS) en estado 'I' (Ingresado) que este técnico aún no
  // bajó a ningún dispositivo. Controla si el botón "Descargar Tareas" debe mostrarse.
  pendientesDescarga: number;
}

@Injectable({
  providedIn: 'root'
})
export class MisTareasService {
  private http = inject(HttpClient);
  private connectionService = inject(ConnectionService);
  private readonly API_URL = `${environment.apiUrl}/mis-tareas`;

  // Consulta el resumen directo del servidor (sin tocar la copia local), para que el técnico
  // vea de inmediato al iniciar sesión cuántos baches tiene que atender, sin depender de que
  // ya haya descargado la información para trabajar offline.
  async obtenerResumenServidor(): Promise<{ tareas: TareaTecnicoServidor[]; total: number; atendidas: number; pendientesDescarga: number }> {
    const respuesta = await firstValueFrom(this.http.get<RespuestaMisTareas>(this.API_URL));
    return { tareas: respuesta.tareas, total: respuesta.total, atendidas: respuesta.atendidas, pendientesDescarga: respuesta.pendientesDescarga };
  }

  // Trae las tareas asignadas desde el backend y reemplaza la copia local guardada en el
  // dispositivo (tareasTecnicoOff), con el id real del requerimiento, estado, nombre de quien
  // reportó, coordenadas y fecha de ingreso. Avisa al servidor que ya se descargó (ESTADO='D' en
  // OP_BACHERITO_GRUPO_TAREAS) para que el botón "Descargar Tareas" no vuelva a aparecer hasta que
  // haya una asignación realmente nueva.
  async descargarTareas(): Promise<void> {
    const respuesta = await firstValueFrom(this.http.get<RespuestaMisTareas>(this.API_URL));
    const tareasLocales: TareaTecnicoOffline[] = respuesta.tareas.map(t => ({
      idRequerimiento: t.idRequerimiento,
      estado: t.estadoCrudo,
      nombreReporto: t.nombres,
      coordenadaX: t.coordenadaX,
      coordenadaY: t.coordenadaY,
      fechaIngreso: t.fechaIngreso,
      pendienteSubir: 0
    }));

    await dbLocal.tareasTecnicoOff.clear();
    await dbLocal.tareasTecnicoOff.bulkAdd(tareasLocales);

    try {
      await firstValueFrom(this.http.post(`${this.API_URL}/marcar-descargado`, {}));
    } catch (error) {
      console.error('No se pudo avisar al servidor que ya se descargó:', error);
    }
  }

  async obtenerTareasLocales(): Promise<TareaTecnicoOffline[]> {
    return dbLocal.tareasTecnicoOff.orderBy('id').reverse().toArray();
  }

  // true si el técnico ya descargó sus tareas al menos una vez (hay copia local guardada).
  // Se usa solo como respaldo sin conexión, cuando no se puede consultar pendientesDescarga al servidor.
  async tieneTareasDescargadas(): Promise<boolean> {
    return (await dbLocal.tareasTecnicoOff.count()) > 0;
  }

  // Cambia el estado del bache. Con conexión intenta subirlo de una vez; si no hay conexión o el
  // servidor falla, el cambio queda guardado localmente con pendienteSubir=1 y se envía después
  // desde /sincronizacion. Antes de esto el cambio offline se perdía para siempre (bug B4).
  //
  // Devuelve si el cambio llegó al servidor (subido=true) o quedó pendiente (subido=false), para
  // que quien llama (seguimiento.ts) pueda avisarle al técnico que todavía falta enviarlo.
  async cambiarEstado(idRequerimiento: number, nuevoEstado: 'A' | 'E'): Promise<{ subido: boolean }> {
    let pendienteSubir: 0 | 1 = 1;

    if (this.connectionService.isOnline()) {
      try {
        await firstValueFrom(this.http.patch(`${this.API_URL}/${idRequerimiento}/atender`, { estado: nuevoEstado }));
        pendienteSubir = 0;
      } catch (error) {
        console.error('No se pudo actualizar el estado en el servidor, queda pendiente de subir:', error);
      }
    }

    const filasActualizadas = await dbLocal.tareasTecnicoOff
      .where('idRequerimiento')
      .equals(idRequerimiento)
      .modify({ estado: nuevoEstado, pendienteSubir });

    // La tarea puede no estar en la copia local: el mapa de seguimiento se alimenta de la lista
    // en vivo del servidor, no de tareasTecnicoOff. Si el cambio quedó pendiente y no había fila
    // que actualizar, se crea una entrada de cola para no perderlo (bug B4). Los campos de
    // presentación quedan vacíos a propósito: esta fila solo existe para cargar la respuesta
    // pendiente, y la próxima descargarTareas() reemplaza toda la tabla de todos modos.
    if (filasActualizadas === 0 && pendienteSubir === 1) {
      await dbLocal.tareasTecnicoOff.add({
        idRequerimiento,
        estado: nuevoEstado,
        nombreReporto: '',
        coordenadaX: 0,
        coordenadaY: 0,
        fechaIngreso: '',
        pendienteSubir: 1
      });
    }

    return { subido: pendienteSubir === 0 };
  }

  // Cuántos cambios de estado hechos en este dispositivo todavía no llegaron al servidor.
  async contarRespuestasPendientes(): Promise<number> {
    return dbLocal.tareasTecnicoOff.where('pendienteSubir').equals(1).count();
  }

  // Envía la cola de respuestas. Lo que falla se queda con pendienteSubir=1 para el próximo intento.
  async subirRespuestasPendientes(): Promise<{ enviados: number; fallidos: number }> {
    const pendientes = await dbLocal.tareasTecnicoOff.where('pendienteSubir').equals(1).toArray();

    let enviados = 0;
    let fallidos = 0;

    for (const tarea of pendientes) {
      try {
        await firstValueFrom(
          this.http.patch(`${this.API_URL}/${tarea.idRequerimiento}/atender`, { estado: tarea.estado })
        );
        await dbLocal.tareasTecnicoOff.update(tarea.id!, { pendienteSubir: 0 });
        enviados++;
      } catch (error) {
        console.error(`No se pudo subir la respuesta del bache ${tarea.idRequerimiento}:`, error);
        fallidos++;
      }
    }

    return { enviados, fallidos };
  }
}
