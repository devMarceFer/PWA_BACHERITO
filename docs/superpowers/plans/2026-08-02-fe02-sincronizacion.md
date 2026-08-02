# FE-02 — Pantalla de Sincronización · Plan de Implementación

> **Para agentes ejecutores:** SUB-SKILL REQUERIDA: usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** Crear la pantalla `/sincronizacion` que le da al técnico control manual sobre la descarga de recursos, la subida de las dos colas offline y el borrado de caché, cerrando el bug B4 (cambios de estado offline que nunca llegaban al servidor).

**Arquitectura:** Un servicio orquestador (`SincronizacionService`) coordina los servicios que ya existen (`MisTareasService`, `ParroquiaService`, `SyncService`) y expone los contadores como `signal`s. El componente solo pinta signals. La cola de respuestas pendientes se implementa con un campo nuevo `pendienteSubir` en Dexie v9.

**Stack:** Angular 22 (standalone + signals), Dexie 4, Tailwind 4, Angular Material Icons, Vitest + jsdom + fake-indexeddb.

**Spec de referencia:** `docs/superpowers/specs/2026-08-02-fe02-sincronizacion-design.md`

## Restricciones globales

- **Todo en español**: nombres de métodos, variables, comentarios, textos de UI y mensajes de commit. Es instrucción permanente del usuario.
- **No tocar el backend.** Este plan no crea ni modifica endpoints. Usa los que ya existen: `GET /api/mis-tareas`, `POST /api/mis-tareas/marcar-descargado`, `PATCH /api/mis-tareas/:id/atender`, `GET /api/parroquias`, `POST /api/requerimientos`.
- **Convención de coordenadas:** `COORDENADAX` = longitud, `COORDENADAY` = latitud. No tocar ni "corregir".
- **No tocar** `B1` (login Cognito), `B2` (UTM), `B3` (`environment.prod.ts`), `B5` (filas 57/58/59), `B7` (`ESTADO: 'N'`). Están fuera de alcance por instrucción explícita.
- **Rama de trabajo:** `feat/fe02-sincronizacion` (ya creada).
- Todos los comandos se ejecutan desde `frontend/`.
- Cada tarea termina en commit. Formato de mensaje: `feat: ...` o `fix: ...` o `test: ...`, en español, sin punto final.

---

## Estado del baseline (verificado el 2026-08-02)

`npm test` **falla hoy**, antes de tocar nada:

```
Test Files  1 failed | 7 passed (8)
     Tests  1 failed | 8 passed (9)
    Errors  3 errors
```

Dos causas distintas, ambas se arreglan en la Tarea 1:

1. `login.spec.ts` → `NG0201: No provider found for ActivatedRoute` (el componente usa `routerLink` y el TestBed no provee router).
2. `reportar.spec.ts` y `seguimiento.spec.ts` → `MissingAPIError: IndexedDB API missing` (Dexie se inicializa y jsdom no trae IndexedDB).

Los 8 `.spec.ts` existentes son stubs autogenerados por el CLI (`it('should create')`); no hay ninguna prueba de comportamiento en el proyecto.

---

## Estructura de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `src/test-setup.ts` | **Crear.** Inyecta `fake-indexeddb` en el entorno de pruebas | 1 |
| `angular.json` | **Modificar.** Registrar `setupFiles` en el builder de test | 1 |
| `src/app/features/auth/login/login.spec.ts` | **Modificar.** Agregar `provideRouter([])` | 1 |
| `src/app/core/db/offline-db.ts` | **Modificar.** Esquema v9 + `pendienteSubir` + `metaSyncOff` + `migrarTareasAV9` | 2 |
| `src/app/core/db/offline-db.spec.ts` | **Crear.** Prueba de la migración v8→v9 | 2 |
| `src/app/core/db/services/sync.service.ts` | **Modificar.** No borra la fila; devuelve conteos | 3 |
| `src/app/core/db/services/sync.service.spec.ts` | **Crear.** | 3 |
| `src/app/core/services/mis-tareas.service.ts` | **Modificar.** Cola `pendienteSubir` + `subirRespuestasPendientes` | 4 |
| `src/app/core/services/mis-tareas.service.spec.ts` | **Crear.** | 4 |
| `src/app/core/db/services/sincronizacion.service.ts` | **Crear.** Orquestador | 5 |
| `src/app/core/db/services/sincronizacion.service.spec.ts` | **Crear.** | 5 |
| `src/app/features/sincronizacion/sincronizacion.ts` | **Crear.** Componente | 6 |
| `src/app/features/sincronizacion/sincronizacion.html` | **Crear.** Plantilla | 6 |
| `src/app/app.routes.ts` | **Modificar.** Ruta `/sincronizacion` | 6 |
| `src/app/shared/components/navigation_drawer/navigation_drawer.component.html` | **Modificar.** Ítem "Sincronizar" | 6 |
| `src/app/core/services/reporte.service.ts` | **Modificar.** Quitar el `effect()` de auto-sync | 7 |
| `src/app/features/home/panel-tecnico/panel-tecnico.ts` / `.html` | **Modificar.** Quitar botones, enlazar a `/sincronizacion` | 7 |

---

## Tarea 1: Poner la suite de pruebas en verde

Sin esto no se puede hacer TDD: el ciclo "verificar que el test falla / verificar que pasa" no significa nada contra un baseline rojo.

**Archivos:**
- Crear: `frontend/src/test-setup.ts`
- Modificar: `frontend/angular.json` (bloque `test`, líneas 74-76)
- Modificar: `frontend/src/app/features/auth/login/login.spec.ts`
- Modificar: `frontend/package.json` (devDependencies)

**Interfaces:**
- Produce: entorno de pruebas con IndexedDB funcional. Todas las tareas siguientes dependen de esto.

- [ ] **Paso 1: Instalar `fake-indexeddb`**

```bash
npm install --save-dev fake-indexeddb
```

- [ ] **Paso 2: Crear el archivo de setup**

