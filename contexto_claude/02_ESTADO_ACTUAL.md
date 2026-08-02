# Bacherito App — Resumen Técnico de Estado

**Fecha:** 2026-07-31
**Repositorio:** `C:\Users\TITECNICO28\Desktop\bacherito_app`
**Rama:** `main` (último commit: `12aea3e SUBIR PROYECTO`)
**Entidad:** GAD Municipalidad de Ambato — esquema Oracle `GADMAPPS`

---

## 1. Arquitectura y Tecnologías

### 1.1 Estructura del monorepo

```
bacherito_app/
├── backend/      Node.js + Express 5 + OracleDB (arquitectura de 7 capas)
├── frontend/     Angular 22 (standalone + signals) + PWA
└── database/     Scripts SQL de setup (se entregan al DBA, no se ejecutan desde la app)
```

### 1.2 Backend

| Aspecto | Detalle |
|---|---|
| Runtime | Node.js, ESM (`"type": "module"`) |
| Framework | Express 5.2 |
| Base de datos | `oracledb` 7 con pool de conexiones (`src/config/database.js`) |
| Seguridad HTTP | `helmet`, `cors` global, `express-rate-limit` (20 req/15 min en auth y búsqueda de funcionarios) |
| Autenticación | `aws-jwt-verify` (verifica el ID Token de Cognito) + `jsonwebtoken` (emite JWT propio HS256) |
| Geoespacial | `proj4` (WGS84 → UTM zona 17S) |
| Archivos | `ssh2-sftp-client` (sube las fotos de los baches a un servidor SFTP) |
| Otros | `bcryptjs`, `dotenv`, `uuid` |
| Arranque | `npm run start` / `npm run dev` (nodemon), puerto 3000 |

**Capas (patrón estricto en todos los módulos):**

```
routes → controllers → services → repositories → models
         + middlewares/  (auth.middleware, error.middleware)
         + utils/        (bearer, cognito-verifier, coordenadas, imagen, sftp)
         + config/       (database.js — pool Oracle)
```

Módulos implementados con las 7 capas: `auth`, `funcionario`, `parroquia`, `requerimiento`, `grupo`, `mistarea`, `autorizacion`.

### 1.3 Frontend

| Aspecto | Detalle |
|---|---|
| Framework | Angular 22, componentes **standalone**, **signals**, rutas *lazy-loaded* |
| Estilos | Tailwind CSS 4 (`@tailwindcss/postcss`) + tokens de color propios (tema "Black and Gold Elegance", claro/oscuro) |
| UI | Angular Material / CDK, `material-icons` |
| Mapas | Leaflet 1.9 |
| Offline | Dexie 4 (IndexedDB, esquema en versión **v8**) |
| Auth cliente | `amazon-cognito-identity-js` 6 (flujo **SRP**, no `USER_PASSWORD_AUTH`) |
| PWA | `@angular/service-worker` + `ngsw-config.json` + `manifest.webmanifest` + set de íconos |
| Testing | `vitest` + `jsdom` (configurado, sin suite de pruebas escrita) |
| TypeScript | ~6.0 |

### 1.4 Flujo de autenticación (doble token)

```
1. Navegador → Cognito (SRP, amazon-cognito-identity-js) → ID Token
2. Frontend → POST /api/auth/login  (Authorization: Bearer <ID Token de Cognito>)
3. Backend:
   - verifica firma/emisor/audiencia del ID Token con aws-jwt-verify
   - exige que el claim cognito:groups contenga el satélite BACHERITO
   - busca el usuario por email en GADMAPPS (usuario.repository)
   - exige TIPO_USUARIO = 'F'  (solo funcionarios municipales)
   - exige estado activo y no bloqueado
   - exige ≥ 1 módulo asignado en RBAC (si no → SIN_MODULOS_ASIGNADOS)
   - lee la expiración de RBAC_SISTEMAS.TOKEN_EXPIRACION_MIN
   - firma un JWT propio HS256:
       { sub, email, tipoUsuario, modulos: [{ m: MODULO, r: ROL }], jti }
   - registra la sesión en RBAC_SESIONES y actualiza último acceso
4. Frontend guarda el JWT propio; auth.interceptor.ts lo adjunta a toda
   petición dirigida a environment.apiUrl
```

**Importante:** el App Client de Cognito **no** necesita `ALLOW_USER_PASSWORD_AUTH` para que la app real funcione (usa SRP). Ese flag solo hace falta para llamar `InitiateAuth` directamente desde Postman/curl.

