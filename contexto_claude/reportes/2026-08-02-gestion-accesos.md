# Reporte de entrega — Gestión de accesos por sistema, rol y módulo

**Fecha:** 2026-08-02
**Rama:** `feat/fe02-sincronizacion`
**Estado:** código completo y revisado · **puesta en marcha y prueba de aceptación pendientes de vos**

---

## 1. El problema que resuelve

Hasta ahora los permisos de Bacherito se otorgaban escribiendo `INSERT` a mano en Oracle. Eso tenía
tres consecuencias que verifiqué contra la base de producción, en solo lectura:

**De los 4 usuarios registrados, solo vos podés iniciar sesión.** `RBAC_USUARIO_MODULO_ROL` tenía
3 filas, todas del usuario 21. Los usuarios 22, 23 y 24 están activos y no bloqueados, pero
`auth.service.js:122` los rechaza con `SIN_MODULOS_ASIGNADOS`.

**No se podía armar ninguna cuadrilla.** `grupo.repository.js:271` (`buscarTecnicos`) exige el rol
`TECNICO` en una fila activa de `RBAC_USUARIO_MODULO_ROL`. **Ningún usuario lo tenía**, así que el
buscador de técnicos de "Asignar Grupo" devolvía vacío siempre. Por eso no pudiste crear GRUPO_A ni
GRUPO_B: no era un defecto de esa pantalla, era la falta de esta.

**No había rastro de quién otorgó qué.** La columna `ASIGNADO_POR` existe, pero se llenaba con el
número que quien escribía el `INSERT` decidiera poner.

---

## 2. Qué se entregó

| SHA | Qué hace |
|---|---|
| `0c61fbd` | Spec de diseño |
| `50379a1` | Corrección de una contradicción del spec |
| `0e6fd20` | Plan de implementación |
| `7d54b36` | Corrección del contrato de `app-button` en el plan |
| `8badd2f` | Script SQL de alta del módulo `GESTIONAR_ACCESOS` |
| `79fe88d` | Backend: catálogo, búsqueda de usuarios y detalle de accesos |
| `330b666` | Backend: otorgar y revocar, con transacción y regla anti-autobloqueo |
| `b887f23` | Backend: controlador y rutas |
| `08a4f91` | Tolerancia a ORA-00001 y primeras pruebas reales del repositorio |
| `4bfad01` | Frontend: servicio y tipos |
| `7f20bb8` | Frontend: pantalla, ruta y entrada de menú |
| `ce3b271` | Frontend: accesos de un usuario (otorgar y revocar) |
| `f1ac4be` | Correcciones de la revisión del frontend |

---

## 3. Decisiones

| # | Decisión | Motivo |
|---|---|---|
| **D1** | La pantalla la protege un **módulo nuevo**, `GESTIONAR_ACCESOS` | Reutilizar `ASIGNAR_GRUPO` habría permitido que cualquiera que reparte trabajo se otorgue permisos a sí mismo. Es escalada de privilegios |
| **D2** | La unidad de otorgamiento es el par **(módulo, rol)** | Es lo que permite `UK_USUARIO_MODULO_ROL(ID_USUARIO, ID_MODULO, ID_ROL)`: un usuario puede tener el mismo módulo bajo dos roles distintos |
| **D3** | El sistema **no es un selector**; los módulos se agrupan bajo su sistema | `RBAC_MODULOS.ID_SISTEMA` ya establece la relación. Hoy se ve una sola sección; con un segundo sistema aparece sin tocar código |
| **D4** | Revocar pone `ESTADO='N'`; **no borra la fila** | Un `DELETE` destruye la evidencia de quién tuvo qué acceso. La vista ya filtra por `UMR.ESTADO='S'`, así que funciona sin modificarla |
| **D5** | Re-otorgar algo revocado **reactiva** la fila | Un `INSERT` chocaría contra la restricción única y daría un ORA-00001 incomprensible |
| **D6** | Nadie puede revocarse `GESTIONAR_ACCESOS` a sí mismo | Es la única puerta al módulo. Si el último administrador se la quita, **nadie puede devolvérsela desde la app** |
| **D7** | `FECHA_INICIO` y `FECHA_FIN` quedan en `NULL` | Nadie pidió accesos con vigencia |
| **D8** | El otorgamiento múltiple viaja en **un solo `POST` transaccional** | Si falla la tercera fila de tres, el usuario quedaría a medio configurar |
| **D9** | `ASIGNADO_POR` sale de `req.usuario.sub`, **nunca del cuerpo** | Para que una petición manipulada no pueda falsificar quién otorgó un permiso |

