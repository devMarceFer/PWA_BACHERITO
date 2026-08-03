# Plan de implementación — Gestión de accesos por sistema, rol y módulo

> **Para agentes:** SUB-SKILL OBLIGATORIA: usá superpowers:subagent-driven-development (recomendado)
> o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan
> casillas (`- [ ]`) para seguimiento.

**Objetivo:** una pantalla `/admin/accesos` que permita otorgar y revocar pares (módulo, rol) sobre
`GADMAPPS.RBAC_USUARIO_MODULO_ROL`, sin escribir `INSERT` a mano en Oracle.

**Arquitectura:** backend en las 7 capas del proyecto (`routes → controllers → services →
repositories → models`), protegido por un módulo nuevo `GESTIONAR_ACCESOS`. Frontend Angular 22
standalone con signals, partido en dos componentes: uno busca usuarios, el otro administra los
accesos de uno. La vista `GADMAPPS.VW_AUTORIZACION_USUARIOS` **no se modifica**.

**Stack:** Node 22 + Express 5 + oracledb 7 (ESM) · Angular 22 + Tailwind 4 + Angular Material
Icons · Vitest en ambos lados.

**Spec:** `docs/superpowers/specs/2026-08-02-gestion-accesos-design.md`

---

## Restricciones globales

Aplican a **todas** las tareas. No repetirlas en cada una no significa que no rijan.

1. **La base de datos es la de producción real** (`10.10.0.122:1521/PRD`, esquema `GADMAPPS`).
   Toda consulta debe ser de **solo lectura** salvo autorización expresa del usuario.
2. **Los scripts SQL se entregan, no se ejecutan.** Se escriben en `database/` y los corre el
   usuario.
3. **Todo en español**: código, comentarios, textos de interfaz, mensajes de commit, reportes.
4. **Higiene de git**: nunca `git add -A`, `git add .` ni `git commit -a`. Agregar **solo** los
   archivos de la tarea, uno por uno. `contexto_claude/` y `.claude/launch.json` tienen cambios
   sin commitear del usuario: **no tocarlos**.
5. **Nunca afirmar que algo se verificó sin haberlo ejecutado.** Si un comando no se corrió, se
   dice. En ciclos anteriores hubo tres afirmaciones falsas de verificación y todas se detectaron.
6. `ID_UMR`, `ID_MODULO`, `ID_ROL`, `ID_SISTEMA`, `ID_USUARIO` son columnas **de identidad**:
   ningún `INSERT` fija su valor.
7. `ASIGNADO_POR` sale **siempre** de `req.usuario.sub`, nunca del cuerpo de la petición.
8. El middleware global `error.middleware.js` **siempre responde 500 e ignora `statusCode`**. Cada
   caso de negocio se mapea a su HTTP **dentro del controlador**, antes de `next(error)`.
9. Los servicios lanzan centinelas de texto (`VALIDACION_FALLIDA: ...`, `USUARIO_NO_ENCONTRADO`,
   `MODULO_O_ROL_INVALIDO`, `ACCESO_NO_ENCONTRADO`, `AUTO_REVOCACION_PROHIBIDA`).
10. Suites de referencia al iniciar: **backend 18/18, frontend 49/49, build 0 errores**. Ninguna
    tarea puede dejarlas en rojo.

---

## Estructura de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `database/gestionar_accesos_setup.sql` | Alta del módulo y del acceso inicial del administrador | 1 |
| `backend/src/models/acceso.model.js` | Mapeo fila Oracle → forma del cliente, y validaciones | 2 |
| `backend/src/repositories/accesos.repository.js` | Todo el SQL. Nada de reglas de negocio | 2, 3 |
| `backend/src/services/accesos.service.js` | Reglas D4, D5, D6, D8, D9 y validaciones | 2, 3 |
| `backend/src/services/accesos.consulta.service.spec.js` | Pruebas de catálogo, búsqueda y detalle | 2 |
| `backend/src/services/accesos.escritura.service.spec.js` | Pruebas de otorgar y revocar | 3 |
| `backend/src/controllers/accesos.controller.js` | Traducción centinela → HTTP | 4 |
| `backend/src/routes/accesos.routes.js` | Rutas + `requireAuth` + `requireModulo` | 4 |
| `backend/src/app.js` | Registrar el router nuevo | 4 |
| `frontend/.../admin/accesos/accesos.service.ts` | Único que habla con `HttpClient` | 5 |
| `frontend/.../admin/accesos/accesos.service.spec.ts` | Pruebas de método, URL y cuerpo | 5 |
| `frontend/.../admin/accesos/accesos.ts` + `.html` | Buscar y seleccionar usuario. Nada más | 6 |
| `frontend/src/app/app.routes.ts` | Ruta `/admin/accesos` | 6 |
| `frontend/.../navigation_drawer.component.ts` + `.html` | Entrada de menú | 6 |
| `frontend/.../admin/accesos/accesos-usuario.ts` + `.html` | Accesos de **un** usuario | 7 |
| `contexto_claude/reportes/2026-08-02-gestion-accesos.md` | Reporte de entrega | 8 |

Se parte en dos componentes desde el inicio porque en `grupo-detalle.ts` la revisión anotó como
pendiente que el archivo llegó a 330 líneas con tres bloques de responsabilidad.

---

## Tarea 1: Script SQL de alta del módulo

**Archivos:**
- Crear: `database/gestionar_accesos_setup.sql`

**Interfaces:**
- Consume: nada.
- Produce: el módulo `GESTIONAR_ACCESOS` en `RBAC_MODULOS` (id asignado por identidad, se resuelve
  siempre por `NOMBRE`) y la fila que se lo otorga al usuario 21 con rol ADMIN.

> **Este script NO se ejecuta.** Se entrega y lo corre el usuario. Es el paso 1 de la sección 9 del
> spec y bloquea la QA de las tareas 6 y 7, no su implementación.

- [ ] **Paso 1: Escribir el script**

```sql
-- =====================================================================
-- Alta del módulo GESTIONAR_ACCESOS y del acceso inicial del administrador.
--
-- Ejecutar con el usuario GADMAPPS o uno con privilegios equivalentes.
--
-- Después de correrlo hay que CERRAR SESIÓN Y VOLVER A ENTRAR en la app:
-- los módulos viajan dentro del JWT que se firma en el login, así que un
-- token ya emitido no contiene el módulo nuevo y el guard rebota.
-- =====================================================================

-- 1) El módulo. ID_MODULO es columna de identidad: no se fija su valor.
INSERT INTO GADMAPPS.RBAC_MODULOS (ID_SISTEMA, NOMBRE, DESCRIPCION, RUTA_BASE)
VALUES (1, 'GESTIONAR_ACCESOS', 'Gestión de accesos por sistema, rol y módulo', '/admin/accesos');

-- 2) Acceso del administrador actual (ID_USUARIO 21, marcelofrobayo@gmail.com).
--    Los ids de módulo y rol se resuelven por subconsulta sobre NOMBRE, nunca quemados.
INSERT INTO GADMAPPS.RBAC_USUARIO_MODULO_ROL (ID_USUARIO, ID_MODULO, ID_ROL, ASIGNADO_POR)
VALUES (21,
        (SELECT ID_MODULO FROM GADMAPPS.RBAC_MODULOS WHERE NOMBRE = 'GESTIONAR_ACCESOS' AND ID_SISTEMA = 1),
        (SELECT ID_ROL    FROM GADMAPPS.RBAC_ROLES   WHERE NOMBRE = 'ADMIN'),
        21);

COMMIT;

-- Verificación posterior (debe devolver 1 fila con SISTEMA='BACHERITO', ROL='ADMIN'):
-- SELECT SISTEMA, MODULO, ROL FROM GADMAPPS.VW_AUTORIZACION_USUARIOS
-- WHERE ID_USUARIO = 21 AND MODULO = 'GESTIONAR_ACCESOS';
```

- [ ] **Paso 2: Verificar que NO se ejecutó nada**

No corras este SQL. Confirmá que no existe ningún script `.cjs`/`.mjs` temporal en `backend/`
que lo pudiera haber ejecutado: `ls backend/*.cjs backend/*.mjs 2>/dev/null` debe salir vacío.

- [ ] **Paso 3: Commit**

```bash
git add database/gestionar_accesos_setup.sql
git commit -m "feat: script de alta del modulo GESTIONAR_ACCESOS"
```

---

## Tarea 2: Backend — catálogo, búsqueda y detalle (solo lectura)

**Archivos:**
- Crear: `backend/src/models/acceso.model.js`
- Crear: `backend/src/repositories/accesos.repository.js`
- Crear: `backend/src/services/accesos.service.js`
- Crear: `backend/src/services/accesos.consulta.service.spec.js`

