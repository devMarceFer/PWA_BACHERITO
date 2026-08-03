# Diseño — Gestión de accesos por sistema, rol y módulo

**Fecha:** 2026-08-02
**Rama:** `feat/fe02-sincronizacion`
**Estado:** aprobado por el usuario, pendiente de plan de implementación

---

## 1. El problema

Hoy los permisos de Bacherito se otorgan escribiendo `INSERT` a mano en Oracle. No hay ninguna
pantalla que lo haga. Eso tiene tres consecuencias medibles, verificadas contra la base de
producción el 2026-08-02:

1. **De los 4 usuarios registrados, solo 1 puede iniciar sesión.** `RBAC_USUARIO_MODULO_ROL`
   tiene 3 filas, todas del usuario 21. Los usuarios 22, 23 y 24 están activos y no bloqueados,
   pero `auth.service.js:122` los rechaza con `SIN_MODULOS_ASIGNADOS`.
2. **No se puede armar ninguna cuadrilla.** `grupo.repository.js:271` (`buscarTecnicos`) exige
   `RBAC_ROLES.NOMBRE = 'TECNICO'` en una fila activa de `RBAC_USUARIO_MODULO_ROL`. Ningún
   usuario tiene ese rol, así que el buscador de técnicos de "Asignar Grupo" devuelve vacío
   siempre. La creación de GRUPO_A y GRUPO_B está bloqueada por esto, no por un defecto de esa
   pantalla.
3. **No hay rastro de quién otorgó qué.** La columna `ASIGNADO_POR` existe y se llena a mano,
   con el número que quien escribe el `INSERT` decida poner.

Este trabajo agrega la pantalla que faltaba.

---

## 2. Lo que ya existe (estado real de la base)

Consultado en solo lectura contra `10.10.0.122:1521/PRD`, esquema `GADMAPPS`.

### `RBAC_SISTEMAS` — 1 fila

| ID_SISTEMA | NOMBRE | TOKEN_EXPIRACION_MIN | ESTADO |
|---|---|---|---|
| 1 | BACHERITO | 5760 | S |

### `RBAC_ROLES` — 5 filas

| ID_ROL | NOMBRE |
|---|---|
| 1 | ADMIN |
| 2 | EDITOR |
| 3 | OPERADOR |
| 4 | VIEWER |
| 21 | TECNICO |

### `RBAC_MODULOS` — 4 filas, todas del sistema 1

| ID_MODULO | NOMBRE | RUTA_BASE |
|---|---|---|
| 1 | REPORTAR_BACHE | `/reporta/nuevo` |
| 2 | SEGUIMIENTO_BACHE | `/reporta` |
| 21 | ASIGNAR_GRUPO | `/admin/grupos` |
| 22 | MIS_TAREAS | `/mis-tareas` |

### `RBAC_USUARIOS` — 4 filas

| ID_USUARIO | NUM_DOCUMENTO | EMAIL | NOMBRE |
|---|---|---|---|
| 21 | 1802990042 | marcelofrobayo@gmail.com | GALO GEOVANNY CASTILLO SALVADOR |
| 22 | 1801806074 | titecnico28@ambato.gob.ec | JORGE WASHINGTON RAMOS ESPINOZA |
| 23 | 1802291078 | titecnico27@ambato.gob.ec | NELSON GUTIERREZ ABRIL |
| 24 | 1805363296 | oswalmiranda1991@gmail.com | BYRON JAVIER LUCERO CUNALATA |

### `RBAC_USUARIO_MODULO_ROL` — 3 filas

Usuario 21 con módulos 1, 2 y 21, los tres con rol ADMIN.

### Restricciones que condicionan el diseño

- **`UK_USUARIO_MODULO_ROL` es `UNIQUE (ID_USUARIO, ID_MODULO, ID_ROL)`** — no `(ID_USUARIO,
  ID_MODULO)`. Un usuario puede tener el mismo módulo bajo dos roles distintos.
- `ID_UMR`, `ID_MODULO`, `ID_ROL`, `ID_SISTEMA` y `ID_USUARIO` son columnas de **identidad**;
  ningún `INSERT` debe fijar su valor.
- FKs: `ID_USUARIO` y `ASIGNADO_POR` → `PK_USUARIOS`; `ID_MODULO` → `PK_MODULOS`;
  `ID_ROL` → `PK_ROLES`. Ninguna con `ON DELETE CASCADE`.