---

## 4. Contrato implementado

Los cinco endpoints llevan `requireAuth` + `requireModulo('GESTIONAR_ACCESOS')`.

| Método | Ruta | Devuelve |
|---|---|---|
| `GET` | `/api/accesos/catalogo` | `{ sistemas: [{ idSistema, nombre, modulos }], roles }` |
| `GET` | `/api/accesos/usuarios?q=` | Busca por cédula, nombre, apellido o correo |
| `GET` | `/api/accesos/usuarios/:id` | El usuario **+ sus accesos**, activos y revocados |
| `POST` | `/api/accesos/usuarios/:id` | `{ otorgamientos: [{ idModulo, idRol }] }` → `{ otorgados, reactivados }` |
| `DELETE` | `/api/accesos/usuarios/:id/modulos/:idModulo/roles/:idRol` | Revoca |

Códigos: **400** validación · **404** usuario o acceso inexistente · **409** intento de
auto-revocarse el módulo de gestión.

La pantalla vive en `/admin/accesos`, con entrada en el menú bajo **Administración**.

---

## 5. Verificación realizada

Todo lo siguiente lo ejecuté yo directamente después de cada tarea. **No acepté ningún número
del reporte de un subagente.**

```
backend:   Test Files  6 passed (6)     Tests  40 passed (40)
frontend:  Test Files 14 passed (14)    Tests  54 passed (54)
build:     0 errores
```

El backend pasó de 18 a 40 pruebas y el frontend de 49 a 54.

### Los tres puntos que podían fallar en silencio

**Atomicidad del otorgamiento múltiple.** Una sola conexión, `autoCommit: false` en cada
`execute`, `commit()` solo al final, `rollback()` ante cualquier fallo. Si falla la tercera fila de
tres, se revierten las dos anteriores. Lo comparé línea por línea contra el patrón preexistente de
`grupo.repository.js:asignarTareasMasivo`.

**Condición de carrera al otorgar.** La revisión encontró que dos peticiones simultáneas con el
mismo par nuevo —dos pestañas abiertas— pasaban ambas la comprobación previa y la segunda chocaba
contra la restricción única, devolviendo un 500 genérico. Se corrigió en `08a4f91`: el `INSERT`
tolera ORA-00001 y sigue, porque significa que otra transacción ya creó la fila. Cualquier otro
error sigue disparando `rollback()`.

**El repositorio no tenía ninguna prueba.** Los specs de servicio mockean el repositorio entero,
así que la lógica SQL de tres caminos (activa → saltar, revocada → reactivar, inexistente →
insertar) no se ejecutaba nunca. Se creó `accesos.repository.spec.js` mockeando `oracledb`, con 5
casos que incluyen el del ORA-00001 y el del error genérico que sí debe revertir.

**La confirmación de éxito no llegaba a verse.** La revisión del frontend encontró que al otorgar
un acceso el mensaje del servidor se escribía y se borraba dentro del mismo callback síncrono, así
que Angular nunca lo renderizaba: el administrador confirmaba la operación y no veía nada. Junto a
eso, un refresco fallido dejaba la lista vieja en pantalla al lado de un mensaje de error,
sugiriendo que el cambio no se había aplicado cuando sí. Ambos se corrigieron en `f1ac4be`.

Los dos defectos los indujo el plan de implementación, no los implementers. Es la tercera vez en
este proyecto que ocurre lo mismo: código que escribe estado sin verificar que ese estado llegue a
la pantalla. Queda anotado para los próximos ciclos.

### La regla anti-autobloqueo no está implementada de más

Hay dos pruebas que verifican lo contrario de lo obvio: que **sí** se puede revocar
`GESTIONAR_ACCESOS` a **otro** usuario, y que **sí** se puede uno revocarse a sí mismo **otro**
módulo. La regla prohíbe exactamente un caso, no todo lo que se le parezca.

---

## 6. Puesta en marcha — dos pasos tuyos, en este orden

> ⚠️ Sin estos dos pasos **la pantalla no es accesible ni siquiera para vos**. El módulo no existe
> todavía, y yo no puedo otorgármelo ni iniciar sesión en tu nombre.