**Interfaces:**
- Consume: nada de tareas anteriores.
- Produce, para las tareas 3 y 4:
  - `accesosRepository.findSistemasConModulos()` → filas `{ ID_SISTEMA, SISTEMA, ID_MODULO, MODULO, DESCRIPCION }`
  - `accesosRepository.findRoles()` → filas `{ ID_ROL, NOMBRE }`
  - `accesosRepository.buscarUsuarios(q)` → filas `{ ID_USUARIO, NOMBRE, APELLIDO, NUM_DOCUMENTO, EMAIL, ESTADO, BLOQUEADO, TOTAL_ACCESOS_ACTIVOS }`
  - `accesosRepository.findUsuarioPorId(idUsuario)` → mismas columnas, 0 o 1 fila
  - `accesosRepository.findAccesosDeUsuario(idUsuario)` → filas `{ ID_UMR, ID_SISTEMA, SISTEMA, ID_MODULO, MODULO, ID_ROL, ROL, ESTADO, CREADO_EN }`
  - `accesosService.obtenerCatalogo()` → `{ sistemas: [{ idSistema, nombre, modulos: [{ idModulo, nombre, descripcion }] }], roles: [{ idRol, nombre }] }`
  - `accesosService.buscarUsuarios(q)` → `UsuarioAccesoModel[]`
  - `accesosService.obtenerDetalleUsuario(idUsuario)` → `{ usuario, accesos }`
  - Modelos exportados: `SistemaCatalogoModel`, `RolModel`, `UsuarioAccesoModel`, `AccesoModel`

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `backend/src/services/accesos.consulta.service.spec.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// El servicio importa el repositorio como módulo por defecto; se sustituye entero
// para probar las reglas sin tocar Oracle.
vi.mock('../repositories/accesos.repository.js', () => ({
  default: {
    findSistemasConModulos: vi.fn(),
    findRoles: vi.fn(),
    buscarUsuarios: vi.fn(),
    findUsuarioPorId: vi.fn(),
    findAccesosDeUsuario: vi.fn()
  }
}));

const accesosRepository = (await import('../repositories/accesos.repository.js')).default;
const accesosService = (await import('./accesos.service.js')).default;

describe('AccesosService · consultas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('obtenerCatalogo', () => {
    it('agrupa los modulos bajo su sistema', async () => {
      accesosRepository.findSistemasConModulos.mockResolvedValue([
        { ID_SISTEMA: 1, SISTEMA: 'BACHERITO', ID_MODULO: 1, MODULO: 'REPORTAR_BACHE', DESCRIPCION: 'Reportar' },
        { ID_SISTEMA: 1, SISTEMA: 'BACHERITO', ID_MODULO: 2, MODULO: 'SEGUIMIENTO_BACHE', DESCRIPCION: 'Seguir' }
      ]);
      accesosRepository.findRoles.mockResolvedValue([{ ID_ROL: 21, NOMBRE: 'TECNICO' }]);

      const catalogo = await accesosService.obtenerCatalogo();

      expect(catalogo.sistemas).toEqual([
        {
          idSistema: 1,
          nombre: 'BACHERITO',
          modulos: [
            { idModulo: 1, nombre: 'REPORTAR_BACHE', descripcion: 'Reportar' },
            { idModulo: 2, nombre: 'SEGUIMIENTO_BACHE', descripcion: 'Seguir' }
          ]
        }
      ]);
      expect(catalogo.roles).toEqual([{ idRol: 21, nombre: 'TECNICO' }]);
    });

    it('separa los modulos de sistemas distintos', async () => {
      accesosRepository.findSistemasConModulos.mockResolvedValue([
        { ID_SISTEMA: 1, SISTEMA: 'BACHERITO', ID_MODULO: 1, MODULO: 'REPORTAR_BACHE', DESCRIPCION: null },
        { ID_SISTEMA: 2, SISTEMA: 'OTRO', ID_MODULO: 9, MODULO: 'ALGO', DESCRIPCION: null }
      ]);
      accesosRepository.findRoles.mockResolvedValue([]);

      const catalogo = await accesosService.obtenerCatalogo();

      expect(catalogo.sistemas).toHaveLength(2);
      expect(catalogo.sistemas[1].modulos).toEqual([{ idModulo: 9, nombre: 'ALGO', descripcion: null }]);
    });
  });

  describe('buscarUsuarios', () => {
    it('rechaza una busqueda vacia sin tocar el repositorio', async () => {
      await expect(accesosService.buscarUsuarios('   ')).rejects.toThrow(/VALIDACION_FALLIDA/);
      expect(accesosRepository.buscarUsuarios).not.toHaveBeenCalled();
    });

    it('devuelve tambien a quien no tiene ningun acceso', async () => {
      accesosRepository.buscarUsuarios.mockResolvedValue([
        {
          ID_USUARIO: 22, NOMBRE: 'JORGE WASHINGTON', APELLIDO: 'RAMOS ESPINOZA',
          NUM_DOCUMENTO: '1801806074', EMAIL: 'titecnico28@ambato.gob.ec',
          ESTADO: 'S', BLOQUEADO: 0, TOTAL_ACCESOS_ACTIVOS: 0
        }
      ]);

      const resultado = await accesosService.buscarUsuarios('1801806074');

      expect(accesosRepository.buscarUsuarios).toHaveBeenCalledWith('1801806074');
      expect(resultado).toEqual([
        {
          idUsuario: 22, nombre: 'JORGE WASHINGTON', apellido: 'RAMOS ESPINOZA',
          numDocumento: '1801806074', email: 'titecnico28@ambato.gob.ec',
          estado: 'S', bloqueado: 0, totalAccesosActivos: 0
        }
      ]);
    });
  });

  describe('obtenerDetalleUsuario', () => {
    it('lanza USUARIO_NO_ENCONTRADO si no existe', async () => {
      accesosRepository.findUsuarioPorId.mockResolvedValue([]);
      await expect(accesosService.obtenerDetalleUsuario(999)).rejects.toThrow('USUARIO_NO_ENCONTRADO');
      expect(accesosRepository.findAccesosDeUsuario).not.toHaveBeenCalled();
    });

    it('devuelve accesos activos y revocados', async () => {
      accesosRepository.findUsuarioPorId.mockResolvedValue([
        {
          ID_USUARIO: 22, NOMBRE: 'JORGE', APELLIDO: 'RAMOS', NUM_DOCUMENTO: '1801806074',
          EMAIL: 'j@a.gob.ec', ESTADO: 'S', BLOQUEADO: 0, TOTAL_ACCESOS_ACTIVOS: 1
        }
      ]);
      accesosRepository.findAccesosDeUsuario.mockResolvedValue([
        { ID_UMR: 70, ID_SISTEMA: 1, SISTEMA: 'BACHERITO', ID_MODULO: 1, MODULO: 'REPORTAR_BACHE', ID_ROL: 21, ROL: 'TECNICO', ESTADO: 'S', CREADO_EN: '2026-08-02' },
        { ID_UMR: 71, ID_SISTEMA: 1, SISTEMA: 'BACHERITO', ID_MODULO: 2, MODULO: 'SEGUIMIENTO_BACHE', ID_ROL: 21, ROL: 'TECNICO', ESTADO: 'N', CREADO_EN: '2026-08-01' }
      ]);

      const detalle = await accesosService.obtenerDetalleUsuario(22);

      expect(detalle.usuario.idUsuario).toBe(22);
      expect(detalle.accesos).toHaveLength(2);
      expect(detalle.accesos[0]).toEqual({
        idUmr: 70, idSistema: 1, sistema: 'BACHERITO', idModulo: 1, modulo: 'REPORTAR_BACHE',
        idRol: 21, rol: 'TECNICO', estado: 'S', creadoEn: '2026-08-02'
      });
      expect(detalle.accesos[1].estado).toBe('N');
    });
  });
});
```

- [ ] **Paso 2: Correr la prueba y verificar que falla**

```bash
npm test --prefix backend
```

Esperado: FALLA con `Cannot find module '../repositories/accesos.repository.js'`.

- [ ] **Paso 3: Escribir los modelos**

Crear `backend/src/models/acceso.model.js`:

```js
// Agrupa las filas planas de la consulta de catálogo (un renglón por módulo, con las
// columnas del sistema repetidas) en la forma anidada que consume el frontend.
export class SistemaCatalogoModel {
    static fromDatabaseArray(rows) {
        const porSistema = new Map();

        for (const row of rows) {
            if (!porSistema.has(row.ID_SISTEMA)) {
                porSistema.set(row.ID_SISTEMA, {
                    idSistema: row.ID_SISTEMA,
                    nombre: row.SISTEMA,
                    modulos: []
                });
            }
            porSistema.get(row.ID_SISTEMA).modulos.push({
                idModulo: row.ID_MODULO,
                nombre: row.MODULO,
                descripcion: row.DESCRIPCION
            });
        }

        return Array.from(porSistema.values());
    }
}

export class RolModel {
    constructor(dbRow) {
        this.idRol = dbRow.ID_ROL;
        this.nombre = dbRow.NOMBRE;
    }

    static fromDatabaseArray(rows) {
        return rows.map(row => new RolModel(row));
    }
}

export class UsuarioAccesoModel {
    constructor(dbRow) {
        this.idUsuario = dbRow.ID_USUARIO;
        this.nombre = dbRow.NOMBRE;
        this.apellido = dbRow.APELLIDO;
        this.numDocumento = dbRow.NUM_DOCUMENTO;
        this.email = dbRow.EMAIL;
        this.estado = dbRow.ESTADO;
        this.bloqueado = dbRow.BLOQUEADO;
        this.totalAccesosActivos = dbRow.TOTAL_ACCESOS_ACTIVOS;
    }

    static fromDatabaseArray(rows) {
        return rows.map(row => new UsuarioAccesoModel(row));
    }
}

export class AccesoModel {
    constructor(dbRow) {
        this.idUmr = dbRow.ID_UMR;
        this.idSistema = dbRow.ID_SISTEMA;
        this.sistema = dbRow.SISTEMA;
        this.idModulo = dbRow.ID_MODULO;
        this.modulo = dbRow.MODULO;
        this.idRol = dbRow.ID_ROL;
        this.rol = dbRow.ROL;
        this.estado = dbRow.ESTADO;
        this.creadoEn = dbRow.CREADO_EN;
    }

    static fromDatabaseArray(rows) {
        return rows.map(row => new AccesoModel(row));
    }
}
```

- [ ] **Paso 4: Escribir el repositorio (solo lectura)**

Crear `backend/src/repositories/accesos.repository.js`:

```js
import oracledb from 'oracledb';

class AccesosRepository {
    // Solo sistemas y módulos activos: un módulo dado de baja no debe poder otorgarse.
    async findSistemasConModulos() {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const result = await connection.execute(`
                SELECT s.ID_SISTEMA, s.NOMBRE AS SISTEMA,
                       m.ID_MODULO, m.NOMBRE AS MODULO, m.DESCRIPCION
                FROM GADMAPPS.RBAC_SISTEMAS s
                JOIN GADMAPPS.RBAC_MODULOS m ON m.ID_SISTEMA = s.ID_SISTEMA
                WHERE s.ESTADO = 'S' AND m.ESTADO = 'S'
                ORDER BY s.NOMBRE, m.NOMBRE
            `);
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }

    async findRoles() {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const result = await connection.execute(`
                SELECT ID_ROL, NOMBRE FROM GADMAPPS.RBAC_ROLES
                WHERE ESTADO = 'S' ORDER BY NOMBRE
            `);
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }

    // A diferencia de grupo.repository.js:buscarTecnicos, acá NO se filtra por rol ni por
    // accesos: el objetivo es encontrar a cualquiera, sobre todo a quien todavía no tiene nada.
    async buscarUsuarios(q) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const result = await connection.execute(`
                SELECT u.ID_USUARIO, u.NOMBRE, u.APELLIDO, u.NUM_DOCUMENTO, u.EMAIL,
                       u.ESTADO, u.BLOQUEADO,
                       (SELECT COUNT(*) FROM GADMAPPS.RBAC_USUARIO_MODULO_ROL umr
                        WHERE umr.ID_USUARIO = u.ID_USUARIO AND umr.ESTADO = 'S') AS TOTAL_ACCESOS_ACTIVOS
                FROM GADMAPPS.RBAC_USUARIOS u
                WHERE UPPER(u.NOMBRE || ' ' || u.APELLIDO) LIKE UPPER('%' || :q || '%')
                   OR u.NUM_DOCUMENTO LIKE '%' || :q || '%'
                   OR UPPER(u.EMAIL) LIKE UPPER('%' || :q || '%')
                ORDER BY u.APELLIDO, u.NOMBRE
                FETCH FIRST 20 ROWS ONLY
            `, { q });
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }

    async findUsuarioPorId(idUsuario) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const result = await connection.execute(`
                SELECT u.ID_USUARIO, u.NOMBRE, u.APELLIDO, u.NUM_DOCUMENTO, u.EMAIL,
                       u.ESTADO, u.BLOQUEADO,
                       (SELECT COUNT(*) FROM GADMAPPS.RBAC_USUARIO_MODULO_ROL umr
                        WHERE umr.ID_USUARIO = u.ID_USUARIO AND umr.ESTADO = 'S') AS TOTAL_ACCESOS_ACTIVOS
                FROM GADMAPPS.RBAC_USUARIOS u
                WHERE u.ID_USUARIO = :idUsuario
            `, { idUsuario });
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }

    // Activos y revocados: la pantalla muestra los revocados colapsados (D4).
    async findAccesosDeUsuario(idUsuario) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const result = await connection.execute(`
                SELECT umr.ID_UMR, s.ID_SISTEMA, s.NOMBRE AS SISTEMA,
                       m.ID_MODULO, m.NOMBRE AS MODULO,
                       r.ID_ROL, r.NOMBRE AS ROL,
                       umr.ESTADO, umr.CREADO_EN
                FROM GADMAPPS.RBAC_USUARIO_MODULO_ROL umr
                JOIN GADMAPPS.RBAC_MODULOS m  ON m.ID_MODULO = umr.ID_MODULO
                JOIN GADMAPPS.RBAC_SISTEMAS s ON s.ID_SISTEMA = m.ID_SISTEMA
                JOIN GADMAPPS.RBAC_ROLES r    ON r.ID_ROL = umr.ID_ROL
                WHERE umr.ID_USUARIO = :idUsuario
                ORDER BY umr.ESTADO DESC, s.NOMBRE, m.NOMBRE, r.NOMBRE
            `, { idUsuario });
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }
}

export default new AccesosRepository();
```

- [ ] **Paso 5: Escribir el servicio**

Crear `backend/src/services/accesos.service.js`:

```js
import accesosRepository from '../repositories/accesos.repository.js';
import {
    SistemaCatalogoModel,
    RolModel,
    UsuarioAccesoModel,
    AccesoModel
} from '../models/acceso.model.js';

class AccesosService {
    async obtenerCatalogo() {
        const [filasModulos, filasRoles] = await Promise.all([
            accesosRepository.findSistemasConModulos(),
            accesosRepository.findRoles()
        ]);

        return {
            sistemas: SistemaCatalogoModel.fromDatabaseArray(filasModulos),
            roles: RolModel.fromDatabaseArray(filasRoles)
        };
    }

    async buscarUsuarios(q) {
        if (!q || typeof q !== 'string' || !q.trim()) {
            throw new Error('VALIDACION_FALLIDA: Escribe una cédula, nombre o correo para buscar.');
        }
        const filas = await accesosRepository.buscarUsuarios(q.trim());
        return UsuarioAccesoModel.fromDatabaseArray(filas);
    }

    async obtenerDetalleUsuario(idUsuario) {
        const filasUsuario = await accesosRepository.findUsuarioPorId(idUsuario);
        if (filasUsuario.length === 0) {
            throw new Error('USUARIO_NO_ENCONTRADO');
        }

        const filasAccesos = await accesosRepository.findAccesosDeUsuario(idUsuario);

        return {
            usuario: UsuarioAccesoModel.fromDatabaseArray(filasUsuario)[0],
            accesos: AccesoModel.fromDatabaseArray(filasAccesos)
        };
    }
}

export default new AccesosService();
```

- [ ] **Paso 6: Correr las pruebas y verificar que pasan**

```bash
npm test --prefix backend
```

Esperado: **24 pruebas pasan** (18 previas + 6 nuevas). Si el número no coincide, no continúes:
revisá qué prueba se rompió.

- [ ] **Paso 7: Commit**

```bash
git add backend/src/models/acceso.model.js backend/src/repositories/accesos.repository.js backend/src/services/accesos.service.js backend/src/services/accesos.consulta.service.spec.js
git commit -m "feat: consultas de catalogo, usuarios y accesos en el backend"
```

---

## Tarea 3: Backend — otorgar y revocar

**Archivos:**
- Modificar: `backend/src/repositories/accesos.repository.js` (agregar métodos al final de la clase)
- Modificar: `backend/src/services/accesos.service.js` (agregar métodos a la clase)
- Crear: `backend/src/services/accesos.escritura.service.spec.js`

**Interfaces:**
- Consume de la tarea 2: `accesosRepository`, `accesosService`, `UsuarioAccesoModel`.
- Produce, para la tarea 4:
  - `accesosRepository.otorgarAccesos(idUsuario, otorgamientos, asignadoPor)` → `{ otorgados, reactivados }`
  - `accesosRepository.revocarAcceso(idUsuario, idModulo, idRol)` → `number` (filas afectadas)
  - `accesosRepository.findNombreModulo(idModulo)` → `string | null`
  - `accesosService.otorgarAccesos(idUsuario, otorgamientos, asignadoPor)` → `{ otorgados, reactivados }`
  - `accesosService.revocarAcceso(idUsuario, idModulo, idRol, idActor)` → `void`

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `backend/src/services/accesos.escritura.service.spec.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repositories/accesos.repository.js', () => ({
  default: {
    findSistemasConModulos: vi.fn(),
    findRoles: vi.fn(),
    findUsuarioPorId: vi.fn(),
    otorgarAccesos: vi.fn(),
    revocarAcceso: vi.fn(),
    findNombreModulo: vi.fn()
  }
}));

const accesosRepository = (await import('../repositories/accesos.repository.js')).default;
const accesosService = (await import('./accesos.service.js')).default;

// Catálogo mínimo que usan las validaciones: módulos 1 y 22 activos, rol 21 activo.
function catalogoValido() {
  accesosRepository.findSistemasConModulos.mockResolvedValue([
    { ID_SISTEMA: 1, SISTEMA: 'BACHERITO', ID_MODULO: 1, MODULO: 'REPORTAR_BACHE', DESCRIPCION: null },
    { ID_SISTEMA: 1, SISTEMA: 'BACHERITO', ID_MODULO: 22, MODULO: 'MIS_TAREAS', DESCRIPCION: null }
  ]);
  accesosRepository.findRoles.mockResolvedValue([{ ID_ROL: 21, NOMBRE: 'TECNICO' }]);
}

function usuarioExiste() {
  accesosRepository.findUsuarioPorId.mockResolvedValue([
    {
      ID_USUARIO: 22, NOMBRE: 'JORGE', APELLIDO: 'RAMOS', NUM_DOCUMENTO: '1801806074',
      EMAIL: 'j@a.gob.ec', ESTADO: 'S', BLOQUEADO: 0, TOTAL_ACCESOS_ACTIVOS: 0
    }
  ]);
}

describe('AccesosService · otorgar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    catalogoValido();
    usuarioExiste();
  });

  it('rechaza una lista vacia sin tocar el repositorio', async () => {
    await expect(accesosService.otorgarAccesos(22, [], 21)).rejects.toThrow(/VALIDACION_FALLIDA/);
    expect(accesosRepository.otorgarAccesos).not.toHaveBeenCalled();
  });

  it('rechaza un usuario inexistente', async () => {
    accesosRepository.findUsuarioPorId.mockResolvedValue([]);
    await expect(accesosService.otorgarAccesos(999, [{ idModulo: 1, idRol: 21 }], 21))
      .rejects.toThrow('USUARIO_NO_ENCONTRADO');
    expect(accesosRepository.otorgarAccesos).not.toHaveBeenCalled();
  });

  it('rechaza un modulo que no esta en el catalogo activo', async () => {
    await expect(accesosService.otorgarAccesos(22, [{ idModulo: 999, idRol: 21 }], 21))
      .rejects.toThrow('MODULO_O_ROL_INVALIDO');
    expect(accesosRepository.otorgarAccesos).not.toHaveBeenCalled();
  });

  it('rechaza un rol que no esta en el catalogo activo', async () => {
    await expect(accesosService.otorgarAccesos(22, [{ idModulo: 1, idRol: 999 }], 21))
      .rejects.toThrow('MODULO_O_ROL_INVALIDO');
    expect(accesosRepository.otorgarAccesos).not.toHaveBeenCalled();
  });

  it('delega el otorgamiento valido y devuelve el conteo del repositorio', async () => {
    accesosRepository.otorgarAccesos.mockResolvedValue({ otorgados: 1, reactivados: 1 });

    const resultado = await accesosService.otorgarAccesos(
      22, [{ idModulo: 1, idRol: 21 }, { idModulo: 22, idRol: 21 }], 21
    );

    expect(accesosRepository.otorgarAccesos).toHaveBeenCalledWith(
      22, [{ idModulo: 1, idRol: 21 }, { idModulo: 22, idRol: 21 }], 21
    );
    expect(resultado).toEqual({ otorgados: 1, reactivados: 1 });
  });

  it('usa el actor como ASIGNADO_POR aunque el cuerpo traiga otro valor', async () => {
    accesosRepository.otorgarAccesos.mockResolvedValue({ otorgados: 1, reactivados: 0 });

    await accesosService.otorgarAccesos(22, [{ idModulo: 1, idRol: 21, asignadoPor: 999 }], 21);

    const [, otorgamientos, asignadoPor] = accesosRepository.otorgarAccesos.mock.calls[0];
    expect(asignadoPor).toBe(21);
    expect(otorgamientos[0]).toEqual({ idModulo: 1, idRol: 21 });
  });
});

describe('AccesosService · revocar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accesosRepository.findNombreModulo.mockResolvedValue('MIS_TAREAS');
    accesosRepository.revocarAcceso.mockResolvedValue(1);
  });

  it('revoca un acceso normal', async () => {
    await accesosService.revocarAcceso(22, 22, 21, 21);
    expect(accesosRepository.revocarAcceso).toHaveBeenCalledWith(22, 22, 21);
  });

  it('lanza ACCESO_NO_ENCONTRADO si no habia fila activa', async () => {
    accesosRepository.revocarAcceso.mockResolvedValue(0);
    await expect(accesosService.revocarAcceso(22, 22, 21, 21)).rejects.toThrow('ACCESO_NO_ENCONTRADO');
  });

  it('impide que el actor se revoque GESTIONAR_ACCESOS a si mismo', async () => {
    accesosRepository.findNombreModulo.mockResolvedValue('GESTIONAR_ACCESOS');
    await expect(accesosService.revocarAcceso(21, 23, 1, 21)).rejects.toThrow('AUTO_REVOCACION_PROHIBIDA');
    expect(accesosRepository.revocarAcceso).not.toHaveBeenCalled();
  });

  it('SI permite revocar GESTIONAR_ACCESOS a OTRO usuario', async () => {
    accesosRepository.findNombreModulo.mockResolvedValue('GESTIONAR_ACCESOS');
    await accesosService.revocarAcceso(22, 23, 1, 21);
    expect(accesosRepository.revocarAcceso).toHaveBeenCalledWith(22, 23, 1);
  });

  it('SI permite que el actor se revoque a si mismo un modulo que no es el de gestion', async () => {
    accesosRepository.findNombreModulo.mockResolvedValue('MIS_TAREAS');
    await accesosService.revocarAcceso(21, 22, 21, 21);
    expect(accesosRepository.revocarAcceso).toHaveBeenCalledWith(21, 22, 21);
  });
});
```

