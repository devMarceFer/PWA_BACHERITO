# Grupos con parroquias a cargo + asignación masiva por parroquia

**Fecha:** 2026-08-02
**Alcance:** Base de datos (script entregado), Backend (Node/Express/Oracle), Frontend (Angular 22)
**Reemplaza a:** el ítem `BE-04` / `FE-06` del backlog original, con la regla de asignación redefinida por el usuario

---

## 1. Problema

Hoy un grupo de trabajo solo tiene nombre y técnicos. No hay forma de decir "esta cuadrilla es responsable de estas parroquias", y asignarle baches se hace uno por uno desde la pantalla de detalle.

Verificado en el código antes de diseñar:

```
grupoRepository.crear({ nombre, creadoPor, tecnicos })      // sin parroquias
grupoRepository.asignarTarea({ idGrupo, idRequerimiento })  // manual, de a uno
```

No existe `OP_BACHERITO_GRUPO_PARROQUIAS` ni equivalente, ni en el backend ni en `database/`.

**Lo que se pide:** que un grupo tenga N parroquias a cargo, y una acción explícita que traiga al grupo los baches pendientes de esas parroquias.

**Lo que NO se pide** (decisión explícita del usuario): asignación automática al momento de reportar el bache. Se descartó porque abre preguntas sin respuesta clara (qué pasa si no hay grupo para esa parroquia, qué pasa con los baches históricos) y porque quita control al administrador.

---

## 2. Decisiones tomadas

| # | Decisión | Motivo |
|---|---|---|
| D1 | **Una parroquia pertenece a un solo grupo.** Restricción `UNIQUE` en la tabla | Modelo territorial sin ambigüedad: cada zona tiene un responsable claro. Se hace cumplir en Oracle, no en el backend |
| D2 | **Quitar una parroquia de un grupo NO desasigna los baches que ya tenía** | Lo ya asignado es trabajo comprometido; puede haber un técnico con el bache en estado 'En proceso'. Para sacar uno puntual ya existe `quitarTarea` |
| D3 | **La acción masiva previsualiza y pide confirmación** | Asignar cambia `OP_BACHERITO_REQ.ESTADO` a `'R'` en decenas de filas reales. El administrador debe ver el alcance antes |
| D4 | **Se monta vitest en el backend** y se prueban las reglas en la capa de servicio con el repositorio mockeado | El backend no tiene ninguna prueba (bug B8) y esta feature contiene la operación más destructiva del sistema |

### Datos reales que acotaron el diseño (consultados en producción, solo lectura)

| Parroquia | Baches disponibles |
|---|---|
| 1171 ATOCHA – FICOA | 2 |
| 1172 CELIANO MONGE | 7 |
| 1173 HUACHI CHICO | 6 |
| 1175 LA MERCED | 1 |
| 1176 LA PENÍNSULA | 0 |
| 1177 MATRIZ | 8 |

Volúmenes chicos: el caso de uso previsto (GRUPO_A con 1171/1172/1173, GRUPO_B con 1175/1176/1177) mueve 15 y 9 baches. **No hay problema de escala**, así que no se diseñó paginación ni proceso por lotes. No existe ningún grupo creado todavía.

---

## 3. Base de datos

Script a entregar en `database/grupo_parroquias_setup.sql`. **Se entrega, no se ejecuta** — convención del proyecto.

```sql
CREATE TABLE GADMAPPS.OP_BACHERITO_GRUPO_PARROQUIAS (
    ID_GRUPO_PARROQUIA NUMBER GENERATED ALWAYS AS IDENTITY,
    ID_GRUPO           NUMBER NOT NULL,
    PAR_CODIGO         NUMBER NOT NULL,
    ASIGNADO_POR       NUMBER NOT NULL,
    FECHA_ASIGNACION   DATE DEFAULT SYSDATE NOT NULL,
    CONSTRAINT PK_GRUPO_PARROQUIAS PRIMARY KEY (ID_GRUPO_PARROQUIA),
    CONSTRAINT FK_GP_GRUPO FOREIGN KEY (ID_GRUPO)
        REFERENCES GADMAPPS.OP_BACHERITO_GRUPOS(ID_GRUPO) ON DELETE CASCADE,
    CONSTRAINT UQ_GP_PARROQUIA UNIQUE (PAR_CODIGO)
);

CREATE INDEX IX_GP_GRUPO ON GADMAPPS.OP_BACHERITO_GRUPO_PARROQUIAS (ID_GRUPO);
```

