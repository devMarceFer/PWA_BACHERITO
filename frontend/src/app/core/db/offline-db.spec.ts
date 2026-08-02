import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie, { Table, Transaction } from 'dexie';
import 'fake-indexeddb/auto';
import {
  OfflineAppDB,
  TareaTecnicoOffline,
  MetaSync,
  ClaveMetaSync,
  migrarTareasAV9,
  dbLocal
} from './offline-db';

describe('OfflineAppDB - Versión 9: pendienteSubir y metaSyncOff', () => {
  let db: OfflineAppDB;

  beforeEach(async () => {
    // Crear una nueva instancia de BD para cada prueba
    db = new OfflineAppDB();
    await db.open();
  });

  afterEach(async () => {
    await db.close();
    await Dexie.delete('BacheritoOfflineDB');
  });

  describe('Interfaz TareaTecnicoOffline', () => {
    it('debe permitir crear una tarea con pendienteSubir = 0', async () => {
      const tarea: TareaTecnicoOffline = {
        idRequerimiento: 1,
        estado: 'A',
        nombreReporto: 'Prueba',
        coordenadaX: 10.5,
        coordenadaY: 20.5,
        fechaIngreso: '2025-08-01',
        pendienteSubir: 0
      };

      const id = await db.tareasTecnicoOff.add(tarea);
      const tareaGuardada = await db.tareasTecnicoOff.get(id);

      expect(tareaGuardada).toBeDefined();
      expect(tareaGuardada?.pendienteSubir).toBe(0);
    });

    it('debe permitir crear una tarea con pendienteSubir = 1', async () => {
      const tarea: TareaTecnicoOffline = {
        idRequerimiento: 2,
        estado: 'E',
        nombreReporto: 'Prueba 2',
        coordenadaX: 15.5,
        coordenadaY: 25.5,
        fechaIngreso: '2025-08-02',
        pendienteSubir: 1
      };

      const id = await db.tareasTecnicoOff.add(tarea);
      const tareaGuardada = await db.tareasTecnicoOff.get(id);

      expect(tareaGuardada).toBeDefined();
      expect(tareaGuardada?.pendienteSubir).toBe(1);
    });
  });

  describe('Tabla metaSyncOff', () => {
    it('debe existir la tabla metaSyncOff', async () => {
      expect(db.metaSyncOff).toBeDefined();
    });

    it('debe permitir insertar MetaSync con clave ultimaDescarga', async () => {
      const metaSync: MetaSync = {
        clave: 'ultimaDescarga',
        valor: Date.now()
      };

      const clave = await db.metaSyncOff.put(metaSync);
      const meta = await db.metaSyncOff.get('ultimaDescarga');

      expect(meta).toBeDefined();
      expect(meta?.clave).toBe('ultimaDescarga');
      expect(typeof meta?.valor).toBe('number');
    });

    it('debe permitir insertar MetaSync con clave ultimoEnvio', async () => {
      const metaSync: MetaSync = {
        clave: 'ultimoEnvio',
        valor: Date.now()
      };

      await db.metaSyncOff.put(metaSync);
      const meta = await db.metaSyncOff.get('ultimoEnvio');

      expect(meta).toBeDefined();
      expect(meta?.clave).toBe('ultimoEnvio');
      expect(typeof meta?.valor).toBe('number');
    });

    it('debe permitir actualizar valores de MetaSync', async () => {
      const timestamp1 = Date.now();
      const timestamp2 = timestamp1 + 1000;

      await db.metaSyncOff.put({ clave: 'ultimaDescarga', valor: timestamp1 });
      const meta1 = await db.metaSyncOff.get('ultimaDescarga');
      expect(meta1?.valor).toBe(timestamp1);

      await db.metaSyncOff.put({ clave: 'ultimaDescarga', valor: timestamp2 });
      const meta2 = await db.metaSyncOff.get('ultimaDescarga');
      expect(meta2?.valor).toBe(timestamp2);
    });
  });

  describe('Función migrarTareasAV9', () => {
    it('debe devolver el número de tareas migradas', async () => {
      // Crear una BD v8 (antes de la migración)
      const dbAntigua = new Dexie('TestMigracionDB');
      dbAntigua.version(8).stores({
        tareasTecnicoOff: '++id, idRequerimiento'
      });

      await dbAntigua.open();

      // Insertar algunas tareas antiguas
      await dbAntigua.table('tareasTecnicoOff').bulkAdd([
        {
          id: 1,
          idRequerimiento: 100,
          estado: 'A',
          nombreReporto: 'Tarea 1',
          coordenadaX: 10.5,
          coordenadaY: 20.5,
          fechaIngreso: '2025-08-01'
        },
        {
          id: 2,
          idRequerimiento: 101,
          estado: 'E',
          nombreReporto: 'Tarea 2',
          coordenadaX: 15.5,
          coordenadaY: 25.5,
          fechaIngreso: '2025-08-02'
        }
      ]);

      // Crear una BD v9 con la migración
      const dbNueva = new Dexie('TestMigracionDB');
      dbNueva.version(8).stores({
        tareasTecnicoOff: '++id, idRequerimiento'
      });

      dbNueva.version(9)
        .stores({
          tareasTecnicoOff: '++id, idRequerimiento, pendienteSubir',
          metaSyncOff: 'clave'
        })
        .upgrade(migrarTareasAV9);

      await dbNueva.open();

      // Verificar que las tareas se migraron con pendienteSubir = 0
      const tareas = await dbNueva.table('tareasTecnicoOff').toArray();
      expect(tareas.length).toBe(2);
      expect(tareas[0].pendienteSubir).toBe(0);
      expect(tareas[1].pendienteSubir).toBe(0);

      await dbAntigua.close();
      await dbNueva.close();
      await Dexie.delete('TestMigracionDB');
    });
  });
});
