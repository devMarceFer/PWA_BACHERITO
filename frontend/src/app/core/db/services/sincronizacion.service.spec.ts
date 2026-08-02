import { TestBed } from '@angular/core/testing';
import { SincronizacionService } from './sincronizacion.service';
import { SyncService } from './sync.service';
import { MisTareasService } from '../../services/mis-tareas.service';
import { ParroquiaService } from '../../services/parroquia.service';
import { dbLocal, ReporteOffline, TareaTecnicoOffline } from '../offline-db';

function reporte(sincronizado: 0 | 1): ReporteOffline {
  return {
    NOMBRES: 'Vecino', CEDULA: '1804567890', TELEFONO: '0999999999', PARROQUIA: 1,
    COORDENADAX: '-78.62722', COORDENADAY: '-1.24908', X: null, Y: null, ESTADO: 'N',
    FECHA_INGRESO: 1754150400000, FOTOGRAFIA: null, NOMBRE_IMAGEN: 'x.png',
    SINCRONIZADO: sincronizado
  };
}

function tarea(idRequerimiento: number, pendienteSubir: 0 | 1): TareaTecnicoOffline {
  return {
    idRequerimiento, estado: 'I', nombreReporto: 'Vecino',
    coordenadaX: -78.62722, coordenadaY: -1.24908,
    fechaIngreso: '2026-07-01', pendienteSubir
  };
}

