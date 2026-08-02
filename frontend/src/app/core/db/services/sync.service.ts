import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { dbLocal, reporteOfflineAPayload } from '../offline-db';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  private http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/requerimientos`;

  // Envía al backend los reportes guardados en el dispositivo. La fila NO se borra: se marca
  // SINCRONIZADO=1 y se vacía FOTOGRAFIA (el base64 es lo pesado), para que la pantalla de
  // Sincronización pueda mostrar el contador de "Reportes sincronizados" sin llenar IndexedDB.
  // Lo que falla se queda en la cola con SINCRONIZADO=0 para el siguiente intento.
  async sincronizarReportesPendientes(): Promise<{ enviados: number; fallidos: number }> {
    const pendientes = await dbLocal.reportesOff
      .where('SINCRONIZADO')
      .equals(0)
      .toArray();

    let enviados = 0;
    let fallidos = 0;

    for (const reporte of pendientes) {
      try {
        await firstValueFrom(this.http.post(this.API_URL, reporteOfflineAPayload(reporte)));
        await dbLocal.reportesOff.update(reporte.id!, { SINCRONIZADO: 1, FOTOGRAFIA: null });
        enviados++;
      } catch (error) {
        console.error(`Error sincronizando reporte ${reporte.id}:`, error);
        fallidos++;
      }
    }

    return { enviados, fallidos };
  }
}
