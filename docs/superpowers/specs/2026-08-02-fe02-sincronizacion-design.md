# FE-02 — Pantalla de Sincronización (rol Técnico)

**Fecha:** 2026-08-02
**Alcance:** Frontend (Angular 22 + Dexie). No requiere endpoints nuevos.
**Absorbe:** FE-03 (eliminar "Descargar Tareas" del Home) y el bug **B4** (cambio de estado offline que nunca vuelve al servidor).

---

## 1. Problema

Hoy el técnico tiene la sincronización repartida en el Home (`panel-tecnico`) y ejecutándose sola por un `effect()`. Además, si cambia el estado de un bache sin conexión, **ese cambio nunca llega al servidor**: `tareasTecnicoOff` no tiene forma de marcar "pendiente de subir" (`mis-tareas.service.ts`, método `cambiarEstado`). Es pérdida real de datos en producción.

Este ticket concentra toda la sincronización en una pantalla dedicada, bajo control explícito del técnico, y añade la cola de pendientes que faltaba.

---

## 2. Decisiones tomadas

| # | Decisión | Motivo |
|---|---|---|
| D1 | "Subir respuestas" sube **ambas** colas: reportes offline y cambios de estado de tareas | Un solo botón, un solo contador, y cierra B4 |
| D2 | Al sincronizar un reporte **ya no se borra** la fila: `SINCRONIZADO=1` y `FOTOGRAFIA=null` | Permite el contador "sincronizados" sin llenar IndexedDB con base64 |
| D3 | **Sincronización solo manual**: se elimina el `effect()` automático | El técnico controla cuándo gasta datos móviles |
| D4 | "Borrar caché" advierte con el **número real** de pendientes y exige doble confirmación | Con D3, borrar sin avisar destruye trabajo que nunca llegó al servidor |
| D5 | **"Descargar" se bloquea** mientras existan respuestas sin enviar | La descarga hace `clear()` de `tareasTecnicoOff`; sin el bloqueo se pierden en silencio |
| D6 | Arquitectura: **servicio orquestador**, no outbox genérico | El flujo de reportes offline es el único verificado contra Oracle de producción; se envuelve, no se reescribe |
| D7 | Se incluye la **primera suite `vitest`** del proyecto sobre el servicio nuevo | Empieza a cerrar B8 |

### Riesgo aceptado (fuera de alcance)

`POST /api/requerimientos` **no es idempotente**. Si la red se corta después de que Oracle insertó pero antes de que llegue la respuesta HTTP, el reintento duplica el bache. Esto ya ocurre hoy con el auto-sync; no es una regresión introducida por este ticket. Se levanta como **BE-07** (clave de idempotencia en el backend).

---

## 3. Arquitectura

### 3.1 Archivos nuevos

| Archivo | Responsabilidad |
|---|---|
| `core/db/services/sincronizacion.service.ts` | Orquestador. Fuente única de los contadores (`signal`s). Métodos: `descargarRecursos()`, `subirRespuestas()`, `borrarCache()`, `refrescarContadores()`. Delega HTTP en `MisTareasService`, `ParroquiaService` y `SyncService`; no llama a `HttpClient` directo. |
| `features/sincronizacion/sincronizacion.ts` | Componente standalone. Solo pinta signals y dispara métodos. Cero lógica de datos. |
| `features/sincronizacion/sincronizacion.html` | Plantilla (ver §5). |
| `core/db/services/sincronizacion.service.spec.ts` | Suite `vitest` (ver §7). |

### 3.2 Archivos modificados

| Archivo | Cambio |
|---|---|
| `app.routes.ts` | Ruta `/sincronizacion` con `authGuard` + `moduloGuard('MIS_TAREAS')` |
| `shared/components/navigation_drawer/navigation_drawer.component.ts/.html` | Ítem "Sincronizar", icono `settings`, visible si `tieneAccesoMisTareas` |
| `core/db/offline-db.ts` | Esquema **v9** (ver §4) |
| `core/db/services/sync.service.ts` | Deja de borrar la fila: `SINCRONIZADO=1` + `FOTOGRAFIA=null`. Devuelve `{ enviados, fallidos }` |
| `core/services/mis-tareas.service.ts` | `cambiarEstado` marca `pendienteSubir=1` cuando está offline o el PATCH falla; nuevo `subirRespuestasPendientes()` que devuelve `{ enviados, fallidos }`; `descargarTareas()` escribe `pendienteSubir=0` |
| `core/services/reporte.service.ts` | **Se elimina el `effect()` de auto-sync** (D3); al quedar vacío se elimina también el `constructor` y los `inject` de `SyncService`/`ConnectionService` que dejen de usarse |
| `features/home/panel-tecnico/panel-tecnico.ts/.html` | Se quitan `descargarTareas()`, `subirReporte()`, `mostrarBotonDescarga`, `descargandoTareas`, `subiendoReporte` y sus botones. Se reemplazan por un enlace a `/sincronizacion` |