- `UQ_GP_PARROQUIA` implementa **D1** a nivel de motor. Aunque alguien llame la API directamente, Oracle rechaza el duplicado.
- `ON DELETE CASCADE` hace que borrar un grupo libere sus parroquias sin dejar filas huérfanas.
- `IX_GP_GRUPO` sirve la consulta más frecuente (las parroquias de un grupo).
- No se referencia `PAR_PARROQUIAS` con una FK porque el resto del proyecto tampoco lo hace (`OP_BACHERITO_REQ.PARROQUIA` es un número suelto). Se mantiene la convención existente.

---

## 4. Backend

Todos los endpoints bajo `requireAuth` + `requireModulo('ASIGNAR_GRUPO')`, siguiendo las 7 capas del proyecto.

| Método | Ruta | Devuelve / recibe |
|---|---|---|
| `GET` | `/api/grupos/:id/parroquias` | Parroquias del grupo: `[{ parCodigo, parNombre }]` |
| `GET` | `/api/grupos/parroquias-disponibles` | Parroquias que no tiene ningún grupo |
| `POST` | `/api/grupos/:id/parroquias` | Recibe `{ parroquias: number[] }`. **Agrega**, no reemplaza: las que el grupo ya tenía siguen ahí. Para quitar se usa el `DELETE` |
| `DELETE` | `/api/grupos/:id/parroquias/:codigo` | Quita una parroquia del grupo |
| `GET` | `/api/grupos/:id/baches-por-parroquia` | Previsualización: `{ total, detalle: [{ parCodigo, parNombre, cantidad }] }` |
| `POST` | `/api/grupos/:id/tareas/por-parroquia` | Asignación masiva. Devuelve `{ asignados: number }` |

### Orden de declaración de rutas (trampa conocida)

`/api/grupos/parroquias-disponibles` **debe declararse antes** de `/api/grupos/:id`, o Express la resolverá como `:id = 'parroquias-disponibles'` y el endpoint nunca se alcanzará. El proyecto ya tiene este patrón resuelto con `/resumen`, `/mapa` y `/tecnicos` en `grupo.routes.js`; seguir esa misma ubicación.

### Regla crítica de consistencia

La previsualización (`GET .../baches-por-parroquia`) y la asignación (`POST .../tareas/por-parroquia`) **deben usar el mismo criterio de selección**, que es el que ya usa `findBachesDisponibles`:

```sql
ESTADO <> 'A'
AND ID NOT IN (SELECT ID_REQUERIMIENTO FROM GADMAPPS.OP_BACHERITO_GRUPO_TAREAS)
AND INSTITUCION_RESPONSABLE = :institucion
AND PARROQUIA IN (parroquias del grupo)
```

Si divergen, el administrador confirma un número y se asigna otro. El criterio debe vivir **en un solo lugar** del repositorio, consumido por ambas rutas.

### Transaccionalidad

`POST .../tareas/por-parroquia` corre en **una sola transacción**: inserta todas las filas de `OP_BACHERITO_GRUPO_TAREAS` y actualiza todos los `OP_BACHERITO_REQ.ESTADO = 'R'`, o revierte entero. No se permite un resultado parcial.

Es el mismo comportamiento que ya tiene la asignación individual, extendido a N filas.

---

## 5. Frontend

Sin pantallas nuevas. Todo vive en `grupo-detalle`.

### Bloque "Parroquias a cargo"

- Chips con las parroquias del grupo, cada una con una × para quitarla.
- Selector para agregar que **solo lista parroquias libres** (`GET /api/grupos/parroquias-disponibles`). El administrador no puede ni intentar una ya tomada, así que el conflicto deja de ser alcanzable por la vía normal.
- Estado vacío explicativo cuando el grupo no tiene ninguna.

### Bloque "Traer baches de mis parroquias"

Botón que abre un modal de previsualización:

```
┌──────────────────────────────────────┐
│  Traer baches de tus parroquias      │
│                                      │
│  ATOCHA – FICOA          2 baches    │
│  CELIANO MONGE           7 baches    │
│  HUACHI CHICO            6 baches    │
│  ─────────────────────────────────   │
│  Total                  15 baches    │
│                                      │
│  Se asignarán a este grupo y pasarán │
│  a estado "Reasignado".              │
│                                      │
│   [ Cancelar ]   [ Asignar 15 ]      │
└──────────────────────────────────────┘
```

- Deshabilitado si el grupo no tiene parroquias, **con la razón visible** — no un error después de presionar.
- Si el conteo da 0: *"No hay baches pendientes en tus parroquias."* y no se ofrece confirmar.

---

## 6. Manejo de errores

| Caso | Comportamiento |
|---|---|
| Dos administradores toman la misma parroquia a la vez | El `UNIQUE` de Oracle rechaza al segundo → **409** con el nombre del grupo que ya la tiene. El selector lo hace improbable, pero la base es la autoridad |
| Grupo sin parroquias | Botón deshabilitado con explicación |
| Falla a mitad de la asignación masiva | La transacción revierte entera; nada queda a medias |
| El conteo cambió entre previsualizar y confirmar | Se asigna lo que exista al confirmar, y el mensaje reporta el número **real**, que puede diferir del previsualizado |
| Quitar una parroquia | Solo borra la fila de `GRUPO_PARROQUIAS`. **No toca `GRUPO_TAREAS`** (D2) |

---

## 7. Pruebas

### Backend (nuevo — empieza a cerrar B8)

Montar vitest en `backend/` y probar la **capa de servicio con el repositorio mockeado**. Sin base de datos de por medio. Casos:

| Caso | Verifica |
|---|---|
| Previsualización con parroquias | Devuelve el desglose y el total correctos |
| Previsualización sin parroquias | Total 0, no rompe |
| Asignación masiva | Llama al repositorio con todos los ids y devuelve el conteo |
| Asignación con 0 disponibles | No llama al repositorio de escritura |
| Parroquia ya tomada | Propaga el conflicto como 409, no como 500 |
| Quitar parroquia | **No** invoca ninguna baja de tareas (D2) |

### Frontend

Vitest ya está montado y en verde (43 pruebas). Cubrir el servicio nuevo de parroquias del grupo: carga del listado, estado deshabilitado del botón, y que confirmar dispare la asignación una sola vez.

### QA manual

Crear GRUPO_A (1171/1172/1173) y GRUPO_B (1175/1176/1177) con sus técnicos, previsualizar, asignar, y verificar en Oracle que `OP_BACHERITO_GRUPO_TAREAS` recibió las filas y que los baches quedaron en `ESTADO='R'`.

> ⚠️ La base es de **producción**. La asignación masiva cambia el estado de baches reales. Requiere autorización explícita del usuario antes de ejecutarse, igual que el resto de las escrituras.

---

## 8. Criterios de aceptación

1. Existe el script `database/grupo_parroquias_setup.sql`, entregado y no ejecutado.
2. Un grupo puede tener N parroquias; una parroquia no puede estar en dos grupos, y lo impide la base.
3. El selector de parroquias solo ofrece las libres.
4. Quitar una parroquia no desasigna ningún bache ya asignado.
5. La previsualización muestra el desglose por parroquia y el total.
6. Confirmar asigna todos los baches en una transacción y los deja en `ESTADO='R'`.
7. Previsualización y asignación usan el mismo criterio de selección, definido en un solo lugar.
8. El botón está deshabilitado, con razón visible, si el grupo no tiene parroquias.
9. `npm test` existe y pasa en `backend/`.
10. `npm test` sigue en verde en `frontend/`.

---

## 9. Fuera de alcance

- **Asignación automática al reportar un bache.** Descartada explícitamente por el usuario a favor de la acción manual.
- **Reasignación retroactiva masiva** de los 1181 baches históricos. La acción trae lo pendiente de las parroquias del grupo; no hay migración masiva.
- **Reparto de una parroquia entre dos cuadrillas.** Excluido por D1.
- **B1, B2, B3, B5, B7** siguen pausados o sin autorización.
- El texto engañoso del popup de reporte offline ("se subirá automáticamente"), detectado durante la QA de FE-02, se corrige aparte.