- `ESTADO CHAR(1) DEFAULT 'S' NOT NULL`, `CREADO_EN TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
  `FECHA_INICIO` y `FECHA_FIN` nulables.

### La vista que ya consume el login

`GADMAPPS.VW_AUTORIZACION_USUARIOS` (definida en `database/autorizacion_usuarios.sql`) une las
cinco tablas y filtra por `U.ESTADO='S'`, `U.BLOQUEADO=0`, `UMR.ESTADO='S'`, `M.ESTADO='S'`,
`S.ESTADO='S'`, `R.ESTADO='S'` y la vigencia `FECHA_INICIO`/`FECHA_FIN`.

**Esta vista no se modifica.** El diseño se acomoda a ella, no al revés.

---

## 3. Decisiones

| # | Decisión | Motivo |
|---|---|---|
| **D1** | La pantalla la protege un **módulo nuevo**, `GESTIONAR_ACCESOS` | Reutilizar `ASIGNAR_GRUPO` significaría que cualquiera que reparta trabajo puede además otorgarse permisos a sí mismo y a cualquiera. Es escalada de privilegios |
| **D2** | La unidad de otorgamiento es el par **(módulo, rol)** | Es lo que permite `UK_USUARIO_MODULO_ROL` y lo que pidió el usuario: un mismo usuario puede tener distintos roles en distintos módulos |
| **D3** | El sistema **no es un selector**; los módulos se agrupan bajo su sistema | `RBAC_MODULOS.ID_SISTEMA` ya establece la relación. Hoy hay un solo sistema, así que se ve una sola sección; cuando exista otro, aparece sin tocar código |
| **D4** | Revocar pone `ESTADO='N'`; **no borra la fila** | `ESTADO` y `CREADO_EN` ya existen para eso. Un `DELETE` destruye la evidencia de quién tuvo qué acceso. La vista ya filtra por `UMR.ESTADO='S'`, así que funciona sin cambios |
| **D5** | Re-otorgar algo revocado **reactiva** la fila existente | Un `INSERT` chocaría contra `UK_USUARIO_MODULO_ROL` y produciría un ORA-00001 incomprensible para el administrador |
| **D6** | Nadie puede revocarse `GESTIONAR_ACCESOS` a sí mismo | Es la única puerta al módulo. Si el último administrador se la quita, nadie puede devolvérsela desde la aplicación: habría que entrar a Oracle a mano |
| **D7** | `FECHA_INICIO` y `FECHA_FIN` quedan en `NULL` | La vista los soporta, pero nadie pidió accesos con vigencia. Se agregan el día que hagan falta |
| **D8** | El otorgamiento múltiple viaja en **un solo `POST` transaccional** | Si falla la tercera fila de tres, el usuario queda a medio configurar y el administrador no sabe en qué estado quedó |
| **D9** | `ASIGNADO_POR` sale de `req.usuario.sub`, **nunca del cuerpo** | Para que una petición manipulada no pueda falsificar quién otorgó un permiso. Mismo criterio que ya usa `grupo.controller.js` |

### Fuera de alcance

- Crear, editar o borrar sistemas, roles o módulos. La pantalla **asigna** los que ya existen.
- Alta o baja de usuarios en `RBAC_USUARIOS`.
- Accesos con vigencia (D7).
- Hacer que el backend use el **rol** para decidir algo. Ver la sección 4.
- Arreglar `error.middleware.js`. Ver la sección 4.
- B1 (login Cognito), B3 (`environment.prod.ts`), B7 (`ESTADO: 'N'`): siguen pausados.

---

## 4. Dos limitaciones heredadas que este trabajo no arregla

Se documentan porque afectan cómo se lee la pantalla, no porque se vayan a tocar.

**El rol no decide nada todavía.** `auth.middleware.js:27` (`requireModulo`) compara únicamente
`modulo.m === nombreModulo`, y `auth.service.ts:60` (`tieneAcceso`) hace lo mismo en el frontend.
El rol se guarda, viaja dentro del JWT y se muestra, pero **hoy ningún control de acceso lo
consulta**. La única excepción es `grupo.repository.js:271`, que filtra por `NOMBRE='TECNICO'`
para armar cuadrillas. Consecuencia práctica: otorgar `MIS_TAREAS` con rol VIEWER da hoy el mismo
acceso que otorgarlo con rol ADMIN. La pantalla no debe sugerir lo contrario.

**El middleware global de errores siempre responde 500.** `error.middleware.js` ignora
`statusCode`. Por eso cada caso de negocio se mapea a su código HTTP **dentro del propio
controlador**, antes de llamar a `next(error)` — el mismo patrón que ya sigue
`grupo.controller.js`.

---

## 5. Contrato del backend

Capas del proyecto: `routes → controllers → services → repositories → models`.
Todos los endpoints llevan `requireAuth` + `requireModulo('GESTIONAR_ACCESOS')`.

| Método | Ruta | Entrada | Salida |
|---|---|---|---|
| `GET` | `/api/accesos/catalogo` | — | `{ sistemas: [{ idSistema, nombre, modulos: [{ idModulo, nombre, descripcion }] }], roles: [{ idRol, nombre }] }` |
| `GET` | `/api/accesos/usuarios?q=` | `q` (cédula, nombre, apellido o correo) | `[{ idUsuario, nombre, apellido, numDocumento, email, estado, bloqueado, totalAccesosActivos }]` |
| `GET` | `/api/accesos/usuarios/:id` | — | `{ usuario: {...}, accesos: [{ idUmr, idSistema, sistema, idModulo, modulo, idRol, rol, estado, creadoEn }] }` |
| `POST` | `/api/accesos/usuarios/:id` | `{ otorgamientos: [{ idModulo, idRol }] }` | `{ otorgados: number, reactivados: number }` |
| `DELETE` | `/api/accesos/usuarios/:id/modulos/:idModulo/roles/:idRol` | — | `{ success: true }` |

### Detalles que definen el comportamiento

- **`GET /catalogo`** trae solo sistemas, módulos y roles con `ESTADO='S'`. Un módulo dado de
  baja no debe poder otorgarse.
- **`GET /usuarios?q=`** busca en `RBAC_USUARIOS` **sin filtrar por rol ni por accesos** — el
  objetivo es encontrar a cualquiera, sobre todo a quien todavía no tiene nada. Se diferencia a
  propósito de `grupo.repository.js:buscarTecnicos`, que sí filtra. Máximo 20 resultados
  (`FETCH FIRST 20 ROWS ONLY`), igual que el buscador existente.
- **`GET /usuarios/:id`** devuelve accesos **activos y revocados**, distinguidos por `estado`.
  El frontend muestra los revocados colapsados.
- **`POST /usuarios/:id`** procesa el arreglo completo en **una sola conexión**, con
  `autoCommit: false` en cada `execute`, `commit()` al final y `rollback()` ante cualquier fallo
  — el patrón ya establecido en `grupo.repository.js:asignarTareasMasivo`. Por cada par
  `(idModulo, idRol)`: si existe una fila con `ESTADO='N'`, la reactiva (`ESTADO='S'`,
  `ASIGNADO_POR` al actor actual); si existe con `ESTADO='S'`, la deja intacta y no la cuenta;
  si no existe, la inserta. Esto hace la operación **idempotente**.
- **`DELETE`** pone `ESTADO='N'`. Si la fila no existe o ya estaba revocada, responde 404.

### Errores

Los servicios lanzan centinelas; el controlador los traduce.

| Centinela | HTTP | Cuándo |
|---|---|---|
| `VALIDACION_FALLIDA: ...` | 400 | `q` vacío, `otorgamientos` no es arreglo o viene vacío, ids no numéricos |
| `USUARIO_NO_ENCONTRADO` | 404 | `:id` no existe en `RBAC_USUARIOS` |
| `MODULO_O_ROL_INVALIDO` | 400 | Algún `idModulo`/`idRol` no existe o está en `ESTADO='N'` |
| `ACCESO_NO_ENCONTRADO` | 404 | El `DELETE` no encontró una fila activa que coincida |
| `AUTO_REVOCACION_PROHIBIDA` | 409 | D6: el actor intenta revocarse `GESTIONAR_ACCESOS` a sí mismo |

La comprobación de D6 se hace en el **servicio**, comparando `idUsuario` del parámetro contra
`req.usuario.sub`, y resolviendo el nombre del módulo desde `RBAC_MODULOS` — no confiando en que
el id 23 (o el que le toque) sea `GESTIONAR_ACCESOS`.

---

## 6. La pantalla

**Ruta:** `/admin/accesos`, con `authGuard` + `moduloGuard('GESTIONAR_ACCESOS')`.

**Menú:** entrada en `navigation_drawer.component.html`, dentro del bloque **Administración** que
ya existe para "Asignar Grupo", condicionada por `@if (tieneAccesoGestionarAccesos)`. Ícono
`admin_panel_settings`.

### Dos componentes

En `grupo-detalle.ts` la revisión anotó como pendiente que el archivo llegó a 330 líneas con tres
bloques de responsabilidad. Acá la separación va desde el principio:

- **`features/admin/accesos/accesos.ts`** — buscar y seleccionar usuario. Nada más.
- **`features/admin/accesos/accesos-usuario.ts`** — todo lo relativo a *un* usuario: listar sus
  accesos, otorgar, revocar. Recibe `idUsuario` como `input()` y emite un evento cuando algo
  cambia, para que el padre refresque el contador de la lista.
- **`features/admin/accesos/accesos.service.ts`** — el único que habla con `HttpClient`, con sus
  interfaces. Mismo patrón que `asignar-grupo.service.ts`.

### Composición

Toolbar `app-toolbar` (`titulo="Gestión de accesos"`, `[mostrarBotonMenu]="true"`,
`(menuClick)="menuAbierto.set(true)"`) más `app-navigation-drawer`, igual que las demás pantallas
de administración.

### Flujo

1. **Buscador** por cédula, nombre o correo.
2. **Ficha del usuario** con nombre, cédula y correo. Si tiene **cero accesos activos**, un aviso
   ámbar explícito: *"Este usuario no puede iniciar sesión: no tiene ningún módulo asignado."*
   Es el estado real de los usuarios 22, 23 y 24 hoy, y merece decirse, no deducirse de una lista
   vacía.
3. **Accesos activos**, una fila por par módulo + rol, agrupados bajo el nombre de su sistema,
   cada uno con su botón de revocar. Cuando D6 aplica, el botón se deshabilita **con la
   explicación visible**, no en silencio.
4. **Otorgar acceso**: **todos** los módulos del catálogo, cada uno con un `<select>` de rol.
   Selección múltiple, confirmación, un solo `POST`.

   No se ocultan los módulos que el usuario ya tiene: por D2 la clave es el par, y alguien con
   `MIS_TAREAS` como TECNICO puede además necesitarlo como ADMIN. Lo que se deshabilita es el
   **par exacto** ya activo, con el rol correspondiente marcado como "ya asignado" dentro del
   `<select>`. Ocultar el módulo entero haría imposible el caso que D2 existe para permitir.
5. **Revocados**, colapsados al pie. Es la razón de ser de D4.
6. **Banner permanente**: *"Los cambios de acceso se aplican cuando el usuario cierre sesión y
   vuelva a entrar."* Los módulos van embebidos en el JWT firmado en el login y
   `TOKEN_EXPIRACION_MIN` es 5760 (4 días). Sin este aviso, el administrador otorga un acceso, el
   técnico dice "no me aparece", y nadie entiende por qué.

### Manejo de errores en la plantilla

Cada bloque que escribe un signal de error **pinta ese error en su propio `@if`**: búsqueda,
otorgamiento y revocación tienen cada uno el suyo. Se explicita porque en `grupo-detalle` el plan
indujo el defecto contrario — 11 escrituras de `error` contra un solo punto de renderizado — y
cuatro operaciones, incluida una que mutaba producción, fallaban en silencio.

---

## 7. Pruebas automatizadas

Vitest ya está montado en ambos lados (backend 18/18, frontend 49/49 al momento de escribir esto).

**Backend** — `accesos.service.spec.js`, con el repositorio mockeado:

1. `otorgar` inserta cuando no existe la fila.
2. `otorgar` **reactiva** cuando existe con `ESTADO='N'` (D5).
3. `otorgar` no duplica ni cuenta cuando ya está activa (idempotencia, D8).
4. `otorgar` rechaza con `MODULO_O_ROL_INVALIDO` si algún módulo está en `ESTADO='N'`.
5. `revocar` pone `ESTADO='N'` y no borra (D4).
6. `revocar` lanza `AUTO_REVOCACION_PROHIBIDA` cuando el actor es el mismo usuario y el módulo es
   `GESTIONAR_ACCESOS` (D6).
7. `revocar` **sí permite** que el actor revoque `GESTIONAR_ACCESOS` a **otro** usuario — el
   complemento de la anterior, para que D6 no se implemente de más.
8. `ASIGNADO_POR` es el actor, aunque el cuerpo traiga otro valor (D9).

**Frontend** — `accesos.service.spec.ts`, siguiendo `asignar-grupo.service.spec.ts`: verifica
método, URL y cuerpo de los cinco endpoints.

---

## 8. Criterios de aceptación

| # | Criterio |
|---|---|
| **AC1** | Un usuario sin `GESTIONAR_ACCESOS` recibe 403 en los cinco endpoints y no ve la entrada del menú |
| **AC2** | El buscador encuentra a un usuario que **no tiene ningún acceso** (hoy: 22, 23, 24) |
| **AC3** | Otorgar 3 pares (módulo, rol) en una acción crea exactamente 3 filas; si una falla, no queda ninguna |
| **AC4** | Repetir el mismo otorgamiento no crea filas nuevas ni produce ORA-00001 |
| **AC5** | Revocar deja la fila con `ESTADO='N'`; `SELECT COUNT(*)` sobre la tabla no disminuye |
| **AC6** | Re-otorgar lo revocado reactiva la fila original: `ID_UMR` es el mismo |
| **AC7** | El botón de revocarse `GESTIONAR_ACCESOS` a uno mismo está deshabilitado y explicado; forzar el `DELETE` por API devuelve 409 |
| **AC8** | `ASIGNADO_POR` queda con el `ID_USUARIO` del actor en toda fila creada o reactivada |
| **AC9** | El banner sobre el reinicio de sesión es visible sin desplazarse |
| **AC10** | `VW_AUTORIZACION_USUARIOS` refleja los cambios sin haber sido modificada |

---

## 9. Puesta en marcha y prueba de aceptación

Hay una dependencia que no se puede saltar: el módulo `GESTIONAR_ACCESOS` no existe, y quien
implementa no puede otorgárselo a sí mismo ni iniciar sesión por el usuario.

**Paso 1 — el usuario** ejecuta `database/gestionar_accesos_setup.sql`:

```sql
INSERT INTO GADMAPPS.RBAC_MODULOS (ID_SISTEMA, NOMBRE, DESCRIPCION, RUTA_BASE)
VALUES (1, 'GESTIONAR_ACCESOS', 'Gestión de accesos por sistema, rol y módulo', '/admin/accesos');