> `POST /api/mis-tareas/marcar-descargado` **se sigue llamando** desde la descarga. Ya no controla ningún botón, pero marcar `ESTADO='D'` en `OP_BACHERITO_GRUPO_TAREAS` es información que el administrador necesita para el dashboard FE-05.

---

## 4. Modelo de datos — Dexie v9

```ts
this.version(9).stores({
  tareasTecnicoOff: '++id, idRequerimiento, pendienteSubir',
  metaSyncOff: 'clave'
}).upgrade(tx =>
  tx.table('tareasTecnicoOff').toCollection().modify(t => { t.pendienteSubir = 0; })
);
```

**Interfaces:**

```ts
export interface TareaTecnicoOffline {
  id?: number;
  idRequerimiento: number;
  estado: string;            // I / E / R / A
  nombreReporto: string;
  coordenadaX: number;
  coordenadaY: number;
  fechaIngreso: string;
  pendienteSubir: 0 | 1;     // NUEVO — cierra B4
}

export interface MetaSync {
  clave: 'ultimaDescarga' | 'ultimoEnvio';
  valor: number;             // timestamp (Date.now())
}
```

`reportesOff` no cambia de índice (`SINCRONIZADO` ya estaba indexado); solo aparecen filas con valor `1`.

**Origen de cada contador:**

| Contador | Consulta |
|---|---|
| Reportados offline | `reportesOff.where('SINCRONIZADO').equals(0).count()` |
| Reportes sincronizados | `reportesOff.where('SINCRONIZADO').equals(1).count()` |
| Respuestas pendientes | `tareasTecnicoOff.where('pendienteSubir').equals(1).count()` |
| Última descarga / Último envío | `metaSyncOff.get('ultimaDescarga' \| 'ultimoEnvio')` |

---

## 5. Pantalla

**Título:** Sincronización
**Subtítulo:** *Administra la descarga de tus tareas y el envío de respuestas y nuevos reportes.*

**Bloque 1 — dos tarjetas contador:** "Reportados offline" y "Reportes sincronizados".

**Bloque 2 — Descargar Recursos del sistema**
- Icono de descarga a la izquierda (decorativo, `aria-hidden`).
- Subtítulo: `Última descarga: Nunca` o la fecha formateada.
- Descripción: *Trae los recursos del sistema para trabajar sin conexión.*
- Botón `Descargar` con icono.

**Bloque 3 — Subir respuesta**
- Icono de subida a la izquierda (decorativo).
- Subtítulo: `Último envío: Nunca` o la fecha formateada.
- Descripción: *Envía al servidor las respuestas guardadas localmente en el dispositivo.*
- Cuadro de estado: `Sin respuestas pendientes` o `N respuestas pendientes`.
- Botón `Subir respuestas` con icono.

**Bloque 4 — Borrar caché**
- Icono de advertencia.
- Descripción: *Elimina los recursos del sistema descargados y todas las respuestas del dispositivo, incluyendo las pendientes de envío.*
- Botón `Borrar caché` con icono de basura.

### Estados de los botones

| Condición | Descargar | Subir | Borrar caché |
|---|---|---|---|
| Sin conexión | Deshabilitado — *"Necesitas conexión a internet"* | Deshabilitado — mismo texto | Habilitado |
| Hay respuestas pendientes (D5) | Deshabilitado — *"Tienes N respuestas sin enviar. Súbelas antes de descargar."* | Habilitado | Habilitado |
| Operación en curso | Spinner, todos deshabilitados | Spinner | Deshabilitado |

Los resultados se muestran **dentro de la pantalla**, en el cuadro de estado. No se usa `alert()` (se elimina el que hay hoy en `panel-tecnico.ts`).

---

## 6. Flujos

### 6.1 Descargar recursos

1. Precondición: hay conexión **y** `respuestasPendientes() === 0` (D5).
2. `GET /api/mis-tareas` → `tareasTecnicoOff.clear()` + `bulkAdd` con `pendienteSubir: 0`.
3. `ParroquiaService.obtenerParroquias()` → refresca `parroquiasOff`.
4. `POST /api/mis-tareas/marcar-descargado` (si falla, se registra en consola y **no** aborta la descarga: los datos ya están en el dispositivo).
5. `metaSyncOff.put({ clave: 'ultimaDescarga', valor: Date.now() })`.
6. `refrescarContadores()`.

Si (2) o (3) fallan, no se escribe `ultimaDescarga` y el cuadro de estado muestra *"No se pudieron descargar los recursos. Verifica tu conexión."*

### 6.2 Subir respuestas

Orden: primero las respuestas, luego los reportes.

1. `tareasTecnicoOff.where('pendienteSubir').equals(1)` → por cada una, `PATCH /api/mis-tareas/:id/atender`. Éxito → `pendienteSubir=0`. Fallo → se queda en `1`.
2. `reportesOff.where('SINCRONIZADO').equals(0)` → por cada uno, `POST /api/requerimientos`. Éxito → `SINCRONIZADO=1` y `FOTOGRAFIA=null`. Fallo → se queda en `0`.
3. Si `fallidos === 0` → `metaSyncOff.put({ clave: 'ultimoEnvio', valor: Date.now() })`.
4. Mensaje: todo bien → *"Se enviaron N elementos."*; parcial → *"Se enviaron X de Y. Quedan Z pendientes."*; nada que enviar → *"Sin respuestas pendientes."*
5. `refrescarContadores()`.

Un `401` deja todo en cola y muestra *"Tu sesión no es válida, vuelve a iniciar sesión."* (manejo completo en FE-07).

### 6.3 Borrar caché

1. Se cuentan pendientes (respuestas + reportes).
2. Diálogo:
   - Sin pendientes → *"¿Estás seguro de eliminar la caché del dispositivo?"*
   - Con pendientes → *"Tienes N respuestas y M reportes sin enviar. Si borras la caché se perderán para siempre. ¿Continuar?"* + segunda confirmación.
3. `clear()` sobre `reportesOff`, `tareasTecnicoOff`, `parroquiasOff` y `metaSyncOff`.
4. `refrescarContadores()` → todo en 0, ambas fechas vuelven a *"Nunca"*.

**No cierra sesión** (el JWT vive en `localStorage`, no en IndexedDB) y **no toca el caché del service worker** (la PWA sigue instalada y abriendo sin conexión). Solo borra datos.

---

## 7. Pruebas

Suite `vitest` sobre `sincronizacion.service.ts`, con `fake-indexeddb` (nueva devDependency) y `HttpClient` mockeado.

| Caso | Verifica |
|---|---|
| Migración v8 → v9 | Las tareas existentes quedan con `pendienteSubir = 0` |
| Subida completa | Ambas colas quedan vacías y se escribe `ultimoEnvio` |
| Subida parcial | Lo que falló sigue en cola y **no** se escribe `ultimoEnvio` |
| Reporte sincronizado | Queda con `SINCRONIZADO=1` y `FOTOGRAFIA=null` (la fila no se borra) |
| Descarga bloqueada (D5) | Con `pendienteSubir=1` la descarga no se ejecuta y `tareasTecnicoOff` queda intacta |
| Borrar caché | Las cuatro tablas quedan vacías y los contadores en 0 |
| Cambio de estado offline | `cambiarEstado` sin conexión deja `pendienteSubir=1` (regresión de B4) |

**QA manual complementario:** simular offline con `Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })` **sin recargar la página** y navegando solo con clics dentro de la SPA (una recarga reinicia los signals de Angular).

---

## 8. Criterios de aceptación

1. Existe `/sincronizacion`, accesible desde el ítem "Sincronizar" (icono tuerca) del menú, solo para quien tenga el módulo `MIS_TAREAS`.
2. Los cuatro contadores reflejan el estado real de IndexedDB y se refrescan tras cada operación.
3. "Descargar" trae tareas del grupo + parroquias, escribe `ultimaDescarga` y marca `ESTADO='D'` en el servidor.
4. "Descargar" está bloqueado mientras haya respuestas sin enviar, con el número en el mensaje.
5. "Subir respuestas" envía ambas colas; lo que falla permanece en cola y el mensaje reporta el parcial.
6. Un cambio de estado hecho sin conexión **llega al servidor** tras presionar "Subir respuestas" (B4 cerrado).
7. "Borrar caché" advierte con números reales, exige doble confirmación si hay pendientes, y no cierra la sesión.
8. El Home del técnico ya no tiene "Descargar Tareas" ni "Subir reporte"; enlaza a `/sincronizacion`.
9. No queda ningún `effect()` de sincronización automática.
10. `npm test` en `frontend/` ejecuta la suite y pasa.

---

## 9. Fuera de alcance

- **BE-07** — idempotencia de `POST /api/requerimientos`.
- **FE-04** — dashboard del Home del técnico (consumirá los contadores de este servicio).
- **FE-07** — interceptor de sesión inválida.
- **FE-08 / B7** — retirar el campo muerto `ESTADO: 'N'` de `ReporteOffline`. Está en `offline-db.ts`, que este ticket sí modifica, pero se deja fuera a propósito para que el diff de la migración v9 quede limpio y auditable.
- **B1** (login Cognito), **B2** (UTM), **B3** (`environment.prod.ts`), **B5** (filas de prueba): pausados por instrucción del usuario.