describe('SincronizacionService', () => {
  let servicio: SincronizacionService;
  let syncFalso: { sincronizarReportesPendientes: ReturnType<typeof vi.fn> };
  let misTareasFalso: {
    descargarTareas: ReturnType<typeof vi.fn>;
    subirRespuestasPendientes: ReturnType<typeof vi.fn>;
    contarRespuestasPendientes: ReturnType<typeof vi.fn>;
  };
  let parroquiasFalso: { obtenerParroquias: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    await dbLocal.reportesOff.clear();
    await dbLocal.tareasTecnicoOff.clear();
    await dbLocal.parroquiasOff.clear();
    await dbLocal.metaSyncOff.clear();

    syncFalso = { sincronizarReportesPendientes: vi.fn(async () => ({ enviados: 0, fallidos: 0 })) };
    misTareasFalso = {
      descargarTareas: vi.fn(async () => undefined),
      subirRespuestasPendientes: vi.fn(async () => ({ enviados: 0, fallidos: 0 })),
      contarRespuestasPendientes: vi.fn(async () => dbLocal.tareasTecnicoOff.where('pendienteSubir').equals(1).count())
    };
    parroquiasFalso = { obtenerParroquias: vi.fn(async () => []) };

    TestBed.configureTestingModule({
      providers: [
        SincronizacionService,
        { provide: SyncService, useValue: syncFalso },
        { provide: MisTareasService, useValue: misTareasFalso },
        { provide: ParroquiaService, useValue: parroquiasFalso }
      ]
    });
    servicio = TestBed.inject(SincronizacionService);
  });

  describe('refrescarContadores', () => {
    it('lee los cuatro contadores desde IndexedDB', async () => {
      await dbLocal.reportesOff.bulkAdd([reporte(0), reporte(0), reporte(1)]);
      await dbLocal.tareasTecnicoOff.bulkAdd([tarea(57, 1), tarea(58, 0)]);
      await dbLocal.metaSyncOff.put({ clave: 'ultimaDescarga', valor: 1754150400000 });

      await servicio.refrescarContadores();

      expect(servicio.reportesPendientes()).toBe(2);
      expect(servicio.reportesSincronizados()).toBe(1);
      expect(servicio.respuestasPendientes()).toBe(1);
      expect(servicio.ultimaDescarga()).toBe(1754150400000);
      expect(servicio.ultimoEnvio()).toBeNull();
    });
  });

  describe('descargarRecursos', () => {
    it('se bloquea si hay respuestas sin enviar (D5)', async () => {
      await dbLocal.tareasTecnicoOff.add(tarea(57, 1));
      await servicio.refrescarContadores();

      const resultado = await servicio.descargarRecursos();

      expect(resultado.ok).toBe(false);
      expect(resultado.mensaje).toContain('1');
      expect(misTareasFalso.descargarTareas).not.toHaveBeenCalled();
      expect(await dbLocal.tareasTecnicoOff.count()).toBe(1); // no se borró nada
    });

    it('descarga tareas y parroquias, y guarda la fecha', async () => {
      const resultado = await servicio.descargarRecursos();

      expect(resultado.ok).toBe(true);
      expect(misTareasFalso.descargarTareas).toHaveBeenCalledTimes(1);
      expect(parroquiasFalso.obtenerParroquias).toHaveBeenCalledTimes(1);
      expect(servicio.ultimaDescarga()).not.toBeNull();
    });

    it('no guarda la fecha si la descarga falla', async () => {
      misTareasFalso.descargarTareas.mockImplementation(async () => { throw new Error('sin red'); });

      const resultado = await servicio.descargarRecursos();

      expect(resultado.ok).toBe(false);
      expect(servicio.ultimaDescarga()).toBeNull();
    });
  });

  describe('subirRespuestas', () => {
    it('informa cuando no hay nada que enviar', async () => {
      const resultado = await servicio.subirRespuestas();

      expect(resultado.ok).toBe(true);
      expect(resultado.mensaje).toBe('Sin respuestas pendientes.');
      expect(servicio.ultimoEnvio()).toBeNull();
    });

    it('guarda la fecha de envío solo si todo salió bien', async () => {
      misTareasFalso.subirRespuestasPendientes.mockImplementation(async () => ({ enviados: 2, fallidos: 0 }));
      syncFalso.sincronizarReportesPendientes.mockImplementation(async () => ({ enviados: 1, fallidos: 0 }));

      const resultado = await servicio.subirRespuestas();

      expect(resultado.ok).toBe(true);
      expect(resultado.mensaje).toBe('Se enviaron 3 elementos.');
      expect(servicio.ultimoEnvio()).not.toBeNull();
    });

    it('reporta el parcial y no guarda la fecha si algo falló', async () => {
      misTareasFalso.subirRespuestasPendientes.mockImplementation(async () => ({ enviados: 2, fallidos: 1 }));
      syncFalso.sincronizarReportesPendientes.mockImplementation(async () => ({ enviados: 2, fallidos: 1 }));

      const resultado = await servicio.subirRespuestas();

      expect(resultado.ok).toBe(false);
      expect(resultado.mensaje).toBe('Se enviaron 4 de 6. Quedan 2 pendientes.');
      expect(servicio.ultimoEnvio()).toBeNull();
    });
  });

  describe('borrarCache', () => {
    it('vacía las cuatro tablas y deja los contadores en cero', async () => {
      await dbLocal.reportesOff.bulkAdd([reporte(0), reporte(1)]);
      await dbLocal.tareasTecnicoOff.add(tarea(57, 1));
      await dbLocal.parroquiasOff.add({ codigo: 1, nombre: 'Matriz' });
      await dbLocal.metaSyncOff.put({ clave: 'ultimaDescarga', valor: 1754150400000 });

      await servicio.borrarCache();

      expect(await dbLocal.reportesOff.count()).toBe(0);
      expect(await dbLocal.tareasTecnicoOff.count()).toBe(0);
      expect(await dbLocal.parroquiasOff.count()).toBe(0);
      expect(await dbLocal.metaSyncOff.count()).toBe(0);
      expect(servicio.reportesPendientes()).toBe(0);
      expect(servicio.reportesSincronizados()).toBe(0);
      expect(servicio.respuestasPendientes()).toBe(0);
      expect(servicio.ultimaDescarga()).toBeNull();
    });
  });
});
