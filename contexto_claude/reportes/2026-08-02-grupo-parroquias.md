# Reporte de entrega — Grupos con parroquias a cargo

**Fecha:** 2026-08-02
**Rama:** `feat/fe02-sincronizacion`
**Rango:** `5eee113..001a23f` (8 commits)
**Estado:** código completo y revisado · **QA manual pendiente de autorización**

---

## 1. Qué se entregó

Un grupo de trabajo ahora tiene **N parroquias a cargo**, y el administrador puede traer al grupo, con una acción explícita y previsualizada, todos los baches pendientes de esas parroquias.

**No hay asignación automática al reportar un bache.** Fue una decisión explícita: abría preguntas sin respuesta clara (qué pasa si ninguna cuadrilla cubre esa parroquia, qué pasa con los 1181 baches históricos) y le quitaba control al administrador.

### Commits

| SHA | Qué hace |
|---|---|
| `6f2cda8` | Spec de diseño |
| `5eee113` | Plan de implementación |
| `3b07956` | Script SQL de la tabla nueva |
| `ea08981` | Parroquias del grupo + **vitest en el backend** |
| `00b67a7` | Previsualización y asignación masiva |
| `b81c174` | Controlador y rutas |
| `3c041e4` | Servicio del frontend |
| `1576e78` | Bloque "Parroquias a cargo" |
| `002e64c` | Criterio de selección unificado en un solo lugar |
| `001a23f` | Bloque "Traer baches" con previsualización |

---

## 2. Decisiones tomadas

| # | Decisión |
|---|---|
| **D1** | Una parroquia pertenece a **un solo grupo**. Lo hace cumplir `UNIQUE(PAR_CODIGO)` en Oracle, no el backend |
| **D2** | Quitar una parroquia **no** desasigna los baches ya asignados: puede haber un técnico con el trabajo en curso |
| **D3** | La acción masiva **previsualiza y pide confirmación** antes de asignar |
| **D4** | Se monta **vitest en el backend** — empieza a cerrar el bug B8 |

---

## 3. Contrato implementado

### Endpoints (todos con `requireAuth` + `requireModulo('ASIGNAR_GRUPO')`)

| Método | Ruta | Entrada / Salida |
|---|---|---|
| `GET` | `/api/grupos/:id/parroquias` | → `[{ parCodigo, parNombre }]` |
| `GET` | `/api/grupos/parroquias-disponibles` | → las que no tiene ningún grupo |
| `POST` | `/api/grupos/:id/parroquias` | `{ parroquias: number[] }`. **Agrega**, no reemplaza |
| `DELETE` | `/api/grupos/:id/parroquias/:codigo` | Quita una |
| `GET` | `/api/grupos/:id/baches-por-parroquia` | → `{ total, detalle: [{ parCodigo, parNombre, cantidad }] }` |
| `POST` | `/api/grupos/:id/tareas/por-parroquia` | → `{ asignados: number }` |

Códigos de error: **400** validación, **404** parroquia no asignada a ese grupo, **409** parroquia ya a cargo de otro grupo.

### Servicio

```js
grupoService.obtenerParroquiasDeGrupo(idGrupo)
grupoService.obtenerParroquiasDisponibles()
grupoService.asignarParroquias(idGrupo, parroquias, asignadoPor)
grupoService.quitarParroquia(idGrupo, parCodigo)
grupoService.previsualizarBachesPorParroquia(idGrupo)   // { total, detalle }
grupoService.asignarBachesPorParroquia(idGrupo, asignadoPor)  // { asignados }
```

---

## 4. Verificación realizada

Todo lo siguiente lo ejecutó y confirmó el controlador directamente.

```
backend:   Test Files  2 passed (2)     Tests  15 passed (15)
frontend:  Test Files 13 passed (13)    Tests  49 passed (49)
build:     0 errores
```

**El backend no tenía ninguna prueba antes de este trabajo** — `npm test` era el stub `echo "Error: no test specified" && exit 1`. Ahora corre y pasa. Eso empieza a cerrar B8.

### Los dos puntos que podían fallar en silencio