### 1.5 RBAC

- **Módulos:** `REPORTAR_BACHE`, `SEGUIMIENTO_BACHE`, `ASIGNAR_GRUPO`, `MIS_TAREAS`
- **Roles:** `ADMIN`, `TECNICO`
- **Backend:** `requireAuth` (valida JWT propio) + `requireModulo('X')` (revisa el arreglo `modulos` embebido en el JWT — no vuelve a consultar la BD)
- **Frontend:** `authGuard` + `moduloGuard('X')` en las rutas; `AuthService.tieneAcceso(modulo)` para mostrar/ocultar UI
- **Fuente de verdad:** `V_AUTORIZACION_USUARIOS` sobre `RBAC_USUARIO_MODULO_ROL` / `RBAC_MODULOS` / `RBAC_ROLES`

### 1.6 Tablas Oracle involucradas

| Tabla / Vista | Uso |
|---|---|
| `GADMAPPS.OP_BACHERITO_REQ` | Baches reportados. Estados: `I` Ingresado, `E` En proceso, `R` Reasignado, `A` Atendido |
| `GADMAPPS.OP_BACHERITO_GRUPOS` | Cuadrillas de trabajo |
| `GADMAPPS.OP_BACHERITO_GRUPO_TECNICOS` | Técnicos asignados a cada grupo |
| `GADMAPPS.OP_BACHERITO_GRUPO_TAREAS` | Baches asignados a cada grupo. Estados: `I` Ingresado, `D` Descargado, `F` Finalizado |
| `GADMAPPS.PAR_PARROQUIAS` | Catálogo de parroquias |
| `GADMAPPS.RBAC_*` | Sistemas, módulos, roles, usuarios, autorizaciones, sesiones |
| Vista institucional de funcionarios | Validación por cédula al registrarse |

### 1.7 Convenciones del proyecto (críticas)

- **`COORDENADAX` = longitud**, **`COORDENADAY` = latitud** (contraintuitivo, pero es la convención establecida en toda la app).
- Las coordenadas viajan **crudas WGS84** desde el cliente; el backend calcula `X`/`Y` (UTM) y sube la foto al SFTP. El cliente nunca calcula UTM.
- Las fotos viajan en **base64 dentro del JSON** (por eso `express.json({ limit: '10mb' })`).

### 1.8 Almacenamiento offline (Dexie — `BacheritoOfflineDB`, v8)

| Tabla | Contenido |
|---|---|
| `parroquiasOff` | Catálogo de parroquias cacheado |
| `reportesOff` | Cola de baches reportados sin conexión (`SINCRONIZADO` 0/1) |
| `tareasTecnicoOff` | Copia local de las tareas del técnico para trabajar sin conexión |

`ConnectionService.isOnline()` es un *signal* alimentado por los eventos `online`/`offline` del navegador. `ReporteService` tiene un `effect()` que dispara `SyncService.sincronizarReportesPendientes()` cada vez que se recupera la conexión.

---

## 2. Estado Actual — Implementado y Funcionando

### 2.1 Endpoints del backend

| Método | Ruta | Protección | Estado |
|---|---|---|---|
| `GET` | `/api/parroquias` | Pública | ✅ |
| `GET` | `/api/funcionarios/buscar` | Rate-limit | ✅ |
| `POST` | `/api/auth/registro-cognito` | Rate-limit | ✅ |
| `POST` | `/api/auth/login` | Rate-limit | ✅ |
| `POST` | `/api/auth/logout` | — | ✅ |
| `POST` | `/api/requerimientos` | `REPORTAR_BACHE` | ✅ |
| `GET` | `/api/grupos` | `ASIGNAR_GRUPO` | ✅ |
| `GET` | `/api/grupos/resumen` | `ASIGNAR_GRUPO` | ✅ |
| `GET` | `/api/grupos/mapa` | `ASIGNAR_GRUPO` | ✅ |
| `GET` | `/api/grupos/tecnicos` | `ASIGNAR_GRUPO` | ✅ |
| `POST` | `/api/grupos` | `ASIGNAR_GRUPO` | ✅ |
| `GET` | `/api/grupos/:id` | `ASIGNAR_GRUPO` | ✅ |
| `GET` | `/api/grupos/:id/baches-disponibles` | `ASIGNAR_GRUPO` | ✅ |
| `POST` / `DELETE` | `/api/grupos/:id/tareas[...]` | `ASIGNAR_GRUPO` | ✅ |
| `POST` / `DELETE` | `/api/grupos/:id/tecnicos[...]` | `ASIGNAR_GRUPO` | ✅ |
| `GET` | `/api/mis-tareas` | `MIS_TAREAS` | ✅ |
| `POST` | `/api/mis-tareas/marcar-descargado` | `MIS_TAREAS` | ✅ |
| `PATCH` | `/api/mis-tareas/:id/atender` | `MIS_TAREAS` | ✅ |