**Paso 1.** Correr `database/gestionar_accesos_setup.sql` contra Oracle. Da de alta el módulo
`GESTIONAR_ACCESOS` y te lo otorga a vos (usuario 21) con rol ADMIN. Los ids de módulo y rol se
resuelven por subconsulta sobre el nombre, nunca quemados, porque `ID_MODULO` es columna de
identidad.

**Paso 2.** Cerrar sesión en la app y volver a entrar. Los módulos van embebidos en el JWT que se
firma en el login, y `TOKEN_EXPIRACION_MIN` es 5760 (4 días): tu token actual no contiene el módulo
nuevo, así que el guard te rebotaría. Por eso la pantalla muestra un aviso permanente sobre esto —
le va a pasar lo mismo a cada persona a la que le otorgues un acceso.

---

## 7. Prueba de aceptación — pendiente de tu autorización

> ⚠️ **Este paso escribe en la base de producción.** No lo ejecuté. Requiere que me lo autorices
> en el momento.

Una vez completados los pasos 1 y 2, la prueba que pediste: buscar `1801806074` (ID_USUARIO 22,
JORGE WASHINGTON RAMOS ESPINOZA, `titecnico28@ambato.gob.ec`) y otorgarle tres módulos, los tres
con rol **TECNICO** (`ID_ROL` 21):

| ID_MODULO | Módulo |
|---|---|
| 1 | `REPORTAR_BACHE` |
| 2 | `SEGUIMIENTO_BACHE` |
| 22 | `MIS_TAREAS` |

No se le otorga `ASIGNAR_GRUPO`(21): es un técnico, no un administrador.

**Se hace por la pantalla, no por SQL.** Eso ejercita el código que se construyó, que es lo que la
prueba tiene que validar. Un `INSERT` a mano no probaría nada.

### Verificación posterior, de solo lectura

```sql
SELECT * FROM GADMAPPS.RBAC_USUARIO_MODULO_ROL WHERE ID_USUARIO = 22;
-- Esperado: 3 filas, ID_MODULO 1/2/22, ID_ROL 21, ESTADO 'S', ASIGNADO_POR 21

SELECT SISTEMA, MODULO, ROL FROM GADMAPPS.VW_AUTORIZACION_USUARIOS WHERE ID_USUARIO = 22;
-- Esperado: 3 filas, SISTEMA 'BACHERITO', ROL 'TECNICO'
```

### Lo que esto destraba

Con el rol TECNICO ya asignado, el usuario 22 debería aparecer en `buscarTecnicos`, que hoy no
devuelve a nadie. Eso te permite finalmente crear **GRUPO_A** y **GRUPO_B**, pendiente desde el
ciclo anterior. A los usuarios 23 y 24 hay que otorgarles lo mismo para que puedan integrarlos.

---

## 8. Qué quedó fuera

| Ítem | Motivo |
|---|---|
| Crear, editar o borrar sistemas, roles o módulos | La pantalla **asigna** los que ya existen |
| Alta o baja de usuarios en `RBAC_USUARIOS` | Fuera de alcance |
| Accesos con vigencia (`FECHA_INICIO` / `FECHA_FIN`) | D7: nadie los pidió |
| **B1** (login Cognito), **B3** (`environment.prod.ts`), **B7** (`ESTADO: 'N'`) | Pausados |

### Dos limitaciones heredadas que este trabajo no arregla

**El rol todavía no decide nada.** `auth.middleware.js:27` (`requireModulo`) compara únicamente el
nombre del módulo, y `auth.service.ts:60` (`tieneAcceso`) hace lo mismo en el frontend. El rol se
guarda, viaja en el JWT y se muestra, pero **hoy ningún control de acceso lo consulta**. La única
excepción es `grupo.repository.js:271`, que filtra por `TECNICO` para armar cuadrillas.
Consecuencia práctica: otorgar `MIS_TAREAS` con rol VIEWER da hoy exactamente el mismo acceso que
otorgarlo con rol ADMIN. La pantalla no promete lo contrario, pero conviene saberlo antes de
diseñar permisos apoyándose en el rol.

**`error.middleware.js` siempre responde 500** e ignora `statusCode`. Por eso cada caso de negocio
se mapea a su código HTTP dentro del propio controlador. Arreglarlo tocaría todos los
controladores existentes; queda como candidato a una tarea propia.

El detalle tarea por tarea, con las revisiones y sus hallazgos, está en
`.superpowers/sdd/2026-08-02-gestion-accesos/progress.md`.