Crear `frontend/src/test-setup.ts`:

```ts
// jsdom no implementa IndexedDB, y Dexie lanza MissingAPIError apenas se instancia.
// fake-indexeddb/auto registra una implementación en memoria sobre globalThis,
// así que dbLocal funciona en las pruebas igual que en el navegador.
import 'fake-indexeddb/auto';
```

- [ ] **Paso 3: Registrar el setup en `angular.json`**

Reemplazar el bloque `test` (líneas 74-76) por:

```json
        "test": {
          "builder": "@angular/build:unit-test",
          "options": {
            "setupFiles": ["src/test-setup.ts"]
          }
        }
```

- [ ] **Paso 4: Arreglar `login.spec.ts`**

Reemplazar el contenido completo de `frontend/src/app/features/auth/login/login.spec.ts` por:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LoginComponent } from './login';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      // El componente usa routerLink en su plantilla; sin un router configurado
      // Angular no puede resolver ActivatedRoute y lanza NG0201.
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
```

- [ ] **Paso 5: Ejecutar la suite y verificar que está verde**

Ejecutar: `npm test`
Esperado: `Test Files  8 passed (8)`, `Tests  9 passed (9)`, **0 errores** y ningún `MissingAPIError`.

Si sigue apareciendo `MissingAPIError`, el `setupFiles` no se está aplicando: revisar que la ruta en `angular.json` sea relativa a `frontend/` (`src/test-setup.ts`, sin `./`).

- [ ] **Paso 6: Commit**

```bash
git add package.json package-lock.json angular.json src/test-setup.ts src/app/features/auth/login/login.spec.ts
git commit -m "test: poner la suite de pruebas en verde con fake-indexeddb"
```

---

## Tarea 2: Dexie v9 — campo `pendienteSubir` y tabla `metaSyncOff`

**Archivos:**
- Modificar: `frontend/src/app/core/db/offline-db.ts`
- Crear: `frontend/src/app/core/db/offline-db.spec.ts`

**Interfaces:**
- Consume: entorno de pruebas de la Tarea 1.
- Produce:
  - `TareaTecnicoOffline` con `pendienteSubir: 0 | 1`
  - `interface MetaSync { clave: ClaveMetaSync; valor: number }`
  - `type ClaveMetaSync = 'ultimaDescarga' | 'ultimoEnvio'`
  - `dbLocal.metaSyncOff: Table<MetaSync, string>`
  - `export function migrarTareasAV9(tx: Transaction): Promise<number>`

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `frontend/src/app/core/db/offline-db.spec.ts`:

```ts
import Dexie from 'dexie';
import { migrarTareasAV9, dbLocal } from './offline-db';

