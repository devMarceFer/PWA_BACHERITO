import { Injectable, inject, signal } from '@angular/core';
import { dbLocal, ClaveMetaSync } from '../offline-db';
import { SyncService } from './sync.service';
import { MisTareasService } from '../../services/mis-tareas.service';
import { ParroquiaService } from '../../services/parroquia.service';

// Orquesta todo lo que la pantalla /sincronizacion necesita. No habla con HttpClient directo:
// delega en los servicios que ya existen y se encarga solo de la coordinación, los contadores
// y las marcas de tiempo. Es la única fuente de verdad de los contadores de sincronización.
@Injectable({
  providedIn: 'root'
})
export class SincronizacionService {
  private syncService = inject(SyncService);
  private misTareasService = inject(MisTareasService);
  private parroquiaService = inject(ParroquiaService);

  private readonly _reportesPendientes = signal(0);
  private readonly _reportesSincronizados = signal(0);
  private readonly _respuestasPendientes = signal(0);
  private readonly _ultimaDescarga = signal<number | null>(null);
  private readonly _ultimoEnvio = signal<number | null>(null);
  private readonly _ocupado = signal(false);

  readonly reportesPendientes = this._reportesPendientes.asReadonly();
  readonly reportesSincronizados = this._reportesSincronizados.asReadonly();
  readonly respuestasPendientes = this._respuestasPendientes.asReadonly();
  readonly ultimaDescarga = this._ultimaDescarga.asReadonly();
  readonly ultimoEnvio = this._ultimoEnvio.asReadonly();
  readonly ocupado = this._ocupado.asReadonly();

  async refrescarContadores(): Promise<void> {
    this._reportesPendientes.set(await dbLocal.reportesOff.where('SINCRONIZADO').equals(0).count());
    this._reportesSincronizados.set(await dbLocal.reportesOff.where('SINCRONIZADO').equals(1).count());
    this._respuestasPendientes.set(await this.misTareasService.contarRespuestasPendientes());
    this._ultimaDescarga.set(await this.leerMeta('ultimaDescarga'));
    this._ultimoEnvio.set(await this.leerMeta('ultimoEnvio'));
  }

  // Baja las tareas del grupo y el catálogo de parroquias para poder trabajar sin conexión.
  // Se bloquea si hay respuestas sin enviar: la descarga reemplaza tareasTecnicoOff por completo,
  // así que sin este freno las respuestas pendientes se perderían en silencio.
  async descargarRecursos(): Promise<{ ok: boolean; mensaje: string }> {
    const pendientes = this._respuestasPendientes();
    if (pendientes > 0) {
      return {
        ok: false,
        mensaje: `Tienes ${pendientes} ${pendientes === 1 ? 'respuesta' : 'respuestas'} sin enviar. Súbelas antes de descargar.`
      };
    }

    this._ocupado.set(true);
    try {
      await this.misTareasService.descargarTareas();
      await this.parroquiaService.obtenerParroquias();
      await this.escribirMeta('ultimaDescarga', Date.now());
      return { ok: true, mensaje: 'Recursos descargados. Ya puedes trabajar sin conexión.' };
    } catch (error) {
      console.error('No se pudieron descargar los recursos:', error);
      return { ok: false, mensaje: 'No se pudieron descargar los recursos. Verifica tu conexión.' };
    } finally {
      this._ocupado.set(false);
      await this.refrescarContadores();
    }
  }

  // Envía las dos colas: primero las respuestas del técnico, luego los baches reportados offline.
  // La fecha de último envío solo se guarda si no quedó nada pendiente.
  async subirRespuestas(): Promise<{ ok: boolean; mensaje: string }> {
    this._ocupado.set(true);
    try {
      const respuestas = await this.misTareasService.subirRespuestasPendientes();
      const reportes = await this.syncService.sincronizarReportesPendientes();

      const enviados = respuestas.enviados + reportes.enviados;
      const fallidos = respuestas.fallidos + reportes.fallidos;

      if (enviados === 0 && fallidos === 0) {
        return { ok: true, mensaje: 'Sin respuestas pendientes.' };
      }

      if (fallidos > 0) {
        return {
          ok: false,
          mensaje: `Se enviaron ${enviados} de ${enviados + fallidos}. Quedan ${fallidos} pendientes.`
        };
      }

      await this.escribirMeta('ultimoEnvio', Date.now());
      return { ok: true, mensaje: `Se enviaron ${enviados} elementos.` };
    } finally {
      this._ocupado.set(false);
      await this.refrescarContadores();
    }
  }

  // Borra los datos del dispositivo. No cierra la sesión (el JWT vive en localStorage) ni toca
  // el caché del service worker: la app sigue instalada y abriendo sin conexión.
  async borrarCache(): Promise<void> {
    await dbLocal.reportesOff.clear();
    await dbLocal.tareasTecnicoOff.clear();
    await dbLocal.parroquiasOff.clear();
    await dbLocal.metaSyncOff.clear();
    await this.refrescarContadores();
  }

  private async leerMeta(clave: ClaveMetaSync): Promise<number | null> {
    return (await dbLocal.metaSyncOff.get(clave))?.valor ?? null;
  }

  private async escribirMeta(clave: ClaveMetaSync, valor: number): Promise<void> {
    await dbLocal.metaSyncOff.put({ clave, valor });
  }
}