**Consistencia previsualización / asignación.** Si las dos consultas seleccionaran conjuntos distintos, el administrador confirmaría "se asignarán 15 baches" y se asignarían otros, sobre datos reales ya modificados.

La revisión encontró que, aunque los `WHERE` eran idénticos, estaban escritos como **dos literales SQL independientes** — incumpliendo el criterio 7 del spec, que exigía un solo lugar. El plan mismo indujo el error. Se corrigió en `002e64c`: el criterio vive ahora en la constante de módulo `CRITERIO_BACHES_DE_PARROQUIAS_DEL_GRUPO`, interpolada en ambas consultas.

**Atomicidad de la asignación masiva.** Verificada contra el patrón preexistente de `asignarTarea`: una sola conexión, `autoCommit: false` en cada `execute`, `commit()` solo al final, `rollback()` ante cualquier fallo. Un error en la fila N revierte las N−1 anteriores.

---

## 5. QA manual — pendiente de tu autorización

> ⚠️ La base es de **producción** (`10.10.0.122:1521/PRD`). La asignación masiva cambia el estado de baches reales del municipio. Nada de esto se ejecutó.

1. Correr `database/grupo_parroquias_setup.sql` contra Oracle. *(Ya ejecutado por el usuario el 2026-08-02.)*
2. Crear **GRUPO_A** con dos técnicos y **GRUPO_B** con el tercero.
3. Asignar **1171 / 1172 / 1173** al GRUPO_A y **1175 / 1176 / 1177** al GRUPO_B.
4. Intentar asignar 1171 al GRUPO_B → debe rechazarlo con **409**.
5. Previsualizar en GRUPO_A → debe mostrar el desglose y el total.
6. Confirmar → verificar en Oracle que `OP_BACHERITO_GRUPO_TAREAS` recibió las filas y que esos baches quedaron en `ESTADO='R'`.
7. Quitar una parroquia del GRUPO_A → **los baches ya asignados deben seguir en el grupo** (D2).

### Volúmenes reales al momento de escribir esto

| Parroquia | Baches disponibles |
|---|---|
| 1171 ATOCHA – FICOA | 2 |
| 1172 CELIANO MONGE | 7 |
| 1173 HUACHI CHICO | 6 |
| 1175 LA MERCED | 1 |
| 1176 LA PENÍNSULA | 0 |
| 1177 MATRIZ | 8 |

GRUPO_A traería **15**, GRUPO_B **9**.

### Cómo consultar los registros nuevos

`ORDER BY ID DESC` **no sirve** en esta tabla: los datos históricos ocupan los IDs altos (hasta 2766) mientras la secuencia de IDs nuevos va por 70. Usar:

```sql
SELECT ID, NOMBRES, PARROQUIA, ESTADO, FECHA_INGRESO
FROM GADMAPPS.OP_BACHERITO_REQ
WHERE FECHA_INGRESO >= TRUNC(SYSDATE)
ORDER BY FECHA_INGRESO DESC;
```

**El servidor Oracle corre una hora adelantado** respecto de la máquina de desarrollo. Tenerlo en cuenta al correlacionar horas.

---

## 6. Qué quedó fuera

| Ítem | Motivo |
|---|---|
| Asignación automática al reportar | Descartada explícitamente a favor de la acción manual |
| Reasignación retroactiva de los 1181 baches históricos | No hay migración masiva; la acción trae lo pendiente de las parroquias del grupo |
| Repartir una parroquia entre dos cuadrillas | Excluido por D1 |
| `executeMany` en vez de loop de `execute` | Minor diferido; la atomicidad está garantizada por la transacción |
| Validar que el grupo exista en los métodos nuevos | Minor diferido; hoy un id inexistente devuelve conjuntos vacíos en vez de 404 |
| **B1, B2, B3, B5, B7** | Pausados o sin autorización |

### Pendientes heredados de FE-02

- El popup de reporte offline dice *"se subirá automáticamente cuando vuelva la conexión"*, que es **falso** desde que la sincronización pasó a ser solo manual.
- **B2 (UTM invertido)** ahora tiene tres filas más con el error: los baches **68, 69 y 70** creados durante la QA.

El detalle tarea por tarea está en `.superpowers/sdd/2026-08-02-grupo-parroquias/progress.md`.