### 2.2 Funcionalidades verificadas end-to-end

**Autenticación y registro**
- Registro vía Cognito con validación obligatoria contra la vista institucional de funcionarios (rechaza a quien no sea funcionario municipal).
- Idempotencia en el registro (reintentos del cliente no fallan).
- Login con emisión de JWT propio, registro de sesión y logout con revocación.
- Guardas de ruta y de módulo funcionando en frontend y backend.

**Reportar bache (ciudadano/funcionario)**
- Mapa Leaflet con selección de punto y botón "Usar mi ubicación".
- Foto por cámara/galería → base64 → SFTP en el servidor.
- Guardado **online** confirmado contra la tabla real `GADMAPPS.OP_BACHERITO_REQ` (verificado con consultas directas a la BD de producción).
- Guardado **offline** en `reportesOff` + sincronización automática al recuperar conexión (verificado con filas reales creadas en la BD).
- **Popup unificado de confirmación** online/offline: mismo componente, texto y badge de estado que cambian según el caso ("Tu bache ha sido reportado de manera online / offline", "Sincronizado" vs "Pendiente de sincronizar").

**Compartir mi ubicación**
- `UbicacionService` (signal + `effect()` que persiste en `localStorage`, clave `bacherito-compartir-ubicacion`), apagado por defecto.
- Toggle visible en **Perfil** (pantalla común a admin y técnico), junto al toggle de tema.
- Cuando está activo, el mapa de "Reportar un bache" se centra automáticamente en la ubicación GPS al inicializarse.

**Panel de administrador**
- Resumen de grupos con barras de progreso.
- Crear grupos, asignar/quitar baches, agregar/quitar técnicos (con filtro real por rol `TECNICO`).
- Mapa administrativo de baches.
- Filtro Todo/Parroquia en baches disponibles.

**Panel de técnico ("Mis Tareas")**
- Resumen en vivo desde el servidor al iniciar sesión (total / atendidas / pendientes de descarga).
- Botón "Descargar Tareas" que baja las tareas a IndexedDB y marca las asignaciones como `D` en el servidor (el botón desaparece hasta que haya asignación nueva).
- Pantalla "Mis Tareas" con listado y estados.
- Mapa de seguimiento alimentado por `tareasTecnicoOff` (o en vivo si hay conexión).
- Cambio de estado del bache (`A` Atendido / `E` En proceso) contra el endpoint real, con validación de pertenencia en el backend (un técnico no puede atender un bache de otro grupo → 403).

**PWA**
- Instalable, con service worker configurado, manifiesto e íconos generados. Verificada la instalabilidad en navegador con build de producción.

**Calidad**
- Se completaron pasadas de revisión de código en 5 ejes, revisión de seguridad, auditoría de código muerto y varias pasadas de QA manual en navegador (126 tareas cerradas en el gestor de tareas de la sesión).

---

## 3. Bugs, Pendientes y Componentes Incompletos

### 🔴 Bloqueante

**B1. Login con Cognito falla para el usuario de pruebas — `NotAuthorizedException`**
- Usuario: `gcastillo@ambato.gob.ec`, contraseña `Ambato2026.` (con punto final).
- Síntoma: Cognito responde `Incorrect username or password`; no se genera JWT propio y `localStorage` queda sin token, por lo que `GET /api/requerimientos` y demás llamadas fallan con 401.
- **Descartado ya:** no es un bug del frontend. Se leyeron los valores reales de los `<input>` en el DOM en vivo y se confirmó que se envían exactamente `Ambato2026.` (11 caracteres) sin espacios ni corrupción. El User Pool `us-east-2_N9vEv3kzl` fue confirmado por el usuario.
- **Hipótesis pendiente de confirmar:** en la consola de AWS se usó "Reset password" (que *no* permite fijar un valor concreto: invalida la clave y obliga a un flujo de código de recuperación) en lugar de "Set password" con la casilla **"Set as permanent"**, que es la única acción que asigna una contraseña conocida sin exigir cambio en el siguiente inicio de sesión.
- **Estado: PAUSADO por instrucción explícita del usuario** — *"No realices ningún cambio, vamos a corregir otras cosas primero"*. No se debe tocar hasta nueva orden.