Las dos últimas pruebas de `revocar` existen para que **D6 no se implemente de más**: la regla
prohíbe exactamente un caso, no todo lo que se le parezca.

- [ ] **Paso 2: Correr la prueba y verificar que falla**

```bash
npm test --prefix backend
```

Esperado: FALLA con `accesosService.otorgarAccesos is not a function`.

- [ ] **Paso 3: Agregar los métodos al repositorio**

En `backend/src/repositories/accesos.repository.js`, **dentro de la clase**, después de
`findAccesosDeUsuario`:

```js
    // Otorga N pares (módulo, rol) en UNA sola transacción: entran todos o ninguno.
    // Mismo patrón que grupo.repository.js:asignarTareasMasivo.
    //
    // Por cada par, en este orden:
    //   1. Si ya hay fila ACTIVA, no hace nada (idempotencia, D8).
    //   2. Si hay fila REVOCADA, la reactiva (D5) — insertar chocaría con
    //      UK_USUARIO_MODULO_ROL y daría un ORA-00001 incomprensible.
    //   3. Si no hay fila, la inserta.
    async otorgarAccesos(idUsuario, otorgamientos, asignadoPor) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            let otorgados = 0;
            let reactivados = 0;

            for (const { idModulo, idRol } of otorgamientos) {
                const binds = { idUsuario, idModulo, idRol };

                const activa = await connection.execute(
                    `SELECT ID_UMR FROM GADMAPPS.RBAC_USUARIO_MODULO_ROL
                     WHERE ID_USUARIO = :idUsuario AND ID_MODULO = :idModulo
                       AND ID_ROL = :idRol AND ESTADO = 'S'`,
                    binds
                );
                if (activa.rows.length > 0) continue;

                const reactivacion = await connection.execute(
                    `UPDATE GADMAPPS.RBAC_USUARIO_MODULO_ROL
                     SET ESTADO = 'S', ASIGNADO_POR = :asignadoPor
                     WHERE ID_USUARIO = :idUsuario AND ID_MODULO = :idModulo
                       AND ID_ROL = :idRol AND ESTADO = 'N'`,
                    { ...binds, asignadoPor },
                    { autoCommit: false }
                );
                if (reactivacion.rowsAffected > 0) {
                    reactivados++;
                    continue;
                }

                await connection.execute(
                    `INSERT INTO GADMAPPS.RBAC_USUARIO_MODULO_ROL
                        (ID_USUARIO, ID_MODULO, ID_ROL, ASIGNADO_POR)
                     VALUES (:idUsuario, :idModulo, :idRol, :asignadoPor)`,
                    { ...binds, asignadoPor },
                    { autoCommit: false }
                );
                otorgados++;
            }

            await connection.commit();
            return { otorgados, reactivados };
        } catch (error) {
            if (connection) await connection.rollback();
            throw error;
        } finally {
            if (connection) await connection.close();
        }
    }

    // Revocación blanda (D4): la fila queda con ESTADO='N' para no perder el historial
    // de quién tuvo qué acceso. VW_AUTORIZACION_USUARIOS ya filtra por umr.ESTADO='S'.
    async revocarAcceso(idUsuario, idModulo, idRol) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const result = await connection.execute(
                `UPDATE GADMAPPS.RBAC_USUARIO_MODULO_ROL SET ESTADO = 'N'
                 WHERE ID_USUARIO = :idUsuario AND ID_MODULO = :idModulo
                   AND ID_ROL = :idRol AND ESTADO = 'S'`,
                { idUsuario, idModulo, idRol },
                { autoCommit: true }
            );
            return result.rowsAffected;
        } finally {
            if (connection) await connection.close();
        }
    }

    // Para la regla D6: se resuelve el NOMBRE desde la base en vez de confiar en que
    // un id concreto sea GESTIONAR_ACCESOS (ID_MODULO es columna de identidad).
    async findNombreModulo(idModulo) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const result = await connection.execute(
                `SELECT NOMBRE FROM GADMAPPS.RBAC_MODULOS WHERE ID_MODULO = :idModulo`,
                { idModulo }
            );
            return result.rows.length > 0 ? result.rows[0].NOMBRE : null;
        } finally {
            if (connection) await connection.close();
        }
    }
```

- [ ] **Paso 4: Agregar los métodos al servicio**

En `backend/src/services/accesos.service.js`, agregar **arriba del todo**, después de los imports:

```js
// El módulo que protege esta misma pantalla. Nadie puede revocárselo a sí mismo (D6):
// es la única puerta de entrada, y si el último administrador se lo quita, no hay forma
// de devolvérselo desde la aplicación.
const MODULO_DE_GESTION = 'GESTIONAR_ACCESOS';
```

Y **dentro de la clase**, después de `obtenerDetalleUsuario`:

```js
    async otorgarAccesos(idUsuario, otorgamientos, asignadoPor) {
        if (!Array.isArray(otorgamientos) || otorgamientos.length === 0) {
            throw new Error('VALIDACION_FALLIDA: Selecciona al menos un módulo con su rol.');
        }

        const filasUsuario = await accesosRepository.findUsuarioPorId(idUsuario);
        if (filasUsuario.length === 0) {
            throw new Error('USUARIO_NO_ENCONTRADO');
        }

        // Se valida contra el catálogo activo, que es la misma fuente que ve el administrador
        // en la pantalla: así un módulo dado de baja no puede otorgarse por API.
        const catalogo = await this.obtenerCatalogo();
        const modulosValidos = new Set(
            catalogo.sistemas.flatMap(sistema => sistema.modulos.map(modulo => modulo.idModulo))
        );
        const rolesValidos = new Set(catalogo.roles.map(rol => rol.idRol));

        // Se reconstruye cada par con solo idModulo/idRol: cualquier otro campo que venga en
        // el cuerpo (por ejemplo un ASIGNADO_POR falsificado) se descarta aquí (D9).
        const limpios = otorgamientos.map(({ idModulo, idRol }) => ({
            idModulo: Number(idModulo),
            idRol: Number(idRol)
        }));

        for (const { idModulo, idRol } of limpios) {
            if (!modulosValidos.has(idModulo) || !rolesValidos.has(idRol)) {
                throw new Error('MODULO_O_ROL_INVALIDO');
            }
        }

        return accesosRepository.otorgarAccesos(Number(idUsuario), limpios, asignadoPor);
    }

    async revocarAcceso(idUsuario, idModulo, idRol, idActor) {
        if (Number(idUsuario) === Number(idActor)) {
            const nombreModulo = await accesosRepository.findNombreModulo(Number(idModulo));
            if (nombreModulo === MODULO_DE_GESTION) {
                throw new Error('AUTO_REVOCACION_PROHIBIDA');
            }
        }

        const filasAfectadas = await accesosRepository.revocarAcceso(
            Number(idUsuario), Number(idModulo), Number(idRol)
        );
        if (filasAfectadas === 0) {
            throw new Error('ACCESO_NO_ENCONTRADO');
        }
    }
```

- [ ] **Paso 5: Correr las pruebas y verificar que pasan**

```bash
npm test --prefix backend
```

Esperado: **35 pruebas pasan** (24 previas + 11 nuevas).

- [ ] **Paso 6: Commit**

```bash
git add backend/src/repositories/accesos.repository.js backend/src/services/accesos.service.js backend/src/services/accesos.escritura.service.spec.js
git commit -m "feat: otorgar y revocar accesos con transaccion y regla anti-autobloqueo"
```

---

## Tarea 4: Backend — controlador y rutas

**Archivos:**
- Crear: `backend/src/controllers/accesos.controller.js`
- Crear: `backend/src/routes/accesos.routes.js`
- Modificar: `backend/src/app.js`

**Interfaces:**
- Consume de las tareas 2 y 3: los cinco métodos de `accesosService`.
- Produce: los cinco endpoints que consume la tarea 5.

- [ ] **Paso 1: Escribir el controlador**

Crear `backend/src/controllers/accesos.controller.js`:

```js
import accesosService from '../services/accesos.service.js';

// El middleware global de errores siempre responde 500 e ignora statusCode, así que cada
// caso de negocio se traduce a su código HTTP acá, antes de delegar en next(error).
class AccesosController {
    async catalogo(req, res, next) {
        try {
            const data = await accesosService.obtenerCatalogo();
            return res.status(200).json({ success: true, data });
        } catch (error) {
            next(error);
        }
    }

    async buscarUsuarios(req, res, next) {
        try {
            const data = await accesosService.buscarUsuarios(req.query.q);
            return res.status(200).json({ success: true, count: data.length, data });
        } catch (error) {
            if (error.message.startsWith('VALIDACION_FALLIDA')) {
                return res.status(400).json({ success: false, message: error.message.replace('VALIDACION_FALLIDA: ', '') });
            }
            next(error);
        }
    }

    async detalleUsuario(req, res, next) {
        try {
            const data = await accesosService.obtenerDetalleUsuario(req.params.id);
            return res.status(200).json({ success: true, data });
        } catch (error) {
            if (error.message === 'USUARIO_NO_ENCONTRADO') {
                return res.status(404).json({ success: false, message: 'No se encontró el usuario.' });
            }
            next(error);
        }
    }

    async otorgar(req, res, next) {
        try {
            // ASIGNADO_POR sale del token, nunca del cuerpo (D9).
            const data = await accesosService.otorgarAccesos(
                req.params.id, req.body.otorgamientos, req.usuario.sub
            );
            return res.status(201).json({
                success: true,
                message: `Se otorgaron ${data.otorgados} accesos nuevos y se reactivaron ${data.reactivados}.`,
                data
            });
        } catch (error) {
            if (error.message.startsWith('VALIDACION_FALLIDA')) {
                return res.status(400).json({ success: false, message: error.message.replace('VALIDACION_FALLIDA: ', '') });
            }
            if (error.message === 'USUARIO_NO_ENCONTRADO') {
                return res.status(404).json({ success: false, message: 'No se encontró el usuario.' });
            }
            if (error.message === 'MODULO_O_ROL_INVALIDO') {
                return res.status(400).json({ success: false, message: 'Alguno de los módulos o roles seleccionados no existe o está inactivo.' });
            }
            next(error);
        }
    }

    async revocar(req, res, next) {
        try {
            await accesosService.revocarAcceso(
                req.params.id, req.params.idModulo, req.params.idRol, req.usuario.sub
            );
            return res.status(200).json({ success: true, message: 'Acceso revocado.' });
        } catch (error) {
            if (error.message === 'AUTO_REVOCACION_PROHIBIDA') {
                return res.status(409).json({
                    success: false,
                    message: 'No puedes quitarte a ti mismo el acceso a la gestión de accesos: quedarías sin forma de recuperarlo.'
                });
            }
            if (error.message === 'ACCESO_NO_ENCONTRADO') {
                return res.status(404).json({ success: false, message: 'Ese acceso no existe o ya estaba revocado.' });
            }
            next(error);
        }
    }
}

export default new AccesosController();
```

- [ ] **Paso 2: Escribir las rutas**

Crear `backend/src/routes/accesos.routes.js`:

```js
import { Router } from 'express';
import accesosController from '../controllers/accesos.controller.js';
import { requireAuth, requireModulo } from '../middlewares/auth.middleware.js';

const router = Router();
const soloGestionarAccesos = [requireAuth, requireModulo('GESTIONAR_ACCESOS')];

// Las rutas literales van ANTES que las de parámetro: si /accesos/usuarios/:id se
// declarara primero, /accesos/catalogo nunca llegaría a su controlador.
router.get('/accesos/catalogo', soloGestionarAccesos, accesosController.catalogo);
router.get('/accesos/usuarios', soloGestionarAccesos, accesosController.buscarUsuarios);
router.get('/accesos/usuarios/:id', soloGestionarAccesos, accesosController.detalleUsuario);
router.post('/accesos/usuarios/:id', soloGestionarAccesos, accesosController.otorgar);
router.delete('/accesos/usuarios/:id/modulos/:idModulo/roles/:idRol', soloGestionarAccesos, accesosController.revocar);

export default router;
```

- [ ] **Paso 3: Registrar el router**

En `backend/src/app.js`, agregar el import junto a los demás (después de la línea de
`mistareaRoutes`):

```js
import accesosRoutes from './routes/accesos.routes.js';
```

Y el registro, después de `app.use('/api', mistareaRoutes);`:

```js
app.use('/api', accesosRoutes);
```

- [ ] **Paso 4: Verificar que el servidor arranca y las rutas existen**

```bash
node --input-type=module -e "import('./backend/src/routes/accesos.routes.js').then(m => console.log(m.default.stack.map(c => Object.keys(c.route.methods)[0].toUpperCase() + ' ' + c.route.path).join('\n')))"
```

Esperado, en este orden exacto:

```
GET /accesos/catalogo
GET /accesos/usuarios
GET /accesos/usuarios/:id
POST /accesos/usuarios/:id
DELETE /accesos/usuarios/:id/modulos/:idModulo/roles/:idRol
```

- [ ] **Paso 5: Correr las pruebas**

```bash
npm test --prefix backend
```

Esperado: **35 pruebas siguen pasando** (esta tarea no agrega pruebas; el controlador es
traducción pura y se verifica en la QA manual).

- [ ] **Paso 6: Commit**

```bash
git add backend/src/controllers/accesos.controller.js backend/src/routes/accesos.routes.js backend/src/app.js
git commit -m "feat: exponer los endpoints de gestion de accesos"
```

---

## Tarea 5: Frontend — servicio y tipos

**Archivos:**
- Crear: `frontend/src/app/features/admin/accesos/accesos.service.ts`
- Crear: `frontend/src/app/features/admin/accesos/accesos.service.spec.ts`

**Interfaces:**
- Consume de la tarea 4: los cinco endpoints.
- Produce, para las tareas 6 y 7: la clase `AccesosService` y las interfaces `ModuloCatalogo`,
  `SistemaCatalogo`, `RolCatalogo`, `Catalogo`, `UsuarioBusqueda`, `Acceso`, `DetalleUsuario`,
  `Otorgamiento`.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `frontend/src/app/features/admin/accesos/accesos.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, firstValueFrom } from 'rxjs';
import { AccesosService } from './accesos.service';

describe('AccesosService', () => {
  let servicio: AccesosService;
  let httpFalso: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    httpFalso = {
      get: vi.fn(() => of({ success: true, data: [] })),
      post: vi.fn(() => of({ success: true, message: 'ok', data: { otorgados: 0, reactivados: 0 } })),
      delete: vi.fn(() => of({ success: true, message: 'ok' }))
    };

    TestBed.configureTestingModule({
      providers: [AccesosService, { provide: HttpClient, useValue: httpFalso }]
    });
    servicio = TestBed.inject(AccesosService);
  });

  it('pide el catalogo a la ruta literal', async () => {
    await firstValueFrom(servicio.obtenerCatalogo());
    expect(httpFalso.get).toHaveBeenCalledWith(expect.stringContaining('/accesos/catalogo'));
  });

  it('busca usuarios enviando q como parametro', async () => {
    await firstValueFrom(servicio.buscarUsuarios('1801806074'));
    expect(httpFalso.get).toHaveBeenCalledWith(
      expect.stringContaining('/accesos/usuarios'),
      { params: { q: '1801806074' } }
    );
  });

  it('pide el detalle de un usuario por su id', async () => {
    await firstValueFrom(servicio.obtenerDetalleUsuario(22));
    expect(httpFalso.get).toHaveBeenCalledWith(expect.stringContaining('/accesos/usuarios/22'));
  });

  it('envia el arreglo de otorgamientos en el cuerpo', async () => {
    await firstValueFrom(servicio.otorgar(22, [{ idModulo: 1, idRol: 21 }]));
    expect(httpFalso.post).toHaveBeenCalledWith(
      expect.stringContaining('/accesos/usuarios/22'),
      { otorgamientos: [{ idModulo: 1, idRol: 21 }] }
    );
  });

  it('revoca apuntando al par modulo/rol', async () => {
    await firstValueFrom(servicio.revocar(22, 1, 21));
    expect(httpFalso.delete).toHaveBeenCalledWith(
      expect.stringContaining('/accesos/usuarios/22/modulos/1/roles/21')
    );
  });
});
```

- [ ] **Paso 2: Correr la prueba y verificar que falla**

```bash
npm test --prefix frontend
```

Esperado: FALLA con `Failed to resolve import "./accesos.service"`.

- [ ] **Paso 3: Escribir el servicio**

Crear `frontend/src/app/features/admin/accesos/accesos.service.ts`:

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface ModuloCatalogo {
  idModulo: number;
  nombre: string;
  descripcion: string | null;
}

export interface SistemaCatalogo {
  idSistema: number;
  nombre: string;
  modulos: ModuloCatalogo[];
}

export interface RolCatalogo {
  idRol: number;
  nombre: string;
}

export interface Catalogo {
  sistemas: SistemaCatalogo[];
  roles: RolCatalogo[];
}

export interface UsuarioBusqueda {
  idUsuario: number;
  nombre: string;
  apellido: string;
  numDocumento: string;
  email: string;
  estado: string;
  bloqueado: number;
  totalAccesosActivos: number;
}

// estado 'S' = activo, 'N' = revocado. Los revocados se muestran colapsados: la revocación
// es blanda justamente para no perder el historial de quién tuvo qué acceso.
export interface Acceso {
  idUmr: number;
  idSistema: number;
  sistema: string;
  idModulo: number;
  modulo: string;
  idRol: number;
  rol: string;
  estado: string;
  creadoEn: string;
}

export interface DetalleUsuario {
  usuario: UsuarioBusqueda;
  accesos: Acceso[];
}

export interface Otorgamiento {
  idModulo: number;
  idRol: number;
}

interface RespuestaCatalogo {
  success: boolean;
  data: Catalogo;
}

interface RespuestaUsuarios {
  success: boolean;
  count: number;
  data: UsuarioBusqueda[];
}

interface RespuestaDetalle {
  success: boolean;
  data: DetalleUsuario;
}

interface RespuestaOtorgamiento {
  success: boolean;
  message: string;
  data: { otorgados: number; reactivados: number };
}

