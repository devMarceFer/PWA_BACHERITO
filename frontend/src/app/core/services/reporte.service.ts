import { inject, Injectable, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ConnectionService } from '../db/services/connection.service';
import { SyncService } from '../db/services/sync.service';
import { dbLocal, ReporteOffline, reporteOfflineAPayload } from '../db/offline-db';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ReporteService {
  private http = inject(HttpClient);
  private connectionService = inject(ConnectionService);
  private syncService = inject(SyncService);
  private authService = inject(AuthService);

  private readonly API_URL = `${environment.apiUrl}/requerimientos`;

  constructor() {
    // Cada vez que el dispositivo recupera conexión, intenta subir lo guardado en Dexie
    effect(() => {
      if (this.connectionService.isOnline()) {
        this.syncService.sincronizarReportesPendientes();
      }
    });
  }

  // Método unificado que llama el componente Reportar.
  // Las coordenadas viajan crudas (WGS84) y la foto en base64: el backend calcula X/Y (UTM)
  // y sube la imagen al SFTP tanto en el envío en vivo como al sincronizar lo guardado offline.
  async enviarReporte(datosFormulario: {
    parroquia: number;
    coordenadas: { lat: number; lng: number } | null;
    foto: string | null;
  }) {
    const fechaActual = Date.now();

    const nuevoReporte: Omit<ReporteOffline, 'NOMBRE_IMAGEN'> = {
      NOMBRES: this.authService.nombreActual() || this.authService.usuarioActual() || 'Ciudadano',
      CEDULA: this.authService.cedulaActual() ?? '',
      TELEFONO: this.authService.telefonoActual() ?? '',
      PARROQUIA: Number(datosFormulario.parroquia),
      // OP_BACHERITO_REQ.COORDENADAX/COORDENADAY guardan longitud/latitud (no lat/lng en ese
      // orden) — misma convención que ya usa el mapa de seguimiento y el resto del backend.
      COORDENADAX: datosFormulario.coordenadas ? datosFormulario.coordenadas.lng.toString() : '0',
      COORDENADAY: datosFormulario.coordenadas ? datosFormulario.coordenadas.lat.toString() : '0',
      X: null,
      Y: null,
      ESTADO: 'N', // Nuevo: recién reportado, aparece en rojo en el mapa de seguimiento
      FECHA_INGRESO: fechaActual,
      FOTOGRAFIA: datosFormulario.foto,
      SINCRONIZADO: 0
    };

    if (this.connectionService.isOnline()) {
      try {
        await firstValueFrom(this.http.post(this.API_URL, reporteOfflineAPayload(nuevoReporte as ReporteOffline)));
        return { success: true, offline: false, message: 'Reporte enviado con éxito.', reporteGuardado: null };
      } catch (error) {
        console.error('Servidor no disponible, guardando localmente:', error);
        const reporteGuardado = await this.guardarLocal(nuevoReporte, fechaActual);
        return { success: true, offline: true, message: 'Servidor no disponible. Reporte guardado localmente.', reporteGuardado };
      }
    }

    const reporteGuardado = await this.guardarLocal(nuevoReporte, fechaActual);
    return { success: true, offline: true, message: 'Sin conexión. Reporte guardado localmente.', reporteGuardado };
  }

  // Guarda en Dexie y devuelve el registro completo tal cual quedó almacenado, para que la
  // pantalla pueda mostrárselo al ciudadano (popup de confirmación) sin volver a consultar la BD.
  private async guardarLocal(reporte: Omit<ReporteOffline, 'NOMBRE_IMAGEN'>, fechaActual: number): Promise<ReporteOffline> {
    // 1. Insertamos primero para obtener el ID autoincremental de Dexie
    const idGenerado = await dbLocal.reportesOff.add(reporte as ReporteOffline);

    // 2. Formateamos el NOMBRE_IMAGEN: id + usuario + fecha + bache_ant.png
    const usuario = (this.authService.usuarioActual() ?? 'ciudadano').replace(/[^a-zA-Z0-9]/g, '_');
    const nombreImagenFormateado = `${idGenerado}_${usuario}_${fechaActual}_bache_ant.png`;
    await dbLocal.reportesOff.update(idGenerado, { NOMBRE_IMAGEN: nombreImagenFormateado });

    console.log(`Reporte ${idGenerado} guardado localmente en Dexie. Imagen: ${nombreImagenFormateado}`);

    return { ...reporte, id: idGenerado, NOMBRE_IMAGEN: nombreImagenFormateado } as ReporteOffline;
  }

  // Reportes guardados localmente que aún no se han subido al servidor
  async contarPendientesSincronizacion(): Promise<number> {
    return dbLocal.reportesOff.where('SINCRONIZADO').equals(0).count();
  }
}