### 🟠 Alta

**B2. Coordenadas UTM invertidas en `backend/src/utils/coordenadas.util.js`**
- La función se declara `convertirAUtm(lat, lon)` pero se la invoca desde `requerimiento.repository.js` como `convertirAUtm(data.coordenadaX, data.coordenadaY)` — es decir, recibe **(longitud, latitud)**. Internamente vuelve a invertir el orden al pasar `[longitud, latitud]` a `proj4`, con lo que el resultado neto es un intercambio.
- **Verificado con datos reales:** las filas 57, 58 y 59 (`COORDENADAX=-78.62722`, `COORDENADAY=-1.24908`) quedaron guardadas con `X=1757087.44`, `Y=230846.94`, cuando los valores correctos para Ambato en UTM 17S rondan `X≈763.000`, `Y≈9.862.000`.
- **Alcance:** afecta a las columnas `X`/`Y` de **todos** los reportes creados por esta vía. **No** afecta al mapa de la app, que usa `COORDENADAX`/`COORDENADAY` directamente.
- **Estado:** identificado y reportado, **corrección no autorizada aún**.

### 🟡 Media

**B3. `environment.prod.ts` con URL de API de marcador de posición**
- `apiUrl: 'https://tu-api.municipal.com/api'`. Cualquier `ng build --configuration production` apuntaría a ese dominio inexistente (confirmado vía `fileReplacements` en `angular.json`).
- El usuario confirmó que **aún no existe backend desplegado**, por lo que se dejó intencionalmente así. Debe corregirse antes del primer despliegue real.

**B4. Cambio de estado offline en "Mis Tareas" no se re-sincroniza**
- Documentado en el propio código (`mis-tareas.service.ts`, método `cambiarEstado`): al simplificar el esquema de `tareasTecnicoOff` se eliminó el campo "pendiente de subir", así que si el técnico cambia el estado de un bache sin conexión, el cambio **solo actualiza la vista local y nunca se reenvía al servidor** al reconectar.
- Nota: el plan original (`unified-enchanting-conway.md`) sí contemplaba `atendidoPendienteSubir` + `subirPendientes()`; esa parte quedó fuera de la implementación final.

**B5. Filas de prueba en la base de datos de producción**
- Los registros con `ID` 57, 58 y 59 de `GADMAPPS.OP_BACHERITO_REQ` son reportes de prueba generados durante QA. **Pendiente de decisión del usuario** sobre si eliminarlos.

**B6. `USER_PASSWORD_AUTH` no habilitado en el App Client**
- El App Client `75g27vfgbofs93mqvh4ss18qdc` devuelve `InvalidParameterException: USER_PASSWORD_AUTH flow not enabled for this client`.
- **Solo afecta a pruebas desde Postman/curl.** La app real usa SRP y no lo necesita. Baja prioridad.

### 🟢 Baja

**B7. Campo `ESTADO: 'N'` obsoleto en `ReporteOffline`**
- `reporte.service.ts` asigna `ESTADO: 'N'` al registro local de Dexie, pero `'N'` no pertenece al vocabulario real (`I`/`E`/`R`/`A` según `estado-bache.util.ts`), no se envía al backend (`reporteOfflineAPayload` no lo incluye) y el repositorio inserta `'I'` fijo. Es un campo muerto que puede confundir; conviene retirarlo o alinearlo a `'I'`.

**B8. Sin suite de pruebas automatizadas**
- `npm test` del backend es un stub (`echo "Error: no test specified"`). El frontend tiene `vitest` + `jsdom` instalados y configurados pero **sin pruebas escritas**. Toda la verificación hasta ahora ha sido manual (navegador + consultas SQL directas).

**B9. Trabajo sin commitear**
- `git status` muestra ~40 archivos modificados o sin rastrear desde el commit `12aea3e SUBIR PROYECTO`. **Todos los módulos nuevos** (grupo, mistarea, autorizacion, middlewares de auth, utils de SFTP/imagen/coordenadas, y los 9 scripts SQL de `database/`) están **sin versionar**. Riesgo real de pérdida de trabajo.

---

## 4. Instrucciones y Dependencias Clave de la Sesión

### 4.1 Instrucciones permanentes del usuario

1. **Todo en español.** Instrucción explícita y vigente: *"de ahora en adelante todo en español"*. Aplica a respuestas, explicaciones y comentarios.
2. **No tocar el hilo de Cognito/login** hasta que el usuario lo indique: *"No realices ningún cambio, vamos a corregir otras cosas primero"*.
3. **No corregir B2 (UTM) ni borrar las filas 57/58/59** sin confirmación explícita. Ambos fueron ofrecidos pero nunca aprobados.
4. **Los scripts SQL se entregan, no se ejecutan.** La convención del proyecto es escribir el `.sql` en `database/` y que el usuario lo corra contra Oracle.

### 4.2 Entorno de trabajo

| Recurso | Valor |
|---|---|
| Backend local | `http://localhost:3000` (`npm run start` desde `backend/`) |
| Frontend local | `http://localhost:4200` (`ng serve` desde `frontend/`) |
| Base de datos | Oracle de **producción** `10.10.0.122:1521/PRD`, esquema `GADMAPPS` |
| Cognito | Región `us-east-2`, Pool `us-east-2_N9vEv3kzl`, Client `75g27vfgbofs93mqvh4ss18qdc`, satélite/grupo `BACHERITO` |

> ⚠️ **La base de datos es la de producción real.** Toda consulta debe ser de solo lectura salvo autorización expresa.

### 4.3 Variables de entorno requeridas (`backend/.env`)

```
PORT, DB_USER, DB_PASSWORD, DB_CONNECTION_STRING, JWT_SECRET, SISTEMA_NOMBRE,
COGNITO_REGION, COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, COGNITO_CLIENT_SECRET,
SFTP_HOST, SFTP_PORT, SFTP_USER, SFTP_PASSWORD, SFTP_REMOTE_DIR, SFTP_PUBLIC_URL_BASE
```

### 4.4 Usuarios conocidos para pruebas

| ID | Nombre | Correo | Rol |
|---|---|---|---|
| 3 | Marcelo Fernando | `titecnico28@ambato.gob.ec` | ADMIN |
| 16 | Enrique Sebastián | `titecnico27@ambato.gob.ec` | TECNICO |
| 19 | Galo Geovanny | `gcastillo@ambato.gob.ec` | TECNICO (login fallando — ver B1) |

### 4.5 Técnicas de depuración establecidas

**JWT forjado para pruebas rápidas de API** (evita depender del login de Cognito):
firmar con el `JWT_SECRET` del `.env` usando `jsonwebtoken`, con la forma de payload
`{ sub: idUsuario, email, modulos: [{ m: 'NOMBRE_MODULO', r: 'NOMBRE_ROL' }] }`.
Es exactamente lo que espera `requireAuth` / `requireModulo`.

**Consultas de diagnóstico a Oracle:** crear un `.cjs` temporal dentro de `backend/` (para que herede el `.env` y las dependencias), ejecutarlo una vez y **borrarlo de inmediato**.

**Simular modo offline en el navegador:** no basta con `window.dispatchEvent(new Event('offline'))`. Hay que además sobrescribir
`Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })`
**sin recargar la página**, y navegar solo mediante clics dentro de la SPA. Una recarga completa reinicia todos los *signals* de Angular y restaura el valor real de `navigator.onLine`.

**Cuidado al detener el backend:** `reporte.service.ts` captura los errores del POST y guarda en IndexedDB de forma transparente. Si el backend está caído, un reporte "online" se guarda localmente **sin avisar claramente al usuario** — esta fue la causa real de un falso positivo reportado como "el reporte online no llegó a la base".

### 4.6 Scripts SQL en `database/` (todos sin versionar)

```
creacion_usuarios.sql            rbac_funcionarios_setup.sql
autorizacion_usuarios.sql        modulos_ruta_base_setup.sql
grupo_tareas_setup.sql           grupo_tareas_estado_setup.sql
grupo_sin_parroquia_setup.sql    mis_tareas_setup.sql
agregar_tecnico_setup.sql
```

---

## 5. Recomendación de Orden de Trabajo para la Siguiente Sesión

1. **Commitear el trabajo pendiente** (B9) — es el riesgo más alto y el de resolución más barata.
2. Esperar la indicación del usuario sobre cuáles son las *"otras cosas"* que quiere corregir.
3. Retomar B1 (login de Cognito) cuando el usuario lo autorice.
4. Decidir sobre B2 (UTM) y B5 (filas de prueba) — ambos esperan únicamente un sí/no.