@Injectable({
  providedIn: 'root'
})
export class AccesosService {
  private http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/accesos`;

  obtenerCatalogo(): Observable<RespuestaCatalogo> {
    return this.http.get<RespuestaCatalogo>(`${this.API_URL}/catalogo`);
  }

  buscarUsuarios(q: string): Observable<RespuestaUsuarios> {
    return this.http.get<RespuestaUsuarios>(`${this.API_URL}/usuarios`, { params: { q } });
  }

  obtenerDetalleUsuario(idUsuario: number): Observable<RespuestaDetalle> {
    return this.http.get<RespuestaDetalle>(`${this.API_URL}/usuarios/${idUsuario}`);
  }

  otorgar(idUsuario: number, otorgamientos: Otorgamiento[]): Observable<RespuestaOtorgamiento> {
    return this.http.post<RespuestaOtorgamiento>(`${this.API_URL}/usuarios/${idUsuario}`, { otorgamientos });
  }

  revocar(idUsuario: number, idModulo: number, idRol: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.API_URL}/usuarios/${idUsuario}/modulos/${idModulo}/roles/${idRol}`
    );
  }
}
```

- [ ] **Paso 4: Correr las pruebas y verificar que pasan**

```bash
npm test --prefix frontend
```

Esperado: **54 pruebas pasan** (49 previas + 5 nuevas).

- [ ] **Paso 5: Commit**

```bash
git add frontend/src/app/features/admin/accesos/accesos.service.ts frontend/src/app/features/admin/accesos/accesos.service.spec.ts
git commit -m "feat: servicio de gestion de accesos en el frontend"
```

---

## Tarea 6: Frontend — pantalla, ruta y menú

**Archivos:**
- Crear: `frontend/src/app/features/admin/accesos/accesos.ts`
- Crear: `frontend/src/app/features/admin/accesos/accesos.html`
- Modificar: `frontend/src/app/app.routes.ts`
- Modificar: `frontend/src/app/shared/components/navigation_drawer/navigation_drawer.component.ts`
- Modificar: `frontend/src/app/shared/components/navigation_drawer/navigation_drawer.component.html`

**Interfaces:**
- Consume de la tarea 5: `AccesosService`, `UsuarioBusqueda`.
- Produce, para la tarea 7: el elemento `<app-accesos-usuario [idUsuario]="..." (cambio)="...">`
  ya invocado desde `accesos.html`. **La tarea 6 deja ese punto de montaje comentado**; la tarea 7
  crea el componente y lo descomenta.

> **Contrato del toolbar, verificado en el código:** selector `app-toolbar`, clase
> `NavbarTopComponent`, entradas `titulo` / `mostrarBotonAtras` / `mostrarBotonMenu`, salida
> `menuClick`. El drawer es `app-navigation-drawer`, clase `NavigationDrawerComponent`, entrada
> `abierto`, salida `cerrado`.

- [ ] **Paso 1: Escribir el componente**

Crear `frontend/src/app/features/admin/accesos/accesos.ts`:

```ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AccesosService, UsuarioBusqueda } from './accesos.service';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { NavbarTopComponent } from '../../../shared/components/toolbar/toolbar.component';
import { NavigationDrawerComponent } from '../../../shared/components/navigation_drawer/navigation_drawer.component';

@Component({
  selector: 'app-accesos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    ButtonComponent,
    NavbarTopComponent,
    NavigationDrawerComponent
  ],
  templateUrl: './accesos.html'
})
export class AccesosComponent {
  private accesosService = inject(AccesosService);

  menuAbierto = signal(false);

  busqueda = signal('');
  buscando = signal(false);
  resultados = signal<UsuarioBusqueda[]>([]);
  errorBusqueda = signal<string | null>(null);
  yaBusco = signal(false);

  usuarioSeleccionado = signal<UsuarioBusqueda | null>(null);

  buscar() {
    const q = this.busqueda().trim();
    if (!q) {
      this.errorBusqueda.set('Escribe una cédula, nombre o correo para buscar.');
      return;
    }

    this.buscando.set(true);
    this.errorBusqueda.set(null);

    this.accesosService.buscarUsuarios(q).subscribe({
      next: (respuesta) => {
        this.resultados.set(respuesta.data);
        this.yaBusco.set(true);
        this.buscando.set(false);
      },
      error: () => {
        this.errorBusqueda.set('No se pudo completar la búsqueda. Revisa tu conexión e intenta de nuevo.');
        this.buscando.set(false);
      }
    });
  }

  seleccionar(usuario: UsuarioBusqueda) {
    this.usuarioSeleccionado.set(usuario);
  }

  volverAlListado() {
    this.usuarioSeleccionado.set(null);
  }

  // La tarea 7 la llama cuando el hijo cambia algo, para que el contador de accesos
  // del listado no quede desactualizado.
  refrescarListado() {
    if (this.yaBusco()) this.buscar();
  }
}
```

- [ ] **Paso 2: Escribir la plantilla**

Crear `frontend/src/app/features/admin/accesos/accesos.html`:

```html
<div class="flex min-h-dvh flex-col bg-surface-alt">

  <app-toolbar
    titulo="Gestión de accesos"
    [mostrarBotonAtras]="true"
    [mostrarBotonMenu]="true"
    (menuClick)="menuAbierto.set(true)">
  </app-toolbar>

  <app-navigation-drawer
    [abierto]="menuAbierto()"
    (cerrado)="menuAbierto.set(false)">
  </app-navigation-drawer>

  <main class="flex-1 px-4 py-5">

    <!-- Los módulos van embebidos en el JWT firmado en el login y TOKEN_EXPIRACION_MIN es
         5760 (4 días). Sin este aviso, el administrador otorga un acceso, el usuario dice
         "no me aparece", y nadie entiende por qué. -->
    <div class="mb-5 flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-amber-900">
      <mat-icon class="!text-xl !h-5 !w-5 shrink-0">info</mat-icon>
      <p class="text-sm">
        Los cambios de acceso se aplican cuando la persona cierre sesión y vuelva a entrar.
      </p>
    </div>

    @if (usuarioSeleccionado(); as usuario) {

      <button
        (click)="volverAlListado()"
        class="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        <mat-icon class="!text-lg !h-4 !w-4">arrow_back</mat-icon>
        Buscar otra persona
      </button>

      <!-- La tarea 7 crea <app-accesos-usuario> y reemplaza este bloque. -->
      <div class="rounded-2xl bg-surface p-5 shadow-sm">
        <p class="text-sm font-bold text-text">{{ usuario.nombre }} {{ usuario.apellido }}</p>
        <p class="text-xs text-text-muted">{{ usuario.numDocumento }} · {{ usuario.email }}</p>
      </div>

    } @else {

      <div class="rounded-2xl bg-surface p-5 shadow-sm">
        <label for="busqueda" class="mb-2 block text-sm font-semibold text-text">
          Buscar persona
        </label>
        <div class="flex items-start gap-2">
          <input
            id="busqueda"
            type="text"
            [(ngModel)]="busqueda"
            (keyup.enter)="buscar()"
            placeholder="Cédula, nombre o correo"
            class="min-w-0 flex-1 rounded-xl border border-outline px-3 py-2.5 text-sm outline-none focus:border-primary" />
          <!-- app-button renderiza w-full, por eso va envuelto con un ancho fijo. -->
          <div class="w-28 shrink-0">
            <app-button
              type="button"
              variant="primary"
              [cargando]="buscando()"
              (btnClick)="buscar()">
              Buscar
            </app-button>
          </div>
        </div>

        @if (errorBusqueda()) {
          <p class="mt-2 text-sm text-error">{{ errorBusqueda() }}</p>
        }
      </div>

      @if (resultados().length > 0) {
        <ul class="mt-4 flex flex-col gap-2">
          @for (usuario of resultados(); track usuario.idUsuario) {
            <li>
              <button
                (click)="seleccionar(usuario)"
                class="flex w-full items-center gap-3 rounded-2xl bg-surface p-4 text-left shadow-sm transition-all active:scale-[0.99]">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <mat-icon class="!text-xl !h-5 !w-5">person</mat-icon>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-bold text-text">{{ usuario.nombre }} {{ usuario.apellido }}</p>
                  <p class="truncate text-xs text-text-muted">{{ usuario.numDocumento }} · {{ usuario.email }}</p>
                </div>
                @if (usuario.totalAccesosActivos === 0) {
                  <span class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                    Sin accesos
                  </span>
                } @else {
                  <span class="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
                    {{ usuario.totalAccesosActivos }}
                  </span>
                }
              </button>
            </li>
          }
        </ul>
      } @else if (yaBusco() && !buscando()) {
        <p class="mt-4 rounded-2xl bg-surface p-5 text-center text-sm text-text-muted shadow-sm">
          No se encontró ninguna persona con ese dato.
        </p>
      }

    }

  </main>
</div>
```

> **Contrato de `<app-button>`, verificado en el código** (`shared/components/button/button.component.ts`
> y `.html`): entradas `type` (`'button' | 'submit' | 'reset'`), `variant`
> (`'primary' | 'secondary' | 'danger'`), `disabled`, `cargando`; salida **`btnClick`**. El texto va
> por **proyección de contenido** (`<ng-content>`), no por una entrada. **No existe `texto` ni
> `clic`.** Cuando `cargando` es `true` el botón muestra "Procesando..." e ignora el texto
> proyectado. El botón renderiza `w-full`, así que en una fila hay que envolverlo con un ancho fijo.

- [ ] **Paso 3: Agregar la ruta**

En `frontend/src/app/app.routes.ts`, después del bloque de `admin/grupos/:id`:

```ts
  {
    path: 'admin/accesos',
    canActivate: [authGuard, moduloGuard('GESTIONAR_ACCESOS')], // 🛡️ Protegido
    loadComponent: () => import('./features/admin/accesos/accesos').then(m => m.AccesosComponent)
  },
```

- [ ] **Paso 4: Agregar la entrada de menú**

En `navigation_drawer.component.ts`, después de `tieneAccesoAsignarGrupo`:

```ts
  get tieneAccesoGestionarAccesos(): boolean {
    return this.authService.tieneAcceso('GESTIONAR_ACCESOS');
  }
```

En `navigation_drawer.component.html` hay que cuidar el encabezado "Administración": hoy está
dentro del `@if (tieneAccesoAsignarGrupo)`. Reemplazá **todo** ese bloque (desde
`@if (tieneAccesoAsignarGrupo) {` hasta su llave de cierre) por:

```html
        @if (tieneAccesoAsignarGrupo || tieneAccesoGestionarAccesos) {
          <p class="px-3 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Administración
          </p>
        }

        @if (tieneAccesoAsignarGrupo) {
          <a
            routerLink="/admin/grupos"
            routerLinkActive="bg-primary-soft !text-primary font-bold"
            (click)="cerrar()"
            class="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-text-muted transition-all duration-150 hover:bg-surface-alt active:scale-[0.98]">
            <mat-icon class="!text-xl !h-5 !w-5">groups</mat-icon>
            Asignar Grupo
          </a>
        }

        @if (tieneAccesoGestionarAccesos) {
          <a
            routerLink="/admin/accesos"
            routerLinkActive="bg-primary-soft !text-primary font-bold"
            (click)="cerrar()"
            class="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-text-muted transition-all duration-150 hover:bg-surface-alt active:scale-[0.98]">
            <mat-icon class="!text-xl !h-5 !w-5">admin_panel_settings</mat-icon>
            Gestión de accesos
          </a>
        }
```

El encabezado se separó a su propio `@if` porque si no, quien tenga `GESTIONAR_ACCESOS` pero no
`ASIGNAR_GRUPO` vería su enlace sin ningún encabezado encima.

- [ ] **Paso 5: Compilar y correr las pruebas**

```bash
npm run build --prefix frontend
npm test --prefix frontend
```

Esperado: build **0 errores**, **54 pruebas pasan**.

- [ ] **Paso 6: Commit**

```bash
git add frontend/src/app/features/admin/accesos/accesos.ts frontend/src/app/features/admin/accesos/accesos.html frontend/src/app/app.routes.ts frontend/src/app/shared/components/navigation_drawer/navigation_drawer.component.ts frontend/src/app/shared/components/navigation_drawer/navigation_drawer.component.html
git commit -m "feat: pantalla de gestion de accesos con ruta y entrada de menu"
```

---

## Tarea 7: Frontend — accesos de un usuario (otorgar y revocar)

**Archivos:**
- Crear: `frontend/src/app/features/admin/accesos/accesos-usuario.ts`
- Crear: `frontend/src/app/features/admin/accesos/accesos-usuario.html`
- Modificar: `frontend/src/app/features/admin/accesos/accesos.ts` (importar el hijo)
- Modificar: `frontend/src/app/features/admin/accesos/accesos.html` (montarlo)

**Interfaces:**
- Consume de la tarea 5: `AccesosService`, `Catalogo`, `Acceso`, `Otorgamiento`, `UsuarioBusqueda`.
- Consume de la tarea 6: `AccesosComponent.refrescarListado()`.
- Produce: `<app-accesos-usuario [idUsuario]="number" (cambio)="...">`.

- [ ] **Paso 1: Escribir el componente hijo**

Crear `frontend/src/app/features/admin/accesos/accesos-usuario.ts`:

```ts
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AccesosService, Acceso, Catalogo, DetalleUsuario, Otorgamiento } from './accesos.service';
import { AuthService } from '../../../core/services/auth.service';
import { ButtonComponent } from '../../../shared/components/button/button.component';

// El módulo que protege esta misma pantalla: el botón de revocárselo a uno mismo va
// deshabilitado. El backend además lo rechaza con 409, esto es solo la mitad visible.
const MODULO_DE_GESTION = 'GESTIONAR_ACCESOS';

@Component({
  selector: 'app-accesos-usuario',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, ButtonComponent],
  templateUrl: './accesos-usuario.html'
})
export class AccesosUsuarioComponent {
  private accesosService = inject(AccesosService);
  private authService = inject(AuthService);

  idUsuario = input.required<number>();
  cambio = output<void>();

  detalle = signal<DetalleUsuario | null>(null);
  catalogo = signal<Catalogo | null>(null);
  cargando = signal(false);

  errorCarga = signal<string | null>(null);
  errorOtorgar = signal<string | null>(null);
  errorRevocar = signal<string | null>(null);
  mensajeExito = signal<string | null>(null);

  guardando = signal(false);
  revocando = signal<number | null>(null);
  mostrarRevocados = signal(false);

  // idModulo -> idRol elegido en el selector. Solo los que tienen rol elegido se envían.
  seleccion = signal<Map<number, number>>(new Map());

  accesosActivos = computed(() => this.detalle()?.accesos.filter(a => a.estado === 'S') ?? []);
  accesosRevocados = computed(() => this.detalle()?.accesos.filter(a => a.estado === 'N') ?? []);
  sinAccesos = computed(() => this.detalle() !== null && this.accesosActivos().length === 0);

  // AuthService no expone el id numérico del usuario en sesión, solo usuarioActual() (correo)
  // y cedulaActual(). Se compara por correo, que es único en RBAC_USUARIOS.
  esElActor = computed(() => this.detalle()?.usuario.email === this.authService.usuarioActual());

  constructor() {
    // Recarga sola cuando el padre cambia de usuario seleccionado.
    effect(() => {
      const id = this.idUsuario();
      this.cargar(id);
    });
  }

  private cargar(idUsuario: number) {
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.mensajeExito.set(null);
    this.seleccion.set(new Map());

    this.accesosService.obtenerCatalogo().subscribe({
      next: (respuestaCatalogo) => {
        this.catalogo.set(respuestaCatalogo.data);

        this.accesosService.obtenerDetalleUsuario(idUsuario).subscribe({
          next: (respuestaDetalle) => {
            this.detalle.set(respuestaDetalle.data);
            this.cargando.set(false);
          },
          error: () => {
            this.errorCarga.set('No se pudieron cargar los accesos de esta persona.');
            this.cargando.set(false);
          }
        });
      },
      error: () => {
        this.errorCarga.set('No se pudo cargar el catálogo de módulos y roles.');
        this.cargando.set(false);
      }
    });
  }

  // El par (módulo, rol) exacto ya está activo. NO se oculta el módulo entero: alguien con
  // MIS_TAREAS como TECNICO puede además necesitarlo como ADMIN, que es justo lo que la
  // clave UNIQUE(ID_USUARIO, ID_MODULO, ID_ROL) permite.
  yaTiene(idModulo: number, idRol: number): boolean {
    return this.accesosActivos().some(a => a.idModulo === idModulo && a.idRol === idRol);
  }

  rolElegido(idModulo: number): number | null {
    return this.seleccion().get(idModulo) ?? null;
  }

  elegirRol(idModulo: number, valor: string) {
    const mapa = new Map(this.seleccion());
    const idRol = Number(valor);

    if (!idRol) {
      mapa.delete(idModulo);
    } else {
      mapa.set(idModulo, idRol);
    }
    this.seleccion.set(mapa);
  }

  otorgamientosPendientes = computed<Otorgamiento[]>(() =>
    Array.from(this.seleccion().entries())
      .map(([idModulo, idRol]) => ({ idModulo, idRol }))
      .filter(par => !this.yaTiene(par.idModulo, par.idRol))
  );

  // Se deshabilita revocarse a uno mismo el módulo de gestión (D6): es la única puerta de
  // entrada, y sin él nadie podría devolvérselo desde la aplicación. Esta es solo la mitad
  // visible: el backend valida lo mismo por req.usuario.sub y responde 409.
  puedeRevocar(acceso: Acceso): boolean {
    return !(acceso.modulo === MODULO_DE_GESTION && this.esElActor());
  }

  otorgar() {
    const pendientes = this.otorgamientosPendientes();
    if (pendientes.length === 0) {
      this.errorOtorgar.set('Elige al menos un módulo con su rol.');
      return;
    }

    this.guardando.set(true);
    this.errorOtorgar.set(null);
    this.mensajeExito.set(null);

    this.accesosService.otorgar(this.idUsuario(), pendientes).subscribe({
      next: (respuesta) => {
        this.mensajeExito.set(respuesta.message);
        this.guardando.set(false);
        this.seleccion.set(new Map());
        this.cargar(this.idUsuario());
        this.cambio.emit();
      },
      error: (respuesta) => {
        this.errorOtorgar.set(respuesta?.error?.message ?? 'No se pudieron otorgar los accesos.');
        this.guardando.set(false);
      }
    });
  }

  revocar(acceso: Acceso) {
    this.revocando.set(acceso.idUmr);
    this.errorRevocar.set(null);
    this.mensajeExito.set(null);

    this.accesosService.revocar(this.idUsuario(), acceso.idModulo, acceso.idRol).subscribe({
      next: () => {
        this.revocando.set(null);
        this.cargar(this.idUsuario());
        this.cambio.emit();
      },
      error: (respuesta) => {
        this.errorRevocar.set(respuesta?.error?.message ?? 'No se pudo revocar el acceso.');
        this.revocando.set(null);
      }
    });
  }
}
```

> **Sobre `esElActor`:** `AuthService` no expone el id numérico del usuario en sesión — solo
> `usuarioActual()` (el correo) y `cedulaActual()`. Por eso la comparación es por correo. La
> comprobación autoritativa es la del backend, que usa `req.usuario.sub`; si el correo no
> coincidiera por algún motivo, el 409 igual protege.

- [ ] **Paso 2: Escribir la plantilla del hijo**

Crear `frontend/src/app/features/admin/accesos/accesos-usuario.html`:

```html
@if (cargando()) {
  <p class="rounded-2xl bg-surface p-5 text-center text-sm text-text-muted shadow-sm">
    Cargando accesos…
  </p>
}

@if (errorCarga()) {
  <p class="rounded-2xl bg-surface p-5 text-center text-sm text-error shadow-sm">
    {{ errorCarga() }}
  </p>
}