INSERT INTO GADMAPPS.RBAC_USUARIO_MODULO_ROL (ID_USUARIO, ID_MODULO, ID_ROL, ASIGNADO_POR)
VALUES (21,
        (SELECT ID_MODULO FROM GADMAPPS.RBAC_MODULOS WHERE NOMBRE='GESTIONAR_ACCESOS' AND ID_SISTEMA=1),
        (SELECT ID_ROL   FROM GADMAPPS.RBAC_ROLES   WHERE NOMBRE='ADMIN'),
        21);

COMMIT;
```

`ID_MODULO` es identidad: el id se resuelve por subconsulta sobre `NOMBRE`, nunca quemado.

**Paso 2 — el usuario** cierra sesión y vuelve a entrar. Sin eso su JWT no contiene el módulo
nuevo y el guard lo rebota.

**Paso 3 — prueba de aceptación, por la pantalla y no por SQL.** Buscar `1801806074`
(ID_USUARIO 22, JORGE WASHINGTON RAMOS ESPINOZA) y otorgarle tres módulos, los tres con rol
**TECNICO** (`ID_ROL` 21):

| ID_MODULO | Módulo |
|---|---|
| 1 | `REPORTAR_BACHE` |
| 2 | `SEGUIMIENTO_BACHE` |
| 22 | `MIS_TAREAS` |

No se le otorga `ASIGNAR_GRUPO`(21): es un técnico, no un administrador.

Se hace por la interfaz porque eso ejercita el código entregado. Un `INSERT` a mano no probaría
nada de lo que se construyó.

> Este paso **escribe en la base de producción**. Requiere confirmación explícita del usuario en
> el momento de ejecutarlo.

**Paso 4 — verificación en Oracle, solo lectura:**

```sql
SELECT * FROM GADMAPPS.RBAC_USUARIO_MODULO_ROL WHERE ID_USUARIO = 22;
-- Esperado: 3 filas, ID_MODULO 1/2/22, ID_ROL 21, ESTADO 'S', ASIGNADO_POR 21

SELECT SISTEMA, MODULO, ROL FROM GADMAPPS.VW_AUTORIZACION_USUARIOS WHERE ID_USUARIO = 22;
-- Esperado: 3 filas, SISTEMA 'BACHERITO', ROL 'TECNICO'
```

**Paso 5 — el efecto secundario buscado.** Con el rol TECNICO ya asignado, el usuario 22 debe
aparecer en `grupo.repository.js:buscarTecnicos`, que hoy no devuelve a nadie. Eso destraba la
creación de GRUPO_A y GRUPO_B, pendiente desde el ciclo anterior.

---

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| El administrador se queda fuera de su propia herramienta | D6 en el servicio, más el botón deshabilitado y explicado en la interfaz |
| Se otorga un acceso y "no funciona" | Banner permanente sobre el reinicio de sesión (AC9) |
| Un otorgamiento múltiple queda a medias | Transacción única, todo o nada (D8, AC3) |
| Se pierde el historial de permisos | Revocación blanda (D4, AC5) |
| El rol da falsa sensación de granularidad | Documentado en la sección 4; la interfaz no promete control por rol |
| Escritura accidental en producción durante la QA | El paso 3 requiere confirmación explícita en el momento |
