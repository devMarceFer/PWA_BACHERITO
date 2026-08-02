import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { MisTareasService } from './mis-tareas.service';
import { ConnectionService } from '../db/services/connection.service';
import { dbLocal, TareaTecnicoOffline } from '../db/offline-db';

function tareaDePrueba(idRequerimiento: number, pendienteSubir: 0 | 1 = 0): TareaTecnicoOffline {
  return {
    idRequerimiento,
    estado: 'I',
    nombreReporto: 'Vecino',
    coordenadaX: -78.62722,
    coordenadaY: -1.24908,
    fechaIngreso: '2026-07-01',
    pendienteSubir
  };
}

describe('MisTareasService', () => {
  let servicio: MisTareasService;
  let httpFalso: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn> };
  let enLinea: ReturnType<typeof signal<boolean>>;

  beforeEach(async () => {
    await dbLocal.tareasTecnicoOff.clear();
    enLinea = signal(true);
    httpFalso = {
      get: vi.fn(() => of({ success: true, tareas: [], total: 0, atendidas: 0, pendientesDescarga: 0 })),
      post: vi.fn(() => of({ success: true })),
      patch: vi.fn(() => of({ success: true }))
    };

    TestBed.configureTestingModule({
      providers: [
        MisTareasService,
        { provide: HttpClient, useValue: httpFalso },
        { provide: ConnectionService, useValue: { isOnline: enLinea } }
      ]
    });
    servicio = TestBed.inject(MisTareasService);
  });

  describe('cambiarEstado', () => {
    it('sin conexión deja la tarea marcada como pendiente de subir (B4)', async () => {
      enLinea.set(false);
      await dbLocal.tareasTecnicoOff.add(tareaDePrueba(57));

      await servicio.cambiarEstado(57, 'A');

      const tarea = await dbLocal.tareasTecnicoOff.where('idRequerimiento').equals(57).first();
      expect(httpFalso.patch).not.toHaveBeenCalled();
      expect(tarea?.estado).toBe('A');
      expect(tarea?.pendienteSubir).toBe(1);
    });

    it('con conexión sube el cambio y no lo deja pendiente', async () => {
      await dbLocal.tareasTecnicoOff.add(tareaDePrueba(57));

      await servicio.cambiarEstado(57, 'E');

      const tarea = await dbLocal.tareasTecnicoOff.where('idRequerimiento').equals(57).first();
      expect(httpFalso.patch).toHaveBeenCalledTimes(1);
      expect(tarea?.estado).toBe('E');
      expect(tarea?.pendienteSubir).toBe(0);
    });

    it('si el servidor falla estando en línea, lo deja pendiente en vez de perderlo', async () => {
      httpFalso.patch.mockImplementation(() => throwError(() => new Error('500')));
      await dbLocal.tareasTecnicoOff.add(tareaDePrueba(57));

      await servicio.cambiarEstado(57, 'A');

      const tarea = await dbLocal.tareasTecnicoOff.where('idRequerimiento').equals(57).first();
      expect(tarea?.estado).toBe('A');
      expect(tarea?.pendienteSubir).toBe(1);
    });
  });

  describe('subirRespuestasPendientes', () => {
    it('no hace peticiones si no hay pendientes', async () => {
      await dbLocal.tareasTecnicoOff.add(tareaDePrueba(57, 0));

      const resultado = await servicio.subirRespuestasPendientes();

      expect(httpFalso.patch).not.toHaveBeenCalled();
      expect(resultado).toEqual({ enviados: 0, fallidos: 0 });
    });

    it('sube las pendientes y las marca como enviadas', async () => {
      await dbLocal.tareasTecnicoOff.add({ ...tareaDePrueba(57, 1), estado: 'A' });
      await dbLocal.tareasTecnicoOff.add({ ...tareaDePrueba(58, 1), estado: 'E' });

      const resultado = await servicio.subirRespuestasPendientes();

      expect(resultado).toEqual({ enviados: 2, fallidos: 0 });
      expect(await servicio.contarRespuestasPendientes()).toBe(0);
    });

    it('deja en cola la que falló', async () => {
      await dbLocal.tareasTecnicoOff.add({ ...tareaDePrueba(57, 1), estado: 'A' });
      await dbLocal.tareasTecnicoOff.add({ ...tareaDePrueba(58, 1), estado: 'A' });
      httpFalso.patch
        .mockImplementationOnce(() => of({ success: true }))
        .mockImplementationOnce(() => throwError(() => new Error('sin red')));

      const resultado = await servicio.subirRespuestasPendientes();

      expect(resultado).toEqual({ enviados: 1, fallidos: 1 });
      expect(await servicio.contarRespuestasPendientes()).toBe(1);
    });
  });

  describe('descargarTareas', () => {
    it('reemplaza la copia local con pendienteSubir en 0', async () => {
      await dbLocal.tareasTecnicoOff.add(tareaDePrueba(99, 1));
      httpFalso.get.mockImplementation(() => of({
        success: true,
        total: 1,
        atendidas: 0,
        pendientesDescarga: 0,
        tareas: [{
          idRequerimiento: 57, nombres: 'Ana', coordenadaX: -78.6, coordenadaY: -1.2,
          parroquiaNombre: 'Matriz', estado: 'INGRESADO', estadoCrudo: 'I',
          fechaIngreso: '2026-07-01', idGrupo: 1, nombreGrupo: 'Cuadrilla 1'
        }]
      }));

      await servicio.descargarTareas();

      const tareas = await dbLocal.tareasTecnicoOff.toArray();
      expect(tareas).toHaveLength(1);
      expect(tareas[0].idRequerimiento).toBe(57);
      expect(tareas[0].pendienteSubir).toBe(0);
    });
  });
});
