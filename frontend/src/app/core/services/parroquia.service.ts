import { Injectable } from '@angular/core';
import { dbLocal, ParroquiaOffline } from '../db/offline-db';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root' // Lo hace singleton y accesible en toda la app
})
export class ParroquiaService {
  private readonly API_URL = `${environment.apiUrl}/parroquias`;

  /**
   * Obtiene las parroquias. 
   * Intenta primero por HTTP (Online). Si falla o no hay red, recurre a IndexedDB (Offline).
   */
  async obtenerParroquias(cantonId: string = '184'): Promise<ParroquiaOffline[]> {
    try {
      // Intentamos hacer la petición al backend de Oracle
      const response = await fetch(`${this.API_URL}?canton=${cantonId}`);
      const resultado = await response.json();

      if (resultado.success && resultado.data.length > 0) {
        console.log('🌐 Datos obtenidos desde Oracle (Backend). Sincronizando almacenamiento offline...');
        
        // Limpiamos datos viejos e insertamos los nuevos en el dispositivo de forma masiva
        await dbLocal.parroquiasOff.clear();

        // Mapeamos las llaves del backend (nombre, codigo) a la BD local
        await dbLocal.parroquiasOff.bulkPut(resultado.data);

        return resultado.data;
      }
    } catch (error) {
      console.warn('📶 Modo Offline detectado o servidor inaccesible. Recuperando datos locales del dispositivo...');
    }

    // Si falló el internet, extraemos los datos guardados en IndexedDB
    const datosLocales = await dbLocal.parroquiasOff.toArray();
    console.log(`📱 Se cargaron ${datosLocales.length} parroquias desde el almacenamiento local.`);
    return datosLocales;
  }
}