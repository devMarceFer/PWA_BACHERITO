import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import {
  OfflineAppDB,
  TareaTecnicoOffline,
  MetaSync,
  ClaveMetaSync,
  migrarTareasAV9
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

    it('devuelve undefined si la clave nunca se escribió', async () => {
      expect(await db.metaSyncOff.get('ultimoEnvio')).toBeUndefined();
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

  // La prueba de arriba solo verifica migrarTareasAV9 en aislamiento, contra un esquema v8
  // hecho a mano de dos versiones. Un técnico real llega a v9 caminando TODA la cadena desde v3,
  // que incluye los renombres de v5 (con `null` para borrar las tablas viejas), el
  // borra-y-recrea de tareasTecnicoOff en v6/v7 (cambia de keyPath idRequerimiento a ++id) y el
  // `estadoBacheOff: null` de v8. Esta prueba camina esa cadena real, con datos sembrados como
  // llegarían en un dispositivo que ya tenía la app instalada antes de este ticket (parado en v8).
  describe('Cadena de migración completa v3 -> v9 (dispositivo real)', () => {
    const NOMBRE_BD = 'BacheritoMigracionCadenaCompletaTest';

    afterEach(async () => {
      await Dexie.delete(NOMBRE_BD);
    });

    // Declara la cadena de versiones exactamente como offline-db.ts, hasta v8 (todavía sin la
    // migración que se está probando). Se reutiliza en los dos "opens" de la prueba: el primero
    // sirve para sembrar datos tal como quedarían en un dispositivo real antes de este ticket; el
    // segundo reabre la MISMA base agregando recién ahí la v9 real, para que Dexie de verdad
    // ejecute la migración (y no una re-declaración de la v9 hecha a mano en el test).
    function declararHastaV8(db: Dexie) {
      db.version(3).stores({
        parroquias: 'codigo, nombre',
        reportes: '++id, PARROQUIA, SINCRONIZADO, FECHA_INGRESO'
      });
      db.version(4).stores({
        parroquias: 'codigo, nombre',
        reportes: '++id, PARROQUIA, SINCRONIZADO, FECHA_INGRESO',
        tareasTecnico: 'idRequerimiento, estadoCrudo, atendidoPendienteSubir'
      });
      db.version(5).stores({
        parroquias: null,
        reportes: null,
        tareasTecnico: null,
        parroquiasOff: 'codigo',
        reportesOff: '++id, SINCRONIZADO, FECHA_INGRESO',
        tareasTecnicoOff: 'idRequerimiento, atendidoPendienteSubir',
        estadoBacheOff: 'idReporte, sincronizado'
      });
      db.version(6).stores({
        tareasTecnicoOff: null
      });
      db.version(7).stores({
        tareasTecnicoOff: '++id, idRequerimiento'
      });
      db.version(8).stores({
        estadoBacheOff: null
      });
    }

    it('conserva reportesOff intacto, migra tareasTecnicoOff con pendienteSubir=0 y deja el índice pendienteSubir usable', async () => {
      // 1. Dispositivo que ya tenía la app instalada antes de este ticket: llega hasta v8, con un
      // reporte offline pendiente y dos tareas asignadas (forma v7: sin pendienteSubir).
      const dbVieja = new Dexie(NOMBRE_BD);
      declararHastaV8(dbVieja);
      await dbVieja.open();

      const reporteSembrado = {
        NOMBRES: 'Ana Vecina', CEDULA: '1804567890', TELEFONO: '0999999999', PARROQUIA: 1,
        COORDENADAX: '-78.62722', COORDENADAY: '-1.24908', X: null, Y: null, ESTADO: 'N',
        FECHA_INGRESO: 1754150400000, FOTOGRAFIA: 'data:image/png;base64,AAAA',
        NOMBRE_IMAGEN: '1_ana_test_bache_ant.png', SINCRONIZADO: 0
      };
      await dbVieja.table('reportesOff').add(reporteSembrado);

      await dbVieja.table('tareasTecnicoOff').bulkAdd([
        { idRequerimiento: 57, estado: 'I', nombreReporto: 'Ana', coordenadaX: -78.6, coordenadaY: -1.2, fechaIngreso: '2026-07-01' },
        { idRequerimiento: 58, estado: 'E', nombreReporto: 'Luis', coordenadaX: -78.7, coordenadaY: -1.3, fechaIngreso: '2026-07-02' }
      ]);
      dbVieja.close();

      // 2. Se reabre la MISMA base, ahora con la cadena completa hasta v9 tal cual offline-db.ts,
      // usando la función real migrarTareasAV9 (no una copia de prueba).
      const dbNueva = new Dexie(NOMBRE_BD);
      declararHastaV8(dbNueva);
      dbNueva.version(9)
        .stores({
          tareasTecnicoOff: '++id, idRequerimiento, pendienteSubir',
          metaSyncOff: 'clave'
        })
        .upgrade(migrarTareasAV9);
      await dbNueva.open();

      // reportesOff nunca se vuelve a redefinir después de v5: debe sobrevivir intacto toda la
      // cadena v6->v9, con sus campos tal cual (incluida la foto en base64).
      const reportes = await dbNueva.table('reportesOff').toArray();
      expect(reportes).toHaveLength(1);
      expect(reportes[0]).toMatchObject(reporteSembrado);

      // tareasTecnicoOff: las dos tareas sembradas (forma v7, sin pendienteSubir) sobreviven al
      // borra-y-recrea de v6/v7 (porque se sembraron DESPUÉS de esa migración, como en un
      // dispositivo real) y quedan con pendienteSubir=0 tras la migración v9.
      const tareas = await dbNueva.table('tareasTecnicoOff').toArray();
      expect(tareas).toHaveLength(2);
      expect(tareas.every((t) => t.pendienteSubir === 0)).toBe(true);

      // El índice pendienteSubir existe de verdad y filtra (no solo "no revienta"): se agrega una
      // fila pendiente nueva, como haría cambiarEstado() sin conexión, y el cursor debe encontrar
      // solo esa, sin mezclar las que ya quedaron en 0.
      await dbNueva.table('tareasTecnicoOff').add({
        idRequerimiento: 99, estado: 'A', nombreReporto: 'Pedro',
        coordenadaX: -78.5, coordenadaY: -1.1, fechaIngreso: '2026-07-03', pendienteSubir: 1
      });

      const pendientes = await dbNueva.table('tareasTecnicoOff').where('pendienteSubir').equals(1).toArray();
      expect(pendientes).toHaveLength(1);
      expect(pendientes[0].idRequerimiento).toBe(99);

      const sincronizadas = await dbNueva.table('tareasTecnicoOff').where('pendienteSubir').equals(0).count();
      expect(sincronizadas).toBe(2);

      dbNueva.close();
    });
  });
});