@if (detalle(); as d) {

  <!-- Ficha -->
  <div class="rounded-2xl bg-surface p-5 shadow-sm">
    <p class="text-sm font-bold text-text">{{ d.usuario.nombre }} {{ d.usuario.apellido }}</p>
    <p class="mt-0.5 text-xs text-text-muted">{{ d.usuario.numDocumento }} · {{ d.usuario.email }}</p>

    @if (sinAccesos()) {
      <div class="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-amber-900">
        <mat-icon class="!text-lg !h-4 !w-4 shrink-0">warning</mat-icon>
        <p class="text-xs">
          Esta persona no puede iniciar sesión: no tiene ningún módulo asignado.
        </p>
      </div>
    }
  </div>

  @if (mensajeExito()) {
    <p class="mt-3 rounded-xl bg-green-50 p-3 text-sm text-green-800">{{ mensajeExito() }}</p>
  }

  <!-- Accesos activos -->
  <section class="mt-4 rounded-2xl bg-surface p-5 shadow-sm">
    <h2 class="mb-3 text-sm font-bold text-text">Accesos activos</h2>

    @if (accesosActivos().length === 0) {
      <p class="text-sm text-text-muted">Todavía no tiene ninguno.</p>
    } @else {
      <ul class="flex flex-col gap-2">
        @for (acceso of accesosActivos(); track acceso.idUmr) {
          <li class="flex items-center gap-3 rounded-xl bg-surface-alt p-3">
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-text">{{ acceso.modulo }}</p>
              <p class="truncate text-xs text-text-muted">{{ acceso.sistema }} · rol {{ acceso.rol }}</p>
            </div>
            <button
              (click)="revocar(acceso)"
              [disabled]="!puedeRevocar(acceso) || revocando() === acceso.idUmr"
              class="shrink-0 rounded-lg p-2 text-error transition-all disabled:opacity-40"
              [attr.aria-label]="'Revocar ' + acceso.modulo">
              <mat-icon class="!text-xl !h-5 !w-5">remove_circle_outline</mat-icon>
            </button>
          </li>

          @if (!puedeRevocar(acceso)) {
            <p class="-mt-1 px-3 text-[11px] text-text-muted">
              No puedes quitarte a ti mismo este acceso: quedarías sin forma de recuperarlo.
            </p>
          }
        }
      </ul>
    }

    @if (errorRevocar()) {
      <p class="mt-3 text-sm text-error">{{ errorRevocar() }}</p>
    }
  </section>

  <!-- Otorgar -->
  <section class="mt-4 rounded-2xl bg-surface p-5 shadow-sm">
    <h2 class="mb-3 text-sm font-bold text-text">Otorgar acceso</h2>

    @if (catalogo(); as cat) {
      @for (sistema of cat.sistemas; track sistema.idSistema) {
        <p class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          {{ sistema.nombre }}
        </p>

        <ul class="mb-4 flex flex-col gap-2">
          @for (modulo of sistema.modulos; track modulo.idModulo) {
            <li class="flex items-center gap-3 rounded-xl bg-surface-alt p-3">
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-text">{{ modulo.nombre }}</p>
                @if (modulo.descripcion) {
                  <p class="truncate text-xs text-text-muted">{{ modulo.descripcion }}</p>
                }
              </div>

              <select
                [value]="rolElegido(modulo.idModulo) ?? ''"
                (change)="elegirRol(modulo.idModulo, $any($event.target).value)"
                class="shrink-0 rounded-lg border border-outline bg-surface px-2 py-1.5 text-xs outline-none focus:border-primary"
                [attr.aria-label]="'Rol para ' + modulo.nombre">
                <option value="">Sin rol</option>
                @for (rol of cat.roles; track rol.idRol) {
                  <option
                    [value]="rol.idRol"
                    [disabled]="yaTiene(modulo.idModulo, rol.idRol)">
                    {{ rol.nombre }}{{ yaTiene(modulo.idModulo, rol.idRol) ? ' (ya asignado)' : '' }}
                  </option>
                }
              </select>
            </li>
          }
        </ul>
      }

      <app-button
        type="button"
        variant="primary"
        [cargando]="guardando()"
        [disabled]="otorgamientosPendientes().length === 0"
        (btnClick)="otorgar()">
        Otorgar seleccionados
      </app-button>

      @if (errorOtorgar()) {
        <p class="mt-3 text-sm text-error">{{ errorOtorgar() }}</p>
      }
    }
  </section>

  <!-- Revocados, colapsados -->
  @if (accesosRevocados().length > 0) {
    <section class="mt-4 rounded-2xl bg-surface p-5 shadow-sm">
      <button
        (click)="mostrarRevocados.set(!mostrarRevocados())"
        class="flex w-full items-center justify-between text-sm font-bold text-text">
        Accesos revocados ({{ accesosRevocados().length }})
        <mat-icon class="!text-xl !h-5 !w-5">
          {{ mostrarRevocados() ? 'expand_less' : 'expand_more' }}
        </mat-icon>
      </button>

      @if (mostrarRevocados()) {
        <ul class="mt-3 flex flex-col gap-2">
          @for (acceso of accesosRevocados(); track acceso.idUmr) {
            <li class="rounded-xl bg-surface-alt p-3 opacity-70">
              <p class="text-sm font-medium text-text">{{ acceso.modulo }}</p>
              <p class="text-xs text-text-muted">{{ acceso.sistema }} · rol {{ acceso.rol }}</p>
            </li>
          }
        </ul>
      }
    </section>
  }

}
```

> Mismo contrato de `<app-button>` que la tarea 6: `type`, `variant`, `disabled`, `cargando`,
> salida `btnClick`, texto por proyección de contenido.

- [ ] **Paso 3: Montar el hijo en el padre**

En `accesos.ts`, agregar al import y a `imports:`:

```ts
import { AccesosUsuarioComponent } from './accesos-usuario';
```

En `accesos.html`, reemplazar el bloque provisional de la tarea 6:

```html
      <div class="rounded-2xl bg-surface p-5 shadow-sm">
        <p class="text-sm font-bold text-text">{{ usuario.nombre }} {{ usuario.apellido }}</p>
        <p class="text-xs text-text-muted">{{ usuario.numDocumento }} · {{ usuario.email }}</p>
      </div>
```

por:

```html
      <app-accesos-usuario
        [idUsuario]="usuario.idUsuario"
        (cambio)="refrescarListado()">
      </app-accesos-usuario>
```

- [ ] **Paso 4: Compilar y correr las pruebas**

```bash
npm run build --prefix frontend
npm test --prefix frontend
```

Esperado: build **0 errores**, **54 pruebas pasan**.

- [ ] **Paso 5: Commit**

```bash
git add frontend/src/app/features/admin/accesos/accesos-usuario.ts frontend/src/app/features/admin/accesos/accesos-usuario.html frontend/src/app/features/admin/accesos/accesos.ts frontend/src/app/features/admin/accesos/accesos.html
git commit -m "feat: otorgar y revocar accesos de un usuario"
```

---

## Tarea 8: Reporte de entrega e instrucciones de QA

**Archivos:**
- Crear: `contexto_claude/reportes/2026-08-02-gestion-accesos.md`

**Interfaces:**
- Consume: el resultado de las tareas 1 a 7.
- Produce: nada de código.

> `contexto_claude/` tiene cambios sin commitear del usuario. **Agregá únicamente el archivo
> nuevo**, nunca el directorio entero.

- [ ] **Paso 1: Escribir el reporte**

Debe contener, con estos títulos:

1. **Qué se entregó** — tabla de commits con su SHA real (sacada de `git log --oneline`, no
   inventada) y qué hace cada uno.
2. **Decisiones** — la tabla D1–D9 del spec, resumida.
3. **Contrato implementado** — los cinco endpoints con su entrada y salida.
4. **Verificación realizada** — la salida literal de `npm test --prefix backend`,
   `npm test --prefix frontend` y `npm run build --prefix frontend`. Solo lo que se ejecutó de
   verdad.
5. **Puesta en marcha** — los pasos 1 y 2 de la sección 9 del spec: correr
   `database/gestionar_accesos_setup.sql` y volver a iniciar sesión. Advertir que **sin esto la
   pantalla no es accesible ni siquiera para el administrador**.
6. **Prueba de aceptación pendiente** — otorgar al usuario `1801806074` (ID_USUARIO 22) los
   módulos `REPORTAR_BACHE`(1), `SEGUIMIENTO_BACHE`(2) y `MIS_TAREAS`(22) con rol `TECNICO`
   (ID_ROL 21), **por la pantalla**. Marcar que **escribe en producción** y requiere autorización
   explícita en el momento.
7. **Consultas de verificación** — las dos de la sección 9 del spec, de solo lectura.
8. **Qué destraba** — `grupo.repository.js:271` exige rol TECNICO y hoy nadie lo tiene; por eso
   "Asignar Grupo → buscar técnico" devuelve vacío y GRUPO_A/GRUPO_B no se pudieron crear.
9. **Qué quedó fuera** — lo listado en "Fuera de alcance" del spec, más las dos limitaciones
   heredadas de la sección 4 (el rol no decide nada; `error.middleware.js` siempre responde 500).

- [ ] **Paso 2: Verificar los SHA**

```bash
git log --oneline -9
```

Cada SHA del reporte debe existir en esa salida. Un SHA inventado invalida el reporte entero.

- [ ] **Paso 3: Commit**

```bash
git add contexto_claude/reportes/2026-08-02-gestion-accesos.md
git commit -m "docs: reporte de entrega de la gestion de accesos"
```

---

## Notas de revisión para el controlador

Puntos donde este plan puede inducir defectos, para mirar con atención en la revisión:

1. **`<app-button>`**: el contrato ya está verificado contra el componente (`type`, `variant`,
   `disabled`, `cargando`, `btnClick`, texto proyectado). El borrador de este plan usaba
   `texto`/`clic`/`deshabilitado`, que **no existen**; se corrigió antes de dispatchar. Si aparece
   alguno de esos nombres en el código entregado, es un defecto.
2. **Cada signal de error se pinta**: `errorBusqueda`, `errorCarga`, `errorOtorgar`, `errorRevocar`.
   Contar los `.set(` contra los `@if` en las plantillas. En `grupo-detalle` hubo 11 escrituras
   contra un solo renderizado y cuatro operaciones fallaban en silencio.
3. **D6 no implementada de más**: las dos pruebas que verifican que **sí** se puede revocar
   `GESTIONAR_ACCESOS` a otro usuario, y **sí** revocarse otros módulos a uno mismo.
4. **`ASIGNADO_POR`**: confirmar que el servicio reconstruye cada par con solo `idModulo`/`idRol`,
   descartando cualquier otro campo del cuerpo.
5. **Orden de rutas**: `/accesos/catalogo` y `/accesos/usuarios` antes de `/accesos/usuarios/:id`.
6. **Ningún script temporal quedó en `backend/`**: `ls backend/*.cjs backend/*.mjs` debe salir
   vacío al terminar.
