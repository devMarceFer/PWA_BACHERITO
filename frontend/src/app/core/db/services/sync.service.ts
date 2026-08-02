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

  // Busca reportes pendientes en Dexie y los envía al backend
  async sincronizarReportesPendientes() {
    // 1. Obtenemos de Dexie todos los reportes locales con sincronizado = 0
    const pendientes = await dbLocal.reportesOff
      .where('SINCRONIZADO')
      .equals(0)
      .toArray();

    if (pendientes.length === 0) return;

    console.log(`Sincronizando ${pendientes.length} reportes pendientes...`);

    for (const reporte of pendientes) {
      try {
        await firstValueFrom(this.http.post(this.API_URL, reporteOfflineAPayload(reporte)));
        
        // 2. Si se sube con éxito, lo eliminamos de Dexie o lo marcamos como sincronizado
        await dbLocal.reportesOff.delete(reporte.id!);
        console.log(`Reporte ${reporte.id} sincronizado y eliminado localmente.`);
      } catch (error) {
        console.error(`Error sincronizando reporte ${reporte.id}:`, error);
        // Si falla (ej. error de servidor), lo dejamos en Dexie para reintentar después
      }
    }
  }
}