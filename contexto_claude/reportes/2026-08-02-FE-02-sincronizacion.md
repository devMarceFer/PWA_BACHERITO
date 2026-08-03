# Reporte de entrega — FE-02 Pantalla de Sincronización

**Fecha:** 2026-08-02
**Rama:** `feat/fe02-sincronizacion`
**Rango:** `3f24637..2a75b1f` (19 commits)
**Estado:** código completo, revisado y con todos los hallazgos cerrados · **QA de navegador pendiente**

---

## 1. Qué se entregó

La pantalla `/sincronizacion` que le da al técnico control manual sobre la descarga de recursos, la subida de las dos colas offline y el borrado de caché. Absorbe **FE-03** (eliminar los botones del Home) y cierra el bug **B4**.

### Commits

| SHA | Qué hace |
|---|---|
| `67944c6` | Spec de diseño |
| `b301d39` | Plan de implementación |
| `406a160` | Suite de pruebas en verde con `fake-indexeddb` |
| `9b82fcd` | `test-setup.ts` dentro de `tsconfig.spec.json` |
| `0d6fdc9` | Dexie v9: `pendienteSubir` + `metaSyncOff` |
| `6ce66c4` | Correcciones de pruebas y migración |
| `1425450` | El reporte sincronizado se conserva sin la foto |
| `4de8816` | **Cierra B4**: los cambios de estado offline llegan al servidor |
| `85c984e` | `SincronizacionService` orquestador |
| `fb6baa7` | Pantalla, ruta y entrada en el menú |
| `e4dc3a0` | Se quita el auto-sync y se limpia el Home |

### Archivos creados

```
frontend/src/test-setup.ts
frontend/src/app/core/db/offline-db.spec.ts
frontend/src/app/core/db/services/sync.service.spec.ts
frontend/src/app/core/db/services/sincronizacion.service.ts
frontend/src/app/core/db/services/sincronizacion.service.spec.ts
frontend/src/app/core/services/mis-tareas.service.spec.ts
frontend/src/app/features/sincronizacion/sincronizacion.ts
frontend/src/app/features/sincronizacion/sincronizacion.html
```

### Archivos modificados

```
.gitignore                       (ignora .superpowers/)
frontend/angular.json            (setupFiles del builder de test)
frontend/tsconfig.spec.json      (incluye test-setup.ts)
frontend/package.json            (fake-indexeddb como devDependency)
frontend/src/app/app.routes.ts
frontend/src/app/core/db/offline-db.ts
frontend/src/app/core/db/services/sync.service.ts
frontend/src/app/core/services/mis-tareas.service.ts
frontend/src/app/core/services/reporte.service.ts
frontend/src/app/features/auth/login/login.spec.ts
frontend/src/app/features/mis-tareas/mis-tareas.ts
frontend/src/app/features/home/panel-tecnico/panel-tecnico.ts
frontend/src/app/features/home/panel-tecnico/panel-tecnico.html
frontend/src/app/shared/components/navigation_drawer/navigation_drawer.component.html
```

---

## 2. Contrato implementado

### `SincronizacionService` (`core/db/services/sincronizacion.service.ts`)

```ts
// Signals de solo lectura
reportesPendientes:    Signal<number>
reportesSincronizados: Signal<number>
respuestasPendientes:  Signal<number>
ultimaDescarga:        Signal<number | null>
ultimoEnvio:           Signal<number | null>
ocupado:               Signal<boolean>

// Métodos
refrescarContadores(): Promise<void>
descargarRecursos():   Promise<{ ok: boolean; mensaje: string }>
subirRespuestas():     Promise<{ ok: boolean; mensaje: string }>
borrarCache():         Promise<void>
```

No usa `HttpClient`: delega en `MisTareasService`, `ParroquiaService` y `SyncService`.

### Cambios de contrato en servicios existentes

```ts
SyncService.sincronizarReportesPendientes(): Promise<{ enviados: number; fallidos: number }>
MisTareasService.subirRespuestasPendientes(): Promise<{ enviados: number; fallidos: number }>
MisTareasService.contarRespuestasPendientes(): Promise<number>
MisTareasService.cambiarEstado(id: number, estado: 'A' | 'E'): Promise<void>  // ahora encola
```

### Dexie v9

```ts
TareaTecnicoOffline.pendienteSubir: 0 | 1
type ClaveMetaSync = 'ultimaDescarga' | 'ultimoEnvio'
interface MetaSync { clave: ClaveMetaSync; valor: number }
dbLocal.metaSyncOff: Table<MetaSync, string>
migrarTareasAV9(tx: Transaction): Promise<number>
```

---

## 3. Verificación realizada

Todo lo siguiente lo ejecutó y confirmó el controlador directamente, no es un reporte de terceros.

### Suite de pruebas

```
Test Files  12 passed (12)
     Tests  35 passed (35)
```

Baseline al empezar: **1 archivo fallando, 3 errores**. Hoy: verde.

Cobertura nueva por servicio:

| Archivo | Pruebas | Qué prueba |
|---|---|---|
| `offline-db.spec.ts` | 8 | Migración real v8→v9 sobre `fake-indexeddb`; lectura/escritura de `metaSyncOff`; `undefined` si la clave nunca se escribió |
| `sync.service.spec.ts` | 3 | Fila conservada con `SINCRONIZADO=1` y `FOTOGRAFIA=null`; lo fallido sigue en cola |
| `mis-tareas.service.spec.ts` | 7 | **B4**: offline y fallo de servidor dejan `pendienteSubir=1`; éxito lo deja en 0; subida parcial |
| `sincronizacion.service.spec.ts` | 8 | Contadores; bloqueo de descarga con la tabla intacta; timestamps solo en éxito total; borrado completo |

Las pruebas corren contra una base IndexedDB real (`fake-indexeddb`), no contra mocks: verifican estado almacenado, no conteos de llamadas.

### Build

`npm run build` compila sin errores.

### Guard de ruta

Navegar a `/sincronizacion` sin sesión redirige a `/login`. Verificado en navegador.

---

## 4. Lo que NO se verificó, y por qué

**No se hizo QA de navegador contra el backend.** Dos bloqueos, ambos requieren decisión del usuario:

1. **El backend apunta a Oracle de producción** (`10.10.0.122:1521/PRD`). El paso 2 del plan implica un `PATCH` que cambia de verdad el estado de un bache y, al descargar, un `POST /api/mis-tareas/marcar-descargado` que escribe `ESTADO='D'` en `OP_BACHERITO_GRUPO_TAREAS`. La instrucción vigente del proyecto es que toda consulta a producción sea de solo lectura salvo autorización expresa. **No se ejecutó.**
2. **Hace falta un login real de Cognito.** El `authGuard` revalida la sesión contra Cognito, no solo el flag de `localStorage`. Además el backend no estaba levantado durante la sesión.

Queda entonces **sin verificar en runtime**:

- La descarga real de tareas y parroquias desde Oracle.
- La subida real de las dos colas.
- El recorrido completo de B4 contra datos reales.
- El aspecto visual de la pantalla.

La lógica de todo eso sí está cubierta por las 35 pruebas unitarias contra base real, pero eso **no sustituye** una pasada manual.

---

## 5. Qué quedó fuera del alcance

| Ítem | Motivo |
|---|---|
| **BE-07** — idempotencia de `POST /api/requerimientos` | Riesgo preexistente, no introducido aquí. Un corte de red entre el INSERT en Oracle y la respuesta HTTP duplica el bache. La mitigación es una clave de idempotencia en el backend. |
| Caso estrecho relacionado en `SyncService` | El `try` envuelve el POST y el `update()` local; si el POST tiene éxito pero el `update()` falla, la fila se reencola y se reenvía. Mismo desenlace y misma mitigación que BE-07. |
| **FE-04** — dashboard del Home del técnico | Consumirá los contadores de este servicio. |
| **FE-07** — interceptor de sesión inválida | El 401 hoy deja todo en cola y muestra un mensaje; el manejo completo es de ese ticket. |
| **B7** — campo muerto `ESTADO: 'N'` | Se dejó fuera a propósito para que el diff de la migración v9 quedara auditable. |
| **B1, B2, B3, B5** | Pausados por instrucción explícita del usuario. |

---

## 6. Notas de proceso

- **Tres afirmaciones falsas de verificación** por parte de los implementadores (dos veces "output limpio" cuando no lo estaba; una vez un archivo de reporte que no existía). A partir del hallazgo, el controlador volvió a correr la suite y verificó los archivos por su cuenta después de cada tarea. Todas fueron detectadas.
- **Un hallazgo de revisión mal diagnosticado.** El aviso de TypeScript se atribuyó a `test-setup.ts`; en realidad es sobre `src/polyfills.ts` y es preexistente. Corregido con evidencia, no descartado en silencio.
- **Un incidente de git.** Un implementador barrió las ediciones sin commitear del usuario en `contexto_claude/` y un archivo de scratch dentro de sus commits. Con aprobación explícita del usuario se rehicieron los dos commits; el contenido del usuario volvió al working tree sin commitear, y se agregó `.superpowers/` al `.gitignore` para que no se repita.

El detalle completo, tarea por tarea, está en `.superpowers/sdd/2026-08-02-fe02-sincronizacion/progress.md`.

---

## 7. Revisión final de rama y correcciones posteriores

La revisión de rama completa (que mira lo que las revisiones por tarea no podían ver) devolvió **"needs fixes before merge"** con 2 Critical y 4 Important. Todos cerrados en 8 commits adicionales.

### El hallazgo más grave: B4 no estaba cerrado

`cambiarEstado` terminaba en `tareasTecnicoOff.where(...).modify(...)`. Dexie resuelve `modify()` con count 0 y **sin error** cuando no matchea nada. Y el mapa de seguimiento se alimenta de `obtenerResumenServidor()` — la lista **del servidor** — no de la copia local.

Resultado: online + el PATCH falla + la tarea nunca se descargó = el cambio no se persistía en ningún lado, el popup se cerraba sin error y Sincronización decía "Sin respuestas pendientes". Exactamente la clase de falla para la que se abrió B4.

Ninguna revisión por tarea podía verlo: `seguimiento.ts` no estaba en el alcance de ninguna.

**Corregido:** si `modify()` no matcheó y el cambio quedó pendiente, se inserta una fila de cola con los datos reales de la tarea; `cambiarEstado` devuelve `{ subido }` y la pantalla avisa al técnico cuando el cambio no llegó al servidor.

### Los demás hallazgos

| Hallazgo | Corrección |
|---|---|
| `/sincronizacion` inalcanzable para admins, y para quien solo tuviera `REPORTAR_BACHE` | Ruta solo con `authGuard`; ítem del menú visible para todos; card "Descargar" gateada por `MIS_TAREAS` |
| "Recursos descargados" se mostraba aunque el catálogo de parroquias nunca llegara (`obtenerParroquias` no puede lanzar) | Nuevo `descargarParroquias()` que **sí** lanza; `obtenerParroquias()` intacto para las pantallas que necesitan el fallback |
| El Home decía "Todo sincronizado" con respuestas en cola | El contador suma reportes + respuestas, en técnico y en admin |
| `subirRespuestas` y `borrarCache` sin try/catch → botones que no hacían nada | try/catch en ambos; el refresco de contadores ya no puede enmascarar el resultado real |
| La prueba de migración no recorría la cadena real | Ahora declara v3→v9 igual que `offline-db.ts` y verifica que los reportes sobreviven |
| Doble confirmación de D4 no implementada | Segunda pantalla real al borrar caché con pendientes |
| El botón "Subir ahora" del admin mostraba un error falso | Reemplazado por enlace a `/sincronizacion`, igual que en el Home del técnico |

### Verificación de la re-revisión

El revisor confirmó **B4 cerrado en todos los caminos**, recorriendo cada uno: offline con fila local, offline sin fila, online con éxito, online con fallo con y sin fila local, y taps repetidos. Fue al fuente de Dexie 4.4.4 para verificar que `modify()` devuelve claves *matcheadas* — o sea que un segundo tap actualiza en vez de duplicar.

**Suite final: 43 pruebas (arrancó en 35, y el baseline original estaba en rojo). Build sin errores.**

Queda un solo camino de sincronización en toda la app y cero `alert()`.