describe('offline-db', () => {
  describe('migrarTareasAV9', () => {
    const NOMBRE_BD_PRUEBA = 'BacheritoMigracionTest';

    afterEach(async () => {
      await Dexie.delete(NOMBRE_BD_PRUEBA);
    });

    it('pone pendienteSubir en 0 en las tareas que ya existían', async () => {
      // Simula una base v8: tareas guardadas sin el campo pendienteSubir.
      const bdVieja = new Dexie(NOMBRE_BD_PRUEBA);
      bdVieja.version(8).stores({ tareasTecnicoOff: '++id, idRequerimiento' });
      await bdVieja.open();
      await bdVieja.table('tareasTecnicoOff').bulkAdd([
        { idRequerimiento: 57, estado: 'I', nombreReporto: 'Ana', coordenadaX: -78.6, coordenadaY: -1.2, fechaIngreso: '2026-07-01' },
        { idRequerimiento: 58, estado: 'E', nombreReporto: 'Luis', coordenadaX: -78.7, coordenadaY: -1.3, fechaIngreso: '2026-07-02' }
      ]);
      bdVieja.close();

      // Reabre con el esquema v9 y la migración real.
      const bdNueva = new Dexie(NOMBRE_BD_PRUEBA);
      bdNueva.version(8).stores({ tareasTecnicoOff: '++id, idRequerimiento' });
      bdNueva.version(9)
        .stores({ tareasTecnicoOff: '++id, idRequerimiento, pendienteSubir', metaSyncOff: 'clave' })
        .upgrade(migrarTareasAV9);
      await bdNueva.open();

      const tareas = await bdNueva.table('tareasTecnicoOff').toArray();
      expect(tareas).toHaveLength(2);
      expect(tareas.every(t => t.pendienteSubir === 0)).toBe(true);
      bdNueva.close();
    });
  });

  describe('metaSyncOff', () => {
    afterEach(async () => {
      await dbLocal.metaSyncOff.clear();
    });

    it('guarda y recupera un timestamp por clave', async () => {
      await dbLocal.metaSyncOff.put({ clave: 'ultimaDescarga', valor: 1754150400000 });

      const fila = await dbLocal.metaSyncOff.get('ultimaDescarga');
      expect(fila?.valor).toBe(1754150400000);
    });

    it('devuelve undefined si la clave nunca se escribió', async () => {
      expect(await dbLocal.metaSyncOff.get('ultimoEnvio')).toBeUndefined();
    });
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npm test -- offline-db`
Esperado: FALLA. `migrarTareasAV9` no está exportado y `dbLocal.metaSyncOff` no existe.

- [ ] **Paso 3: Implementar los cambios en `offline-db.ts`**

En `frontend/src/app/core/db/offline-db.ts`:

**3a.** Cambiar el import de la primera línea para incluir `Transaction`:

```ts
import Dexie, { Table, Transaction } from 'dexie';
```

**3b.** Agregar `pendienteSubir` a `TareaTecnicoOffline` (después de `fechaIngreso`, dentro de la interfaz):

```ts
  fechaIngreso: string;      // OP_BACHERITO_REQ.FECHA_INGRESO
  // 1 = el técnico cambió el estado sin conexión y el cambio todavía no llegó al servidor.
  // Es la cola que lee "Subir respuestas" en /sincronizacion.
  pendienteSubir: 0 | 1;
```

**3c.** Agregar después de la interfaz `TareaTecnicoOffline`:

```ts
// Marcas de tiempo de la última descarga de recursos y del último envío exitoso.
// Viven en Dexie (y no en localStorage) a propósito: así "Borrar caché" las limpia
// junto con el resto de los datos y la pantalla vuelve a decir "Nunca".
export type ClaveMetaSync = 'ultimaDescarga' | 'ultimoEnvio';

export interface MetaSync {
  clave: ClaveMetaSync;
  valor: number;             // Date.now()
}

// Migración v8 -> v9: las tareas que ya estaban en el dispositivo no tienen el campo
// pendienteSubir. Se les pone 0 (nada pendiente) para que la cola arranque limpia.
// Se exporta aparte del bloque de versiones para poder probarla de forma aislada.
export function migrarTareasAV9(tx: Transaction): Promise<number> {
  return tx.table('tareasTecnicoOff').toCollection().modify(tarea => {
    tarea.pendienteSubir = 0;
  });
}
```

**3d.** Declarar la tabla nueva en la clase, junto a las otras:

```ts
export class OfflineAppDB extends Dexie {
  parroquiasOff!: Table<ParroquiaOffline, number>;
  reportesOff!: Table<ReporteOffline, number>;
  tareasTecnicoOff!: Table<TareaTecnicoOffline, number>;
  metaSyncOff!: Table<MetaSync, string>;
```

**3e.** Agregar el bloque de versión al final del `constructor`, justo después del bloque `this.version(8)`:

```ts
    // v9: tareasTecnicoOff gana pendienteSubir (cola de respuestas del técnico que aún no
    // llegan al servidor) y aparece metaSyncOff con las fechas de última descarga/último envío.
    this.version(9).stores({
      tareasTecnicoOff: '++id, idRequerimiento, pendienteSubir',
      metaSyncOff: 'clave'
    }).upgrade(migrarTareasAV9);
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npm test -- offline-db`
Esperado: PASA (3 pruebas).

TypeScript va a marcar error en los dos únicos lugares que construyen un `TareaTecnicoOffline` completo, porque ahora les falta `pendienteSubir`. Para dejar este commit compilando, agregar `pendienteSubir: 0` en ambos `.map()`:
- `mis-tareas.service.ts`, dentro del `map` de `descargarTareas()`
- `mis-tareas.ts` (componente), dentro del `map` de `cargarTareas()`

- [ ] **Paso 5: Verificar que compila y que toda la suite sigue verde**

Ejecutar: `npm run build`
Esperado: build exitoso, sin errores de TypeScript.

Ejecutar: `npm test`
Esperado: todo verde.

- [ ] **Paso 6: Commit**

```bash
git add src/app/core/db/offline-db.ts src/app/core/db/offline-db.spec.ts src/app/core/services/mis-tareas.service.ts src/app/features/mis-tareas/mis-tareas.ts
git commit -m "feat: agregar esquema Dexie v9 con pendienteSubir y metaSyncOff"
```

---

## Tarea 3: `SyncService` conserva el reporte sincronizado

Hoy borra la fila (`sync.service.ts:31`), lo que hace imposible el contador "Reportes sincronizados".

**Archivos:**
- Modificar: `frontend/src/app/core/db/services/sync.service.ts`
- Crear: `frontend/src/app/core/db/services/sync.service.spec.ts`

**Interfaces:**
- Consume: `dbLocal.reportesOff` de la Tarea 2.
- Produce: `SyncService.sincronizarReportesPendientes(): Promise<{ enviados: number; fallidos: number }>`

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `frontend/src/app/core/db/services/sync.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { SyncService } from './sync.service';
import { dbLocal, ReporteOffline } from '../offline-db';

function reporteDePrueba(sufijo: number): ReporteOffline {
  return {
    NOMBRES: `Vecino ${sufijo}`,
    CEDULA: '1804567890',
    TELEFONO: '0999999999',
    PARROQUIA: 1,
    COORDENADAX: '-78.62722',
    COORDENADAY: '-1.24908',
    X: null,
    Y: null,
    ESTADO: 'N',
    FECHA_INGRESO: 1754150400000,
    FOTOGRAFIA: 'data:image/png;base64,AAAA',
    NOMBRE_IMAGEN: `${sufijo}_test_bache_ant.png`,
    SINCRONIZADO: 0
  };
}

describe('SyncService', () => {
  let servicio: SyncService;
  let httpFalso: { post: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    await dbLocal.reportesOff.clear();
    httpFalso = { post: vi.fn(() => of({ success: true })) };

    TestBed.configureTestingModule({
      providers: [SyncService, { provide: HttpClient, useValue: httpFalso }]
    });
    servicio = TestBed.inject(SyncService);
  });

  it('no hace ninguna petición si no hay pendientes', async () => {
    const resultado = await servicio.sincronizarReportesPendientes();

    expect(httpFalso.post).not.toHaveBeenCalled();
    expect(resultado).toEqual({ enviados: 0, fallidos: 0 });
  });

  it('conserva la fila con SINCRONIZADO=1 y sin la foto en base64', async () => {
    await dbLocal.reportesOff.add(reporteDePrueba(1));

    const resultado = await servicio.sincronizarReportesPendientes();

    expect(resultado).toEqual({ enviados: 1, fallidos: 0 });
    const filas = await dbLocal.reportesOff.toArray();
    expect(filas).toHaveLength(1);           // no se borra
    expect(filas[0].SINCRONIZADO).toBe(1);
    expect(filas[0].FOTOGRAFIA).toBeNull();  // se libera el base64
  });

  it('deja en cola lo que falló y sube lo que sí pudo', async () => {
    await dbLocal.reportesOff.add(reporteDePrueba(1));
    await dbLocal.reportesOff.add(reporteDePrueba(2));
    httpFalso.post
      .mockImplementationOnce(() => of({ success: true }))
      .mockImplementationOnce(() => throwError(() => new Error('sin red')));

    const resultado = await servicio.sincronizarReportesPendientes();

    expect(resultado).toEqual({ enviados: 1, fallidos: 1 });
    expect(await dbLocal.reportesOff.where('SINCRONIZADO').equals(0).count()).toBe(1);
    expect(await dbLocal.reportesOff.where('SINCRONIZADO').equals(1).count()).toBe(1);
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npm test -- sync.service`
Esperado: FALLA. El método devuelve `undefined` y borra la fila en lugar de marcarla.

- [ ] **Paso 3: Implementar**

Reemplazar el método `sincronizarReportesPendientes` en `frontend/src/app/core/db/services/sync.service.ts` por:

```ts
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
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npm test -- sync.service`
Esperado: PASA (3 pruebas).

Ejecutar: `npm test`
Esperado: todo verde.

- [ ] **Paso 5: Commit**

```bash
git add src/app/core/db/services/sync.service.ts src/app/core/db/services/sync.service.spec.ts
git commit -m "feat: conservar el reporte sincronizado sin la foto en lugar de borrarlo"
```

---

## Tarea 4: Cola de respuestas del técnico (cierra B4)

**Archivos:**
- Modificar: `frontend/src/app/core/services/mis-tareas.service.ts`
- Crear: `frontend/src/app/core/services/mis-tareas.service.spec.ts`

**Interfaces:**
- Consume: `pendienteSubir` de la Tarea 2.
- Produce:
  - `MisTareasService.cambiarEstado(idRequerimiento: number, nuevoEstado: 'A' | 'E'): Promise<void>` — marca `pendienteSubir=1` si no hay conexión o si el PATCH falla
  - `MisTareasService.subirRespuestasPendientes(): Promise<{ enviados: number; fallidos: number }>`
  - `MisTareasService.contarRespuestasPendientes(): Promise<number>`

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `frontend/src/app/core/services/mis-tareas.service.spec.ts`:

```ts
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
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npm test -- mis-tareas.service`
Esperado: FALLA. `subirRespuestasPendientes` y `contarRespuestasPendientes` no existen, y `cambiarEstado` no marca `pendienteSubir`.

- [ ] **Paso 3: Implementar**

En `frontend/src/app/core/services/mis-tareas.service.ts`:

**3a.** En `descargarTareas()`, agregar `pendienteSubir: 0` al objeto del `.map()`:

```ts
    const tareasLocales: TareaTecnicoOffline[] = respuesta.tareas.map(t => ({
      idRequerimiento: t.idRequerimiento,
      estado: t.estadoCrudo,
      nombreReporto: t.nombres,
      coordenadaX: t.coordenadaX,
      coordenadaY: t.coordenadaY,
      fechaIngreso: t.fechaIngreso,
      pendienteSubir: 0
    }));
```

**3b.** Reemplazar el método `cambiarEstado` completo (y su comentario) por:

```ts
  // Cambia el estado del bache. Con conexión intenta subirlo de una vez; si no hay conexión o el
  // servidor falla, el cambio queda guardado localmente con pendienteSubir=1 y se envía después
  // desde /sincronizacion. Antes de esto el cambio offline se perdía para siempre (bug B4).
  async cambiarEstado(idRequerimiento: number, nuevoEstado: 'A' | 'E'): Promise<void> {
    let pendienteSubir: 0 | 1 = 1;

    if (this.connectionService.isOnline()) {
      try {
        await firstValueFrom(this.http.patch(`${this.API_URL}/${idRequerimiento}/atender`, { estado: nuevoEstado }));
        pendienteSubir = 0;
      } catch (error) {
        console.error('No se pudo actualizar el estado en el servidor, queda pendiente de subir:', error);
      }
    }

    await dbLocal.tareasTecnicoOff
      .where('idRequerimiento')
      .equals(idRequerimiento)
      .modify({ estado: nuevoEstado, pendienteSubir });
  }

  // Cuántos cambios de estado hechos en este dispositivo todavía no llegaron al servidor.
  async contarRespuestasPendientes(): Promise<number> {
    return dbLocal.tareasTecnicoOff.where('pendienteSubir').equals(1).count();
  }

  // Envía la cola de respuestas. Lo que falla se queda con pendienteSubir=1 para el próximo intento.
  async subirRespuestasPendientes(): Promise<{ enviados: number; fallidos: number }> {
    const pendientes = await dbLocal.tareasTecnicoOff.where('pendienteSubir').equals(1).toArray();

    let enviados = 0;
    let fallidos = 0;

    for (const tarea of pendientes) {
      try {
        await firstValueFrom(
          this.http.patch(`${this.API_URL}/${tarea.idRequerimiento}/atender`, { estado: tarea.estado })
        );
        await dbLocal.tareasTecnicoOff.update(tarea.id!, { pendienteSubir: 0 });
        enviados++;
      } catch (error) {
        console.error(`No se pudo subir la respuesta del bache ${tarea.idRequerimiento}:`, error);
        fallidos++;
      }
    }

    return { enviados, fallidos };
  }
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npm test -- mis-tareas.service`
Esperado: PASA (7 pruebas).

Ejecutar: `npm test`
Esperado: todo verde.

- [ ] **Paso 5: Commit**

```bash
git add src/app/core/services/mis-tareas.service.ts src/app/core/services/mis-tareas.service.spec.ts
git commit -m "fix: enviar al servidor los cambios de estado hechos sin conexion (B4)"
```

---

## Tarea 5: `SincronizacionService` (orquestador)

**Archivos:**
- Crear: `frontend/src/app/core/db/services/sincronizacion.service.ts`
- Crear: `frontend/src/app/core/db/services/sincronizacion.service.spec.ts`

**Interfaces:**
- Consume: `SyncService.sincronizarReportesPendientes()`, `MisTareasService.{descargarTareas, subirRespuestasPendientes, contarRespuestasPendientes}`, `ParroquiaService.obtenerParroquias()`, `dbLocal.metaSyncOff`.
- Produce:
  - Signals de solo lectura: `reportesPendientes`, `reportesSincronizados`, `respuestasPendientes` (`Signal<number>`); `ultimaDescarga`, `ultimoEnvio` (`Signal<number | null>`); `ocupado` (`Signal<boolean>`)
  - `refrescarContadores(): Promise<void>`
  - `descargarRecursos(): Promise<{ ok: boolean; mensaje: string }>`
  - `subirRespuestas(): Promise<{ ok: boolean; mensaje: string }>`
  - `borrarCache(): Promise<void>`

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `frontend/src/app/core/db/services/sincronizacion.service.spec.ts`:

```ts
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
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npm test -- sincronizacion.service`
Esperado: FALLA. El archivo `sincronizacion.service.ts` no existe.

- [ ] **Paso 3: Implementar**

Crear `frontend/src/app/core/db/services/sincronizacion.service.ts`:

```ts
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
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npm test -- sincronizacion.service`
Esperado: PASA (8 pruebas).

Ejecutar: `npm test`
Esperado: todo verde.

- [ ] **Paso 5: Commit**

```bash
git add src/app/core/db/services/sincronizacion.service.ts src/app/core/db/services/sincronizacion.service.spec.ts
git commit -m "feat: agregar SincronizacionService como orquestador de la sincronizacion manual"
```

---

## Tarea 6: Pantalla `/sincronizacion`, ruta y entrada en el menú

**Archivos:**
- Crear: `frontend/src/app/features/sincronizacion/sincronizacion.ts`
- Crear: `frontend/src/app/features/sincronizacion/sincronizacion.html`
- Modificar: `frontend/src/app/app.routes.ts`
- Modificar: `frontend/src/app/shared/components/navigation_drawer/navigation_drawer.component.html`

**Interfaces:**
- Consume: todos los signals y métodos de `SincronizacionService` (Tarea 5), `ConnectionService.isOnline`.

- [ ] **Paso 1: Crear el componente**

Crear `frontend/src/app/features/sincronizacion/sincronizacion.ts`:

```ts
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CardComponent } from '../../shared/components/card/card.component';
import { NavbarTopComponent } from '../../shared/components/toolbar/toolbar.component';
import { NavigationDrawerComponent } from '../../shared/components/navigation_drawer/navigation_drawer.component';
import { SincronizacionService } from '../../core/db/services/sincronizacion.service';
import { ConnectionService } from '../../core/db/services/connection.service';

@Component({
  selector: 'app-sincronizacion',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    CardComponent,
    NavbarTopComponent,
    NavigationDrawerComponent
  ],
  templateUrl: './sincronizacion.html'
})
export class SincronizacionComponent implements OnInit {
  private sincronizacionService = inject(SincronizacionService);
  private connectionService = inject(ConnectionService);

  menuAbierto = signal(false);
  enLinea = this.connectionService.isOnline;

  reportesPendientes = this.sincronizacionService.reportesPendientes;
  reportesSincronizados = this.sincronizacionService.reportesSincronizados;
  respuestasPendientes = this.sincronizacionService.respuestasPendientes;
  ultimaDescarga = this.sincronizacionService.ultimaDescarga;
  ultimoEnvio = this.sincronizacionService.ultimoEnvio;
  ocupado = this.sincronizacionService.ocupado;

  // Resultado de la última operación, que se muestra dentro de la pantalla (no con alert()).
  mensaje = signal<{ texto: string; ok: boolean } | null>(null);
  confirmandoBorrado = signal(false);

  // La descarga reemplaza la copia local completa: se bloquea mientras haya respuestas sin enviar
  // para no borrarlas en silencio.
  puedeDescargar = computed(() =>
    this.enLinea() && !this.ocupado() && this.respuestasPendientes() === 0
  );

  puedeSubir = computed(() => this.enLinea() && !this.ocupado());

  totalPendientes = computed(() => this.respuestasPendientes() + this.reportesPendientes());

  motivoBloqueoDescarga = computed(() => {
    if (!this.enLinea()) return 'Necesitas conexión a internet';
    const pendientes = this.respuestasPendientes();
    if (pendientes > 0) {
      return `Tienes ${pendientes} ${pendientes === 1 ? 'respuesta' : 'respuestas'} sin enviar. Súbelas antes de descargar.`;
    }
    return null;
  });

  async ngOnInit() {
    await this.sincronizacionService.refrescarContadores();
  }

  async descargar() {
    this.mensaje.set(null);
    const resultado = await this.sincronizacionService.descargarRecursos();
    this.mensaje.set({ texto: resultado.mensaje, ok: resultado.ok });
  }

  async subir() {
    this.mensaje.set(null);
    const resultado = await this.sincronizacionService.subirRespuestas();
    this.mensaje.set({ texto: resultado.mensaje, ok: resultado.ok });
  }

  abrirConfirmacionBorrado() {
    this.mensaje.set(null);
    this.confirmandoBorrado.set(true);
  }

  cancelarBorrado() {
    this.confirmandoBorrado.set(false);
  }

  async confirmarBorrado() {
    await this.sincronizacionService.borrarCache();
    this.confirmandoBorrado.set(false);
    this.mensaje.set({ texto: 'Se eliminaron los datos del dispositivo.', ok: true });
  }
}
```

- [ ] **Paso 2: Crear la plantilla**

Crear `frontend/src/app/features/sincronizacion/sincronizacion.html`:

La estructura externa (contenedor de pantalla completa + toolbar + drawer) copia exactamente el patrón de `mis-tareas.html`.

```html
<div class="min-h-screen w-full flex flex-col bg-bg select-none">

  <app-toolbar [titulo]="'Sincronización'" [mostrarBotonMenu]="true" (menuClick)="menuAbierto.set(true)"></app-toolbar>
  <app-navigation-drawer [abierto]="menuAbierto()" (cerrado)="menuAbierto.set(false)"></app-navigation-drawer>

  <div class="flex-1 overflow-y-auto px-4 py-6 box-border">
    <div class="w-full max-w-2xl mx-auto">

  <!-- Encabezado -->
  <div class="mb-5">
    <h2 class="text-xl font-extrabold text-text">Sincronización</h2>
    <p class="mt-0.5 text-sm text-text-muted">
      Administra la descarga de tus tareas y el envío de respuestas y nuevos reportes.
    </p>
  </div>

  <!-- Aviso de sin conexión -->
  @if (!enLinea()) {
    <div class="mb-4 flex items-center gap-2.5 rounded-2xl bg-danger-bg px-4 py-3">
      <mat-icon class="!text-xl text-danger">cloud_off</mat-icon>
      <span class="text-sm font-semibold text-danger">Sin conexión a internet</span>
    </div>
  }

  <!-- Resultado de la última operación -->
  @if (mensaje(); as m) {
    <div
      class="mb-4 flex items-start gap-2.5 rounded-2xl px-4 py-3"
      [class.bg-success-bg]="m.ok"
      [class.bg-danger-bg]="!m.ok">
      <mat-icon class="!text-xl" [class.text-success]="m.ok" [class.text-danger]="!m.ok">
        {{ m.ok ? 'check_circle' : 'error' }}
      </mat-icon>
      <span class="text-sm font-medium" [class.text-success]="m.ok" [class.text-danger]="!m.ok">
        {{ m.texto }}
      </span>
    </div>
  }

  <!-- Contadores -->
  <div class="grid grid-cols-2 gap-4">
    <card>
      <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400">
        <mat-icon class="!text-xl">cloud_off</mat-icon>
      </div>
      <p class="mt-3 text-2xl font-extrabold text-text">{{ reportesPendientes() }}</p>
      <p class="text-xs text-text-muted">Reportados offline</p>
    </card>

    <card>
      <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-success-bg text-success">
        <mat-icon class="!text-xl">cloud_done</mat-icon>
      </div>
      <p class="mt-3 text-2xl font-extrabold text-text">{{ reportesSincronizados() }}</p>
      <p class="text-xs text-text-muted">Reportes sincronizados</p>
    </card>
  </div>

  <!-- Descargar recursos -->
  <card class="mt-4 block">
    <div class="flex items-start gap-3">
      <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400" aria-hidden="true">
        <mat-icon class="!text-2xl">download</mat-icon>
      </div>
      <div class="min-w-0 flex-1">
        <h3 class="text-base font-bold text-text">Descargar Recursos del sistema</h3>
        <p class="mt-0.5 text-xs text-text-muted">
          Última descarga:
          {{ ultimaDescarga() ? (ultimaDescarga() | date:'dd/MM/yyyy HH:mm') : 'Nunca' }}
        </p>
      </div>
    </div>

    <p class="mt-3 text-sm text-text-muted">
      Trae los recursos del sistema para trabajar sin conexión.
    </p>

    @if (motivoBloqueoDescarga(); as motivo) {
      <p class="mt-2 text-xs font-medium text-danger">{{ motivo }}</p>
    }

    <button
      type="button"
      (click)="descargar()"
      [disabled]="!puedeDescargar()"
      class="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary transition-all active:scale-[0.98] disabled:opacity-50">
      <mat-icon class="!text-lg !h-5 !w-5" [class.animate-spin]="ocupado()">
        {{ ocupado() ? 'sync' : 'download' }}
      </mat-icon>
      Descargar
    </button>
  </card>

  <!-- Subir respuestas -->
  <card class="mt-4 block">
    <div class="flex items-start gap-3">
      <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950/20 dark:text-teal-400" aria-hidden="true">
        <mat-icon class="!text-2xl">upload_file</mat-icon>
      </div>
      <div class="min-w-0 flex-1">
        <h3 class="text-base font-bold text-text">Subir respuesta</h3>
        <p class="mt-0.5 text-xs text-text-muted">
          Último envío:
          {{ ultimoEnvio() ? (ultimoEnvio() | date:'dd/MM/yyyy HH:mm') : 'Nunca' }}
        </p>
      </div>
    </div>

    <p class="mt-3 text-sm text-text-muted">
      Envía al servidor las respuestas guardadas localmente en el dispositivo.
    </p>

    <div
      class="mt-3 rounded-xl px-4 py-3 text-sm font-semibold"
      [class.bg-success-bg]="totalPendientes() === 0"
      [class.text-success]="totalPendientes() === 0"
      [class.bg-danger-bg]="totalPendientes() > 0"
      [class.text-danger]="totalPendientes() > 0">
      @if (totalPendientes() === 0) {
        Sin respuestas pendientes
      } @else {
        {{ totalPendientes() }} {{ totalPendientes() === 1 ? 'elemento pendiente' : 'elementos pendientes' }} de envío
      }
    </div>

    @if (!enLinea()) {
      <p class="mt-2 text-xs font-medium text-danger">Necesitas conexión a internet</p>
    }

    <button
      type="button"
      (click)="subir()"
      [disabled]="!puedeSubir()"
      class="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary transition-all active:scale-[0.98] disabled:opacity-50">
      <mat-icon class="!text-lg !h-5 !w-5" [class.animate-spin]="ocupado()">
        {{ ocupado() ? 'sync' : 'upload' }}
      </mat-icon>
      Subir respuestas
    </button>
  </card>

  <!-- Borrar caché -->
  <card class="mt-4 block" [conBorde]="true">
    <div class="flex items-start gap-3">
      <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-danger-bg text-danger" aria-hidden="true">
        <mat-icon class="!text-2xl">warning</mat-icon>
      </div>
      <div class="min-w-0 flex-1">
        <h3 class="text-base font-bold text-text">Borrar caché</h3>
      </div>
    </div>

    <p class="mt-3 text-sm text-text-muted">
      Elimina los recursos del sistema descargados y todas las respuestas del dispositivo,
      incluyendo las pendientes de envío.
    </p>

    <button
      type="button"
      (click)="abrirConfirmacionBorrado()"
      [disabled]="ocupado()"
      class="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-danger px-4 py-3 text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-50">
      <mat-icon class="!text-lg !h-5 !w-5">delete</mat-icon>
      Borrar caché
    </button>
  </card>

    </div>
  </div>
</div>

<!-- Confirmación de borrado -->
@if (confirmandoBorrado()) {
  <div class="fixed inset-0 z-[500] flex items-center justify-center px-6">
    <div class="absolute inset-0 bg-black/50" (click)="cancelarBorrado()" aria-hidden="true"></div>

    <div class="relative z-10 w-full max-w-sm rounded-3xl bg-surface p-6 shadow-2xl" role="alertdialog" aria-modal="true">
      <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger-bg text-danger">
        <mat-icon class="!text-3xl !h-8 !w-8">warning</mat-icon>
      </div>

      @if (totalPendientes() > 0) {
        <h3 class="text-center text-lg font-bold text-text">Vas a perder trabajo sin enviar</h3>
        <p class="mt-2 text-center text-sm text-text-muted">
          Tienes {{ respuestasPendientes() }}
          {{ respuestasPendientes() === 1 ? 'respuesta' : 'respuestas' }} y
          {{ reportesPendientes() }}
          {{ reportesPendientes() === 1 ? 'reporte' : 'reportes' }} sin enviar.
          Si borras la caché se perderán para siempre.
        </p>
      } @else {
        <h3 class="text-center text-lg font-bold text-text">¿Estás seguro de eliminar la caché del dispositivo?</h3>
      }

      <div class="mt-6 flex gap-3">
        <button
          type="button"
          (click)="cancelarBorrado()"
          class="flex-1 rounded-xl bg-surface-alt px-4 py-3 text-sm font-semibold text-text transition-all active:scale-[0.98]">
          Cancelar
        </button>
        <button
          type="button"
          (click)="confirmarBorrado()"
          class="flex-1 rounded-xl bg-danger px-4 py-3 text-sm font-semibold text-white transition-all active:scale-[0.98]">
          {{ totalPendientes() > 0 ? 'Borrar de todos modos' : 'Borrar caché' }}
        </button>
      </div>
    </div>
  </div>
}
```

- [ ] **Paso 3: Registrar la ruta**

En `frontend/src/app/app.routes.ts`, agregar después del bloque de `mis-tareas` (línea 78) y **antes** del comodín `**`:

```ts
  {
    path: 'sincronizacion',
    canActivate: [authGuard, moduloGuard('MIS_TAREAS')], // 🛡️ Protegido
    loadComponent: () => import('./features/sincronizacion/sincronizacion').then(m => m.SincronizacionComponent)
  },
```

- [ ] **Paso 4: Agregar el ítem al menú**

En `frontend/src/app/shared/components/navigation_drawer/navigation_drawer.component.html`, dentro del bloque `@if (tieneAccesoMisTareas) { ... }`, agregar un segundo enlace justo después del de "Mis Tareas" (después de la línea 73, antes del `}`):

```html
          <a
            routerLink="/sincronizacion"
            routerLinkActive="bg-primary-soft !text-primary font-bold"
            (click)="cerrar()"
            class="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-text-muted transition-all duration-150 hover:bg-surface-alt active:scale-[0.98]">
            <mat-icon class="!text-xl !h-5 !w-5">settings</mat-icon>
            Sincronizar
          </a>
```

- [ ] **Paso 5: Verificar que compila y que la suite sigue verde**

Ejecutar: `npm run build`
Esperado: build exitoso.

Ejecutar: `npm test`
Esperado: todo verde.

Referencia verificada del toolbar (`toolbar.component.ts`): selector `app-toolbar`, clase `NavbarTopComponent`, entradas `titulo` / `mostrarBotonMenu` / `mostrarBotonAtras`, salida `menuClick`. No es `app-navbar-top` ni `menuClic`.

- [ ] **Paso 6: Commit**

```bash
git add src/app/features/sincronizacion src/app/app.routes.ts src/app/shared/components/navigation_drawer/navigation_drawer.component.html
git commit -m "feat: agregar pantalla de sincronizacion con descarga, subida y borrado de cache"
```

---

## Tarea 7: Quitar el auto-sync y limpiar el Home del técnico

**Archivos:**
- Modificar: `frontend/src/app/core/services/reporte.service.ts`
- Modificar: `frontend/src/app/features/home/panel-tecnico/panel-tecnico.ts`
- Modificar: `frontend/src/app/features/home/panel-tecnico/panel-tecnico.html`

**Interfaces:**
- Consume: la ruta `/sincronizacion` de la Tarea 6.

- [ ] **Paso 1: Quitar el `effect()` de auto-sync**

En `frontend/src/app/core/services/reporte.service.ts`:

- Eliminar el bloque `constructor() { ... }` completo (líneas 21-28).
- Eliminar la línea `private syncService = inject(SyncService);`.
- Eliminar los imports que quedan sin uso: `effect` de `@angular/core` y `SyncService`.
- **Conservar** `ConnectionService`: `enviarReporte()` lo sigue usando en la línea `if (this.connectionService.isOnline())`.

El import de la primera línea queda así:

```ts
import { inject, Injectable } from '@angular/core';
```

- [ ] **Paso 2: Limpiar el componente del panel del técnico**

En `frontend/src/app/features/home/panel-tecnico/panel-tecnico.ts`:

- Eliminar los métodos `descargarTareas()` y `subirReporte()`.
- Eliminar los signals `descargandoTareas`, `subiendoReporte` y `mostrarBotonDescarga`.
- Eliminar las dos líneas que asignan `this.mostrarBotonDescarga.set(...)` dentro de `actualizarProgresoTareas()`.
- Eliminar `private syncService = inject(SyncService);` y el import de `SyncService`.
- Agregar el método de navegación:

```ts
  irASincronizacion() {
    this.router.navigate(['/sincronizacion']);
  }
```

- **Conservar** `pendientesSincronizar`, `reporteService` y `misTareasService`: la barra de estado los sigue usando.

- [ ] **Paso 3: Limpiar la plantilla del panel del técnico**

En `frontend/src/app/features/home/panel-tecnico/panel-tecnico.html`:

**3a.** Reemplazar el bloque del encabezado (líneas 1-17) por:

```html
<!-- Encabezado del panel -->
<div class="flex items-start justify-between gap-3">
  <div class="min-w-0 mb-5">
    <h2 class="text-xl font-extrabold text-text">Panel de Control Tecnico</h2>
    <p class="text-sm text-text-muted mt-0.5 truncate">Hola, {{ nombreTecnico }}</p>
  </div>
</div>
```

**3b.** Reemplazar el botón "Subir ahora" de la barra de sincronización (líneas 77-85) por un enlace a la pantalla nueva:

```html
  <button
    type="button"
    (click)="irASincronizacion()"
    class="shrink-0 text-xs font-bold underline-offset-2 hover:underline"
    [class.text-success]="pendientesSincronizar() === 0"
    [class.text-danger]="pendientesSincronizar() > 0">
    Sincronizar
  </button>
```

Nótese que el `@if (pendientesSincronizar() > 0)` que envolvía al botón se elimina: el enlace se muestra siempre, porque descargar recursos también se hace desde ahí.

- [ ] **Paso 4: Verificar que no quedó ninguna referencia al auto-sync**

Ejecutar: `npm run build`
Esperado: build exitoso, sin errores de TypeScript ni de plantilla.

Buscar referencias huérfanas: no debe quedar ningún `effect(` relacionado con sincronización, ni ningún uso de `descargarTareas()` fuera de `mis-tareas.service.ts` y `sincronizacion.service.ts`.

- [ ] **Paso 5: Ejecutar la suite completa**

Ejecutar: `npm test`
Esperado: todo verde.

- [ ] **Paso 6: Commit**

```bash
git add src/app/core/services/reporte.service.ts src/app/features/home/panel-tecnico
git commit -m "refactor: mover la sincronizacion del home a la pantalla dedicada y quitar el auto-sync"
```

---

## Tarea 8: Verificación manual en el navegador y reporte de entrega

**Archivos:**
- Crear: `contexto_claude/reportes/2026-08-02-FE-02-sincronizacion.md`

- [ ] **Paso 1: Levantar la app y recorrer el flujo online**

Levantar el backend (`npm run start` desde `backend/`) y el frontend (`npm start` desde `frontend/`). Iniciar sesión con un usuario que tenga el módulo `MIS_TAREAS` (`titecnico27@ambato.gob.ec`, ID 16).

Verificar:
- El menú muestra "Sincronizar" con el icono de tuerca.
- `/sincronizacion` carga y muestra "Última descarga: Nunca".
- "Descargar" baja las tareas y las parroquias, y la fecha cambia.

- [ ] **Paso 2: Verificar el flujo offline (esto es lo que cierra B4)**

Simular la falta de conexión **sin recargar la página**:

```js
Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
window.dispatchEvent(new Event('offline'));
```

Navegar **solo con clics dentro de la SPA** (una recarga completa reinicia los signals de Angular y restaura el valor real de `navigator.onLine`).

Verificar:
- En el mapa de seguimiento, cambiar el estado de un bache a "Atendido".
- Volver a `/sincronizacion`: el contador muestra 1 elemento pendiente.
- "Descargar" está bloqueado con el mensaje sobre las respuestas sin enviar.
- Restaurar la conexión (`value: true` + evento `online`), presionar "Subir respuestas" y confirmar que el contador vuelve a 0.
- Confirmar en Oracle (consulta **de solo lectura**) que el estado del bache cambió de verdad.

- [ ] **Paso 3: Verificar el borrado de caché**

- Con pendientes: el diálogo muestra los números reales y pide confirmación adicional.
- Tras borrar: los cuatro contadores en 0, ambas fechas en "Nunca", y **la sesión sigue abierta**.

- [ ] **Paso 4: Escribir el reporte de entrega**

Crear `contexto_claude/reportes/2026-08-02-FE-02-sincronizacion.md` con:
- Archivos creados y modificados.
- Contrato implementado (firmas públicas de `SincronizacionService`).
- Resultado de `npm test` (pegar el resumen real, no describirlo).
- Resultado de la verificación manual, paso por paso.
- Qué quedó fuera y por qué (BE-07 idempotencia, FE-07 sesión inválida, B7).

- [ ] **Paso 5: Commit**

```bash
git add contexto_claude/reportes/2026-08-02-FE-02-sincronizacion.md
git commit -m "docs: agregar reporte de entrega de FE-02"
```

---

## Criterios de aceptación (checklist final)

- [ ] Existe `/sincronizacion`, accesible desde "Sincronizar" (icono tuerca), solo con el módulo `MIS_TAREAS`
- [ ] Los cuatro contadores reflejan el estado real de IndexedDB y se refrescan tras cada operación
- [ ] "Descargar" trae tareas + parroquias, escribe `ultimaDescarga` y marca `ESTADO='D'` en el servidor
- [ ] "Descargar" está bloqueado mientras haya respuestas sin enviar, con el número en el mensaje
- [ ] "Subir respuestas" envía ambas colas; lo que falla permanece en cola y el mensaje reporta el parcial
- [ ] Un cambio de estado hecho sin conexión llega al servidor tras "Subir respuestas" (**B4 cerrado**)
- [ ] "Borrar caché" advierte con números reales, exige doble confirmación si hay pendientes y no cierra la sesión
- [ ] El Home del técnico ya no tiene "Descargar Tareas" ni "Subir reporte"; enlaza a `/sincronizacion`
- [ ] No queda ningún `effect()` de sincronización automática
- [ ] `npm test` pasa en verde
- [ ] `npm run build` compila sin errores
