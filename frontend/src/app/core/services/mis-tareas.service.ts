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
      fechaIngreso: t.fechaIngreso
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

  // Si hay conexión, cambia el estado directamente en el servidor y refleja el cambio localmente.
  // Sin conexión: NOTA para QA — tareasTecnicoOff ya no tiene un campo de "pendiente de subir"
  // (se quitó al simplificar el esquema a solo los campos pedidos), así que cambiar el estado
  // offline solo actualiza la vista local; ese cambio no se reenvía al servidor al reconectar.
  async cambiarEstado(idRequerimiento: number, nuevoEstado: 'A' | 'E'): Promise<void> {
    if (this.connectionService.isOnline()) {
      try {
        await firstValueFrom(this.http.patch(`${this.API_URL}/${idRequerimiento}/atender`, { estado: nuevoEstado }));
      } catch (error) {
        console.error('No se pudo actualizar el estado en el servidor:', error);
        return;
      }
    }

    await dbLocal.tareasTecnicoOff.where('idRequerimiento').equals(idRequerimiento).modify({ estado: nuevoEstado });
  }
}
