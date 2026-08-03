# Grupos con parroquias a cargo · Plan de Implementación

> **Para agentes ejecutores:** SUB-SKILL REQUERIDA: usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** Que un grupo de trabajo tenga N parroquias a cargo, y que el administrador pueda traer al grupo, con una acción explícita y previsualizada, todos los baches pendientes de esas parroquias.

**Arquitectura:** Tabla puente nueva `OP_BACHERITO_GRUPO_PARROQUIAS` con `UNIQUE(PAR_CODIGO)` que hace cumplir "una parroquia = un grupo" en Oracle. El backend sigue las 7 capas ya establecidas. El frontend no gana pantallas: dos bloques nuevos dentro de `grupo-detalle`.

**Stack:** Node.js + Express 5 + oracledb 7 (ESM) · Angular 22 standalone + signals · Vitest (nuevo en backend, ya existente en frontend).

**Spec de referencia:** `docs/superpowers/specs/2026-08-02-grupo-parroquias-design.md`

## Restricciones globales

- **Todo en español**: nombres de métodos, variables, comentarios, textos de UI y mensajes de commit.
- **Los scripts SQL se entregan, NO se ejecutan.** Se escribe el `.sql` en `database/` y el usuario lo corre contra Oracle. Ninguna tarea debe intentar ejecutarlo.
- **La base de datos es de PRODUCCIÓN** (`10.10.0.122:1521/PRD`, esquema `GADMAPPS`). Ninguna tarea debe escribir en ella. Las pruebas usan mocks.
- **Convención de coordenadas:** `COORDENADAX` = longitud, `COORDENADAY` = latitud. No tocar.
- **Fuera de alcance, no tocar:** `B1` (login Cognito), `B2` (UTM invertido), `B3` (`environment.prod.ts`), `B5` (filas de prueba), `B7` (`ESTADO: 'N'`).
- **Institución del Bacherito:** la constante `INSTITUCION_BACHERITO = '61'` ya existe en `grupo.service.js`. Reutilizarla, no redefinirla.
- **Higiene de git:** preparar archivos por ruta explícita. Nunca `git add -A`, `git add .` ni `git commit -a`. El working tree tiene cambios sin commitear en `contexto_claude/` y `.claude/launch.json` que pertenecen al usuario — no tocarlos.
- Backend corre desde `backend/`, frontend desde `frontend/`.

---

## Patrones del proyecto que hay que seguir

**Errores:** los servicios lanzan `Error` con mensajes centinela y los controladores los mapean a HTTP. Ejemplo real existente en `grupo.controller.js:77-90`:

```js
if (error.message === 'BACHE_YA_ASIGNADO') {
    return res.status(409).json({ success: false, message: 'Ese bache ya está asignado a otro grupo.' });
}
```

El middleware global (`error.middleware.js`) **siempre devuelve 500**; no lee `statusCode`. Los 4xx se resuelven en el controlador.

**Transacciones:** patrón real de `grupo.repository.js:119-144` — `autoCommit: false` en cada `execute`, `connection.commit()` al final, `rollback()` en el `catch`, `close()` en el `finally`.

**Orden de rutas:** las rutas literales van **antes** de `/grupos/:id`, como ya ocurre con `/grupos/resumen`, `/grupos/mapa` y `/grupos/tecnicos` en `grupo.routes.js`.

---

## Estructura de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `database/grupo_parroquias_setup.sql` | **Crear.** Tabla nueva. Se entrega, no se ejecuta | 1 |
| `backend/package.json` | **Modificar.** vitest + script `test` | 2 |
| `backend/src/models/grupo.model.js` | **Modificar.** `ParroquiaGrupoModel`, `ConteoParroquiaModel` | 2 |
| `backend/src/repositories/grupo.repository.js` | **Modificar.** 4 métodos de parroquias | 2 |
| `backend/src/services/grupo.service.js` | **Modificar.** 4 métodos de parroquias | 2 |
| `backend/src/services/grupo.parroquias.service.spec.js` | **Crear.** Pruebas de parroquias | 2 |
| `backend/src/repositories/grupo.repository.js` | **Modificar.** Conteo + asignación masiva | 3 |
| `backend/src/services/grupo.service.js` | **Modificar.** Previsualizar + asignar masivo | 3 |
| `backend/src/services/grupo.masivo.service.spec.js` | **Crear.** Pruebas de asignación masiva | 3 |
| `backend/src/controllers/grupo.controller.js` | **Modificar.** 6 métodos | 4 |
| `backend/src/routes/grupo.routes.js` | **Modificar.** 6 rutas, en el orden correcto | 4 |
| `frontend/.../asignar-grupo.service.ts` | **Modificar.** 6 métodos + interfaces | 5 |
| `frontend/.../asignar-grupo.service.spec.ts` | **Crear.** Pruebas del servicio | 5 |
| `frontend/.../grupo-detalle.ts` / `.html` | **Modificar.** Bloque "Parroquias a cargo" | 6 |
| `frontend/.../grupo-detalle.ts` / `.html` | **Modificar.** Bloque "Traer baches" + modal | 7 |
| `contexto_claude/reportes/...` | **Crear.** Reporte de entrega | 8 |

---

## Tarea 1: Script SQL de la tabla nueva

**Archivos:**
- Crear: `database/grupo_parroquias_setup.sql`

**Interfaces:**
- Produce: la tabla `GADMAPPS.OP_BACHERITO_GRUPO_PARROQUIAS`, que todas las tareas siguientes asumen.

> ⚠️ **NO ejecutar este script.** Se entrega para que el usuario lo corra. No hay conexión a Oracle en ninguna tarea de este plan.

- [ ] **Paso 1: Escribir el script**

Crear `database/grupo_parroquias_setup.sql`:

```sql
-- =====================================================================
-- Parroquias a cargo de cada grupo de trabajo.
--
-- Regla de negocio: una parroquia pertenece a UN SOLO grupo. Se hace
-- cumplir con UNIQUE(PAR_CODIGO), no con lógica de aplicación, para que
-- siga valiendo aunque alguien llame la API directamente.
--
-- Ejecutar en una sola sesión con el usuario GADMAPPS o equivalente.
-- =====================================================================

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

-- Consulta más frecuente: las parroquias de un grupo.
CREATE INDEX IX_GP_GRUPO ON GADMAPPS.OP_BACHERITO_GRUPO_PARROQUIAS (ID_GRUPO);

-- Verificación posterior (opcional, solo lectura):
-- SELECT * FROM GADMAPPS.OP_BACHERITO_GRUPO_PARROQUIAS;
```

- [ ] **Paso 2: Verificar contra el spec**

Comprobar, leyendo el archivo, que están las cinco cosas: identidad, FK con `ON DELETE CASCADE`, `UNIQUE(PAR_CODIGO)`, índice por `ID_GRUPO`, y que **no** hay FK contra `PAR_PARROQUIAS` (el proyecto no la usa en `OP_BACHERITO_REQ.PARROQUIA` tampoco).

- [ ] **Paso 3: Commit**

```bash
git add database/grupo_parroquias_setup.sql
git commit -m "feat: agregar script de la tabla de parroquias por grupo"
```

---

## Tarea 2: Backend — parroquias del grupo (con vitest)

**Archivos:**
- Modificar: `backend/package.json`
- Modificar: `backend/src/models/grupo.model.js`
- Modificar: `backend/src/repositories/grupo.repository.js`
- Modificar: `backend/src/services/grupo.service.js`
- Crear: `backend/src/services/grupo.parroquias.service.spec.js`

**Interfaces:**
- Consume: la tabla de la Tarea 1.
- Produce:
  - `grupoRepository.findParroquiasDeGrupo(idGrupo): Promise<rows>`
  - `grupoRepository.findParroquiasDisponibles(): Promise<rows>`
  - `grupoRepository.asignarParroquias(idGrupo, parCodigos, asignadoPor): Promise<void>`
  - `grupoRepository.quitarParroquia(idGrupo, parCodigo): Promise<number>`
  - `grupoService.obtenerParroquiasDeGrupo(idGrupo)`, `obtenerParroquiasDisponibles()`, `asignarParroquias(idGrupo, parroquias, asignadoPor)`, `quitarParroquia(idGrupo, parCodigo)`
  - Centinelas: `'PARROQUIA_YA_ASIGNADA'`, `'PARROQUIA_NO_ENCONTRADA'`, `'VALIDACION_FALLIDA: ...'`

- [ ] **Paso 1: Instalar vitest en el backend**

```bash
npm install --save-dev vitest --prefix backend
```

- [ ] **Paso 2: Agregar el script de test**

En `backend/package.json`, reemplazar la línea del script `test`:

```json
    "test": "vitest run"
```

- [ ] **Paso 3: Escribir las pruebas que fallan**

Crear `backend/src/services/grupo.parroquias.service.spec.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// El servicio importa el repositorio como módulo por defecto; se sustituye entero
// para probar las reglas sin tocar Oracle.
vi.mock('../repositories/grupo.repository.js', () => ({
  default: {
    findParroquiasDeGrupo: vi.fn(),
    findParroquiasDisponibles: vi.fn(),
    asignarParroquias: vi.fn(),
    quitarParroquia: vi.fn()
  }
}));

const grupoRepository = (await import('../repositories/grupo.repository.js')).default;
const grupoService = (await import('./grupo.service.js')).default;

describe('GrupoService · parroquias del grupo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('obtenerParroquiasDeGrupo', () => {
    it('devuelve las parroquias mapeadas a la forma del cliente', async () => {
      grupoRepository.findParroquiasDeGrupo.mockResolvedValue([
        { PAR_CODIGO: 1171, PAR_NOMBRE: 'ATOCHA – FICOA' },
        { PAR_CODIGO: 1172, PAR_NOMBRE: 'CELIANO MONGE' }
      ]);

      const resultado = await grupoService.obtenerParroquiasDeGrupo(7);

      expect(grupoRepository.findParroquiasDeGrupo).toHaveBeenCalledWith(7);
      expect(resultado).toEqual([
        { parCodigo: 1171, parNombre: 'ATOCHA – FICOA' },
        { parCodigo: 1172, parNombre: 'CELIANO MONGE' }
      ]);
    });

    it('devuelve arreglo vacío si el grupo no tiene ninguna', async () => {
      grupoRepository.findParroquiasDeGrupo.mockResolvedValue([]);
      expect(await grupoService.obtenerParroquiasDeGrupo(7)).toEqual([]);
    });
  });

  describe('asignarParroquias', () => {
    it('rechaza una lista vacía sin tocar el repositorio', async () => {
      await expect(grupoService.asignarParroquias(7, [], 3)).rejects.toThrow(/VALIDACION_FALLIDA/);
      expect(grupoRepository.asignarParroquias).not.toHaveBeenCalled();
    });

    it('rechaza códigos que no son números', async () => {
      await expect(grupoService.asignarParroquias(7, [1171, 'abc'], 3)).rejects.toThrow(/VALIDACION_FALLIDA/);
      expect(grupoRepository.asignarParroquias).not.toHaveBeenCalled();
    });

    it('asigna las parroquias válidas', async () => {
      grupoRepository.asignarParroquias.mockResolvedValue(undefined);

      await grupoService.asignarParroquias(7, [1171, 1172], 3);

      expect(grupoRepository.asignarParroquias).toHaveBeenCalledWith(7, [1171, 1172], 3);
    });

    // ORA-00001 es la violación de UNIQUE. Se traduce a un centinela propio para que el
    // controlador devuelva 409 en vez de un 500 genérico.
    it('traduce la violación de UNIQUE a PARROQUIA_YA_ASIGNADA', async () => {
      const errorOracle = new Error('ORA-00001: unique constraint violated');
      errorOracle.errorNum = 1;
      grupoRepository.asignarParroquias.mockRejectedValue(errorOracle);

      await expect(grupoService.asignarParroquias(7, [1171], 3)).rejects.toThrow('PARROQUIA_YA_ASIGNADA');
    });

    it('deja pasar cualquier otro error de Oracle sin disfrazarlo', async () => {
      const otro = new Error('ORA-12541: no listener');
      otro.errorNum = 12541;
      grupoRepository.asignarParroquias.mockRejectedValue(otro);

      await expect(grupoService.asignarParroquias(7, [1171], 3)).rejects.toThrow('ORA-12541');
    });
  });

  describe('quitarParroquia', () => {
    it('lanza PARROQUIA_NO_ENCONTRADA si no borró ninguna fila', async () => {
      grupoRepository.quitarParroquia.mockResolvedValue(0);
      await expect(grupoService.quitarParroquia(7, 1171)).rejects.toThrow('PARROQUIA_NO_ENCONTRADA');
    });

    it('quita solo la parroquia indicada del grupo indicado (D2)', async () => {
      grupoRepository.quitarParroquia.mockResolvedValue(1);

      await grupoService.quitarParroquia(7, 1171);

      // Una sola llamada, y solo a quitarParroquia: quitar territorio no quita trabajo.
      // Si alguien agrega aquí una baja de tareas, este conteo lo delata.
      expect(grupoRepository.quitarParroquia).toHaveBeenCalledTimes(1);
      expect(grupoRepository.quitarParroquia).toHaveBeenCalledWith(7, 1171);
      const llamadasTotales = Object.values(grupoRepository)
        .filter(fn => typeof fn === 'function' && 'mock' in fn)
        .reduce((suma, fn) => suma + fn.mock.calls.length, 0);
      expect(llamadasTotales).toBe(1);
    });
  });
});
```

- [ ] **Paso 4: Ejecutar y verificar que fallan**

Ejecutar: `npm test --prefix backend`
Esperado: FALLA. Los métodos del servicio no existen todavía.

- [ ] **Paso 5: Agregar los modelos**

En `backend/src/models/grupo.model.js`, agregar al final:

```js
// Parroquia a cargo de un grupo de trabajo.
export class ParroquiaGrupoModel {
    constructor(dbRow) {
        this.parCodigo = dbRow.PAR_CODIGO;
        this.parNombre = dbRow.PAR_NOMBRE;
    }

    static fromDatabaseArray(rows) {
        return rows.map(row => new ParroquiaGrupoModel(row));
    }
}

// Conteo de baches pendientes en una parroquia, para la previsualización de la
// asignación masiva.
export class ConteoParroquiaModel {
    constructor(dbRow) {
        this.parCodigo = dbRow.PAR_CODIGO;
        this.parNombre = dbRow.PAR_NOMBRE;
        this.cantidad = Number(dbRow.CANTIDAD) || 0;
    }

    static fromDatabaseArray(rows) {
        return rows.map(row => new ConteoParroquiaModel(row));
    }
}
```

- [ ] **Paso 6: Agregar los métodos del repositorio**

En `backend/src/repositories/grupo.repository.js`, dentro de la clase, agregar:

```js
    async findParroquiasDeGrupo(idGrupo) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const result = await connection.execute(
                `SELECT gp.PAR_CODIGO,
                        (SELECT PAR_NOMBRE FROM GADMAPPS.PAR_PARROQUIAS WHERE PAR_CODIGO = gp.PAR_CODIGO) AS PAR_NOMBRE
                 FROM GADMAPPS.OP_BACHERITO_GRUPO_PARROQUIAS gp
                 WHERE gp.ID_GRUPO = :idGrupo
                 ORDER BY PAR_NOMBRE`,
                { idGrupo }
            );
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }

    // Parroquias que todavía no tiene ningún grupo. Alimenta el selector del administrador,
    // para que no pueda ni intentar una ya tomada.
    async findParroquiasDisponibles() {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const result = await connection.execute(
                `SELECT p.PAR_CODIGO, p.PAR_NOMBRE
                 FROM GADMAPPS.PAR_PARROQUIAS p
                 WHERE p.PAR_CODIGO NOT IN (SELECT PAR_CODIGO FROM GADMAPPS.OP_BACHERITO_GRUPO_PARROQUIAS)
                 ORDER BY p.PAR_NOMBRE`
            );
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }

    // Agrega parroquias al grupo. Transaccional: si una viola el UNIQUE, no entra ninguna.
    async asignarParroquias(idGrupo, parCodigos, asignadoPor) {
        let connection;
        try {
            connection = await oracledb.getConnection();

            for (const parCodigo of parCodigos) {
                await connection.execute(
                    `INSERT INTO GADMAPPS.OP_BACHERITO_GRUPO_PARROQUIAS (ID_GRUPO, PAR_CODIGO, ASIGNADO_POR)
                     VALUES (:idGrupo, :parCodigo, :asignadoPor)`,
                    { idGrupo, parCodigo, asignadoPor },
                    { autoCommit: false }
                );
            }

            await connection.commit();
        } catch (error) {
            if (connection) await connection.rollback();
            throw error;
        } finally {
            if (connection) await connection.close();
        }
    }

    // Devuelve cuántas filas borró: 0 significa que esa parroquia no era de ese grupo.
    // NO toca OP_BACHERITO_GRUPO_TAREAS: quitar territorio no quita trabajo ya asignado.
    async quitarParroquia(idGrupo, parCodigo) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const result = await connection.execute(
                `DELETE FROM GADMAPPS.OP_BACHERITO_GRUPO_PARROQUIAS
                 WHERE ID_GRUPO = :idGrupo AND PAR_CODIGO = :parCodigo`,
                { idGrupo, parCodigo },
                { autoCommit: true }
            );
            return result.rowsAffected;
        } finally {
            if (connection) await connection.close();
        }
    }
```

- [ ] **Paso 7: Agregar los métodos del servicio**

En `backend/src/services/grupo.service.js`, primero extender el import de modelos para incluir los dos nuevos:

```js
import { GrupoModel, TecnicoModel, TareaModel, BacheDisponibleModel, BacheMapaModel, ResumenAdminModel, ParroquiaGrupoModel, ConteoParroquiaModel } from '../models/grupo.model.js';
```

Luego agregar dentro de la clase:

```js
    async obtenerParroquiasDeGrupo(idGrupo) {
        const filas = await grupoRepository.findParroquiasDeGrupo(idGrupo);
        return ParroquiaGrupoModel.fromDatabaseArray(filas);
    }

    async obtenerParroquiasDisponibles() {
        const filas = await grupoRepository.findParroquiasDisponibles();
        return ParroquiaGrupoModel.fromDatabaseArray(filas);
    }

    // Agrega parroquias al grupo (no reemplaza las que ya tenía).
    // ORA-00001 = violación de UNIQUE(PAR_CODIGO): la parroquia ya es de otro grupo.
    async asignarParroquias(idGrupo, parroquias, asignadoPor) {
        if (!Array.isArray(parroquias) || parroquias.length === 0) {
            throw new Error('VALIDACION_FALLIDA: Debes seleccionar al menos una parroquia.');
        }
        if (parroquias.some(codigo => !codigo || Number.isNaN(Number(codigo)))) {
            throw new Error('VALIDACION_FALLIDA: La lista de parroquias contiene un código inválido.');
        }

        try {
            await grupoRepository.asignarParroquias(idGrupo, parroquias.map(Number), asignadoPor);
        } catch (error) {
            if (error.errorNum === 1) {
                throw new Error('PARROQUIA_YA_ASIGNADA');
            }
            throw error;
        }
    }

    // Quitar una parroquia solo cambia el territorio del grupo. Los baches que ya se le
    // asignaron se quedan con él (decisión D2): puede haber un técnico con el trabajo en curso.
    async quitarParroquia(idGrupo, parCodigo) {
        const filasBorradas = await grupoRepository.quitarParroquia(idGrupo, parCodigo);
        if (filasBorradas === 0) {
            throw new Error('PARROQUIA_NO_ENCONTRADA');
        }
    }
```

- [ ] **Paso 8: Ejecutar y verificar que pasan**

Ejecutar: `npm test --prefix backend`
Esperado: PASA (9 pruebas).

- [ ] **Paso 9: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/models/grupo.model.js backend/src/repositories/grupo.repository.js backend/src/services/grupo.service.js backend/src/services/grupo.parroquias.service.spec.js
git commit -m "feat: agregar parroquias a cargo del grupo y montar vitest en el backend"
```

---

## Tarea 3: Backend — previsualización y asignación masiva

**Archivos:**
- Modificar: `backend/src/repositories/grupo.repository.js`
- Modificar: `backend/src/services/grupo.service.js`
- Crear: `backend/src/services/grupo.masivo.service.spec.js`

**Interfaces:**
- Consume: los métodos de parroquias de la Tarea 2.
- Produce:
  - `grupoRepository.contarBachesDeParroquiasDeGrupo(idGrupo, institucion): Promise<rows>`
  - `grupoRepository.findIdsBachesDeParroquiasDeGrupo(idGrupo, institucion): Promise<rows>`
  - `grupoRepository.asignarTareasMasivo(idGrupo, idsRequerimiento, asignadoPor): Promise<void>`
  - `grupoService.previsualizarBachesPorParroquia(idGrupo): Promise<{ total, detalle }>`
  - `grupoService.asignarBachesPorParroquia(idGrupo, asignadoPor): Promise<{ asignados }>`

- [ ] **Paso 1: Escribir las pruebas que fallan**

Crear `backend/src/services/grupo.masivo.service.spec.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repositories/grupo.repository.js', () => ({
  default: {
    contarBachesDeParroquiasDeGrupo: vi.fn(),
    findIdsBachesDeParroquiasDeGrupo: vi.fn(),
    asignarTareasMasivo: vi.fn()
  }
}));

const grupoRepository = (await import('../repositories/grupo.repository.js')).default;
const grupoService = (await import('./grupo.service.js')).default;

describe('GrupoService · asignación masiva por parroquia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('previsualizarBachesPorParroquia', () => {
    it('devuelve el desglose y el total', async () => {
      grupoRepository.contarBachesDeParroquiasDeGrupo.mockResolvedValue([
        { PAR_CODIGO: 1171, PAR_NOMBRE: 'ATOCHA – FICOA', CANTIDAD: 2 },
        { PAR_CODIGO: 1172, PAR_NOMBRE: 'CELIANO MONGE', CANTIDAD: 7 },
        { PAR_CODIGO: 1173, PAR_NOMBRE: 'HUACHI CHICO', CANTIDAD: 6 }
      ]);

      const resultado = await grupoService.previsualizarBachesPorParroquia(7);

      expect(resultado.total).toBe(15);
      expect(resultado.detalle).toHaveLength(3);
      expect(resultado.detalle[0]).toEqual({ parCodigo: 1171, parNombre: 'ATOCHA – FICOA', cantidad: 2 });
    });

    it('devuelve total 0 cuando el grupo no tiene parroquias', async () => {
      grupoRepository.contarBachesDeParroquiasDeGrupo.mockResolvedValue([]);

      const resultado = await grupoService.previsualizarBachesPorParroquia(7);

      expect(resultado).toEqual({ total: 0, detalle: [] });
    });
  });

  describe('asignarBachesPorParroquia', () => {
    it('asigna todos los baches encontrados y devuelve el conteo', async () => {
      grupoRepository.findIdsBachesDeParroquiasDeGrupo.mockResolvedValue([
        { ID: 68 }, { ID: 69 }, { ID: 70 }
      ]);
      grupoRepository.asignarTareasMasivo.mockResolvedValue(undefined);

      const resultado = await grupoService.asignarBachesPorParroquia(7, 3);

      expect(grupoRepository.asignarTareasMasivo).toHaveBeenCalledWith(7, [68, 69, 70], 3);
      expect(resultado).toEqual({ asignados: 3 });
    });

    it('no llama a la escritura si no hay baches disponibles', async () => {
      grupoRepository.findIdsBachesDeParroquiasDeGrupo.mockResolvedValue([]);

      const resultado = await grupoService.asignarBachesPorParroquia(7, 3);

      expect(grupoRepository.asignarTareasMasivo).not.toHaveBeenCalled();
      expect(resultado).toEqual({ asignados: 0 });
    });

    // El conteo devuelto debe ser el REAL al momento de asignar, no el que vio la
    // previsualización: entre una y otra pudo entrar o asignarse un bache.
    it('reporta el conteo real aunque difiera de la previsualización', async () => {
      grupoRepository.findIdsBachesDeParroquiasDeGrupo.mockResolvedValue([{ ID: 68 }]);

      const resultado = await grupoService.asignarBachesPorParroquia(7, 3);

      expect(resultado.asignados).toBe(1);
    });

    it('propaga el error si la transacción falla', async () => {
      grupoRepository.findIdsBachesDeParroquiasDeGrupo.mockResolvedValue([{ ID: 68 }]);
      grupoRepository.asignarTareasMasivo.mockRejectedValue(new Error('ORA-00060: deadlock'));

      await expect(grupoService.asignarBachesPorParroquia(7, 3)).rejects.toThrow('ORA-00060');
    });
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Ejecutar: `npm test --prefix backend`
Esperado: FALLA. Los dos métodos del servicio no existen.

- [ ] **Paso 3: Agregar los métodos del repositorio**

En `backend/src/repositories/grupo.repository.js`, agregar dentro de la clase:

```js
    // Conteo por parroquia de los baches que la asignación masiva traería. Usa EXACTAMENTE
    // el mismo criterio que findIdsBachesDeParroquiasDeGrupo: si divergen, el administrador
    // confirma un número y se asigna otro.
    async contarBachesDeParroquiasDeGrupo(idGrupo, institucion) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const result = await connection.execute(
                `SELECT r.PARROQUIA AS PAR_CODIGO,
                        (SELECT PAR_NOMBRE FROM GADMAPPS.PAR_PARROQUIAS WHERE PAR_CODIGO = r.PARROQUIA) AS PAR_NOMBRE,
                        COUNT(*) AS CANTIDAD
                 FROM GADMAPPS.OP_BACHERITO_REQ r
                 WHERE r.PARROQUIA IN (
                        SELECT PAR_CODIGO FROM GADMAPPS.OP_BACHERITO_GRUPO_PARROQUIAS WHERE ID_GRUPO = :idGrupo
                       )
                   AND r.ESTADO <> 'A'
                   AND r.INSTITUCION_RESPONSABLE = :institucion
                   AND r.ID NOT IN (SELECT ID_REQUERIMIENTO FROM GADMAPPS.OP_BACHERITO_GRUPO_TAREAS)
                 GROUP BY r.PARROQUIA
                 ORDER BY PAR_NOMBRE`,
                { idGrupo, institucion }
            );
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }

    // Mismo criterio que contarBachesDeParroquiasDeGrupo, pero devolviendo los ids a asignar.
    async findIdsBachesDeParroquiasDeGrupo(idGrupo, institucion) {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const result = await connection.execute(
                `SELECT r.ID
                 FROM GADMAPPS.OP_BACHERITO_REQ r
                 WHERE r.PARROQUIA IN (
                        SELECT PAR_CODIGO FROM GADMAPPS.OP_BACHERITO_GRUPO_PARROQUIAS WHERE ID_GRUPO = :idGrupo
                       )
                   AND r.ESTADO <> 'A'
                   AND r.INSTITUCION_RESPONSABLE = :institucion
                   AND r.ID NOT IN (SELECT ID_REQUERIMIENTO FROM GADMAPPS.OP_BACHERITO_GRUPO_TAREAS)
                 ORDER BY r.FECHA_INGRESO DESC`,
                { idGrupo, institucion }
            );
            return result.rows;
        } finally {
            if (connection) await connection.close();
        }
    }

    // Asigna N baches al grupo en UNA sola transacción: entran todos o ninguno.
    // Misma semántica que asignarTarea, extendida a varias filas.
    async asignarTareasMasivo(idGrupo, idsRequerimiento, asignadoPor) {
        let connection;
        try {
            connection = await oracledb.getConnection();

            for (const idRequerimiento of idsRequerimiento) {
                await connection.execute(
                    `INSERT INTO GADMAPPS.OP_BACHERITO_GRUPO_TAREAS (ID_GRUPO, ID_REQUERIMIENTO, ASIGNADO_POR)
                     VALUES (:idGrupo, :idRequerimiento, :asignadoPor)`,
                    { idGrupo, idRequerimiento, asignadoPor },
                    { autoCommit: false }
                );

                await connection.execute(
                    `UPDATE GADMAPPS.OP_BACHERITO_REQ SET ESTADO = 'R' WHERE ID = :idRequerimiento`,
                    { idRequerimiento },
                    { autoCommit: false }
                );
            }

            await connection.commit();
        } catch (error) {
            if (connection) await connection.rollback();
            throw error;
        } finally {
            if (connection) await connection.close();
        }
    }
```

- [ ] **Paso 4: Agregar los métodos del servicio**

En `backend/src/services/grupo.service.js`, agregar dentro de la clase:

```js
    // Desglose por parroquia de lo que traería la asignación masiva, para que el
    // administrador vea el alcance antes de confirmar (asignar cambia el estado real).
    async previsualizarBachesPorParroquia(idGrupo) {
        const filas = await grupoRepository.contarBachesDeParroquiasDeGrupo(idGrupo, INSTITUCION_BACHERITO);
        const detalle = ConteoParroquiaModel.fromDatabaseArray(filas);
        const total = detalle.reduce((suma, fila) => suma + fila.cantidad, 0);
        return { total, detalle };
    }

    // Asigna al grupo todos los baches pendientes de sus parroquias. El conteo devuelto es
    // el REAL al momento de asignar, que puede diferir del que mostró la previsualización.
    async asignarBachesPorParroquia(idGrupo, asignadoPor) {
        const filas = await grupoRepository.findIdsBachesDeParroquiasDeGrupo(idGrupo, INSTITUCION_BACHERITO);
        const ids = filas.map(fila => fila.ID);

        if (ids.length === 0) {
            return { asignados: 0 };
        }

        await grupoRepository.asignarTareasMasivo(idGrupo, ids, asignadoPor);
        return { asignados: ids.length };
    }
```

- [ ] **Paso 5: Ejecutar y verificar que pasan**

Ejecutar: `npm test --prefix backend`
Esperado: PASA (14 pruebas en total, 9 de la Tarea 2 + 5 de esta).

- [ ] **Paso 6: Commit**

```bash
git add backend/src/repositories/grupo.repository.js backend/src/services/grupo.service.js backend/src/services/grupo.masivo.service.spec.js
git commit -m "feat: previsualizar y asignar en bloque los baches de las parroquias del grupo"
```

---

## Tarea 4: Backend — controlador y rutas

**Archivos:**
- Modificar: `backend/src/controllers/grupo.controller.js`
- Modificar: `backend/src/routes/grupo.routes.js`

**Interfaces:**
- Consume: los métodos del servicio de las Tareas 2 y 3.
- Produce: los 6 endpoints que consume el frontend en la Tarea 5.

- [ ] **Paso 1: Agregar los métodos del controlador**

En `backend/src/controllers/grupo.controller.js`, agregar dentro de la clase:

```js
    async parroquiasDeGrupo(req, res, next) {
        try {
            const data = await grupoService.obtenerParroquiasDeGrupo(req.params.id);
            return res.status(200).json({ success: true, data });
        } catch (error) {
            next(error);
        }
    }

    async parroquiasDisponibles(req, res, next) {
        try {
            const data = await grupoService.obtenerParroquiasDisponibles();
            return res.status(200).json({ success: true, data });
        } catch (error) {
            next(error);
        }
    }

    async asignarParroquias(req, res, next) {
        try {
            await grupoService.asignarParroquias(req.params.id, req.body.parroquias, req.usuario.sub);
            return res.status(201).json({ success: true, message: 'Parroquias asignadas al grupo.' });
        } catch (error) {
            if (error.message.startsWith('VALIDACION_FALLIDA')) {
                return res.status(400).json({ success: false, message: error.message.replace('VALIDACION_FALLIDA: ', '') });
            }
            if (error.message === 'PARROQUIA_YA_ASIGNADA') {
                return res.status(409).json({ success: false, message: 'Alguna de esas parroquias ya está a cargo de otro grupo.' });
            }
            next(error);
        }
    }

    async quitarParroquia(req, res, next) {
        try {
            await grupoService.quitarParroquia(req.params.id, req.params.codigo);
            return res.status(200).json({ success: true, message: 'Parroquia removida del grupo.' });
        } catch (error) {
            if (error.message === 'PARROQUIA_NO_ENCONTRADA') {
                return res.status(404).json({ success: false, message: 'Esa parroquia no está asignada a este grupo.' });
            }
            next(error);
        }
    }

    async previsualizarBachesPorParroquia(req, res, next) {
        try {
            const data = await grupoService.previsualizarBachesPorParroquia(req.params.id);
            return res.status(200).json({ success: true, data });
        } catch (error) {
            next(error);
        }
    }

    async asignarBachesPorParroquia(req, res, next) {
        try {
            const data = await grupoService.asignarBachesPorParroquia(req.params.id, req.usuario.sub);
            return res.status(201).json({ success: true, message: `Se asignaron ${data.asignados} baches al grupo.`, data });
        } catch (error) {
            next(error);
        }
    }
```

- [ ] **Paso 2: Registrar las rutas en el orden correcto**

En `backend/src/routes/grupo.routes.js`:

**2a.** Agregar la ruta literal **junto a las otras literales**, es decir **antes** de `router.get('/grupos/:id', ...)`. Insertarla justo después de la línea de `/grupos/tecnicos`:

```js
router.get('/grupos/parroquias-disponibles', soloAsignarGrupo, grupoController.parroquiasDisponibles);
```

> ⚠️ Si esta línea queda **después** de `/grupos/:id`, Express la resolverá como `:id = 'parroquias-disponibles'` y el endpoint nunca se alcanzará. El proyecto ya usa este patrón con `/resumen`, `/mapa` y `/tecnicos`.

**2b.** Agregar las rutas con `:id` al final, antes del `export default`:

```js
router.get('/grupos/:id/parroquias', soloAsignarGrupo, grupoController.parroquiasDeGrupo);
router.post('/grupos/:id/parroquias', soloAsignarGrupo, grupoController.asignarParroquias);
router.delete('/grupos/:id/parroquias/:codigo', soloAsignarGrupo, grupoController.quitarParroquia);
router.get('/grupos/:id/baches-por-parroquia', soloAsignarGrupo, grupoController.previsualizarBachesPorParroquia);
router.post('/grupos/:id/tareas/por-parroquia', soloAsignarGrupo, grupoController.asignarBachesPorParroquia);
```

> ⚠️ `/grupos/:id/tareas/por-parroquia` debe ir **antes** de `router.post('/grupos/:id/tareas', ...)`? No: son rutas distintas (`/tareas/por-parroquia` tiene un segmento más), así que Express las distingue sin ambigüedad. No hace falta reordenar las existentes.

- [ ] **Paso 3: Verificar que el servidor arranca**

Ejecutar: `node --check backend/src/routes/grupo.routes.js && node --check backend/src/controllers/grupo.controller.js`
Esperado: sin errores de sintaxis.

Ejecutar: `npm test --prefix backend`
Esperado: las 14 pruebas siguen pasando.

- [ ] **Paso 4: Commit**

```bash
git add backend/src/controllers/grupo.controller.js backend/src/routes/grupo.routes.js
git commit -m "feat: exponer los endpoints de parroquias y asignacion masiva del grupo"
```

---

## Tarea 5: Frontend — servicio y tipos

**Archivos:**
- Modificar: `frontend/src/app/features/admin/asignar-grupo/asignar-grupo.service.ts`
- Crear: `frontend/src/app/features/admin/asignar-grupo/asignar-grupo.service.spec.ts`

**Interfaces:**
- Consume: los 6 endpoints de la Tarea 4.
- Produce (los consumen las Tareas 6 y 7):
  - `interface ParroquiaGrupo { parCodigo: number; parNombre: string }`
  - `interface ConteoParroquia { parCodigo: number; parNombre: string; cantidad: number }`
  - `interface PrevisualizacionBaches { total: number; detalle: ConteoParroquia[] }`
  - `AsignarGrupoService.listarParroquiasDeGrupo(idGrupo)`, `listarParroquiasDisponibles()`, `asignarParroquias(idGrupo, parroquias)`, `quitarParroquia(idGrupo, parCodigo)`, `previsualizarBachesPorParroquia(idGrupo)`, `asignarBachesPorParroquia(idGrupo)`

- [ ] **Paso 1: Escribir las pruebas que fallan**

Crear `frontend/src/app/features/admin/asignar-grupo/asignar-grupo.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { AsignarGrupoService } from './asignar-grupo.service';

describe('AsignarGrupoService · parroquias del grupo', () => {
  let servicio: AsignarGrupoService;
  let httpFalso: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    httpFalso = {
      get: vi.fn(() => of({ success: true, data: [] })),
      post: vi.fn(() => of({ success: true, message: 'ok' })),
      delete: vi.fn(() => of({ success: true, message: 'ok' }))
    };

    TestBed.configureTestingModule({
      providers: [AsignarGrupoService, { provide: HttpClient, useValue: httpFalso }]
    });
    servicio = TestBed.inject(AsignarGrupoService);
  });

  it('pide las parroquias del grupo a la ruta correcta', async () => {
    await firstValueFrom(servicio.listarParroquiasDeGrupo(7));
    expect(httpFalso.get).toHaveBeenCalledWith(expect.stringContaining('/grupos/7/parroquias'));
  });

  it('pide las parroquias disponibles a la ruta literal, no a la de :id', async () => {
    await firstValueFrom(servicio.listarParroquiasDisponibles());
    expect(httpFalso.get).toHaveBeenCalledWith(expect.stringContaining('/grupos/parroquias-disponibles'));
  });

  it('envia el arreglo de parroquias en el cuerpo', async () => {
    await firstValueFrom(servicio.asignarParroquias(7, [1171, 1172]));
    expect(httpFalso.post).toHaveBeenCalledWith(
      expect.stringContaining('/grupos/7/parroquias'),
      { parroquias: [1171, 1172] }
    );
  });

  it('quita una parroquia por su codigo', async () => {
    await firstValueFrom(servicio.quitarParroquia(7, 1171));
    expect(httpFalso.delete).toHaveBeenCalledWith(expect.stringContaining('/grupos/7/parroquias/1171'));
  });

  it('pide la previsualizacion a baches-por-parroquia', async () => {
    httpFalso.get.mockReturnValue(of({ success: true, data: { total: 15, detalle: [] } }));
    const respuesta = await firstValueFrom(servicio.previsualizarBachesPorParroquia(7));
    expect(httpFalso.get).toHaveBeenCalledWith(expect.stringContaining('/grupos/7/baches-por-parroquia'));
    expect(respuesta.data.total).toBe(15);
  });

  it('dispara la asignacion masiva a tareas/por-parroquia', async () => {
    httpFalso.post.mockReturnValue(of({ success: true, message: 'ok', data: { asignados: 15 } }));
    const respuesta = await firstValueFrom(servicio.asignarBachesPorParroquia(7));
    expect(httpFalso.post).toHaveBeenCalledWith(expect.stringContaining('/grupos/7/tareas/por-parroquia'), {});
    expect(respuesta.data.asignados).toBe(15);
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Ejecutar: `npm test -- asignar-grupo.service --prefix frontend`
Esperado: FALLA. Los métodos no existen.

- [ ] **Paso 3: Agregar interfaces y métodos**

En `frontend/src/app/features/admin/asignar-grupo/asignar-grupo.service.ts`, agregar las interfaces junto a las existentes:

```ts
export interface ParroquiaGrupo {
  parCodigo: number;
  parNombre: string;
}

export interface ConteoParroquia {
  parCodigo: number;
  parNombre: string;
  cantidad: number;
}

export interface PrevisualizacionBaches {
  total: number;
  detalle: ConteoParroquia[];
}

interface RespuestaParroquias {
  success: boolean;
  data: ParroquiaGrupo[];
}

interface RespuestaPrevisualizacion {
  success: boolean;
  data: PrevisualizacionBaches;
}

interface RespuestaAsignacionMasiva {
  success: boolean;
  message: string;
  data: { asignados: number };
}
```

Y los métodos dentro de la clase:

```ts
  listarParroquiasDeGrupo(idGrupo: number): Observable<RespuestaParroquias> {
    return this.http.get<RespuestaParroquias>(`${this.API_URL}/${idGrupo}/parroquias`);
  }

  // Solo las que no tiene ningún grupo: así el administrador no puede elegir una ya tomada.
  listarParroquiasDisponibles(): Observable<RespuestaParroquias> {
    return this.http.get<RespuestaParroquias>(`${this.API_URL}/parroquias-disponibles`);
  }

  asignarParroquias(idGrupo: number, parroquias: number[]): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.API_URL}/${idGrupo}/parroquias`, { parroquias });
  }

  quitarParroquia(idGrupo: number, parCodigo: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.API_URL}/${idGrupo}/parroquias/${parCodigo}`);
  }

  // Desglose de lo que traería la asignación masiva, sin ejecutarla.
  previsualizarBachesPorParroquia(idGrupo: number): Observable<RespuestaPrevisualizacion> {
    return this.http.get<RespuestaPrevisualizacion>(`${this.API_URL}/${idGrupo}/baches-por-parroquia`);
  }

  asignarBachesPorParroquia(idGrupo: number): Observable<RespuestaAsignacionMasiva> {
    return this.http.post<RespuestaAsignacionMasiva>(`${this.API_URL}/${idGrupo}/tareas/por-parroquia`, {});
  }
```

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Ejecutar: `npm test -- asignar-grupo.service --prefix frontend`
Esperado: PASA (6 pruebas).

Ejecutar: `npm test --prefix frontend`
Esperado: todo verde (43 previas + 6 nuevas = 49).

- [ ] **Paso 5: Commit**

```bash
git add frontend/src/app/features/admin/asignar-grupo/asignar-grupo.service.ts frontend/src/app/features/admin/asignar-grupo/asignar-grupo.service.spec.ts
git commit -m "feat: agregar al servicio de grupos las llamadas de parroquias y asignacion masiva"
```

---

## Tarea 6: Frontend — bloque "Parroquias a cargo"

**Archivos:**
- Modificar: `frontend/src/app/features/admin/grupo-detalle/grupo-detalle.ts`
- Modificar: `frontend/src/app/features/admin/grupo-detalle/grupo-detalle.html`

**Interfaces:**
- Consume: `listarParroquiasDeGrupo`, `listarParroquiasDisponibles`, `asignarParroquias`, `quitarParroquia` de la Tarea 5.

- [ ] **Paso 1: Agregar el estado y los métodos al componente**

En `grupo-detalle.ts`, extender el import del servicio:

```ts
import { AsignarGrupoService, BacheDisponible, GrupoDetalle, TecnicoGrupo, ParroquiaGrupo } from '../asignar-grupo/asignar-grupo.service';
```

Agregar los signals junto a los existentes:

```ts
  parroquiasDelGrupo = signal<ParroquiaGrupo[]>([]);
  parroquiasDisponibles = signal<ParroquiaGrupo[]>([]);
  mostrarPickerParroquias = signal(false);
  parroquiasSeleccionadas = signal<number[]>([]);
  guardandoParroquias = signal(false);
  quitandoParroquia = signal<number | null>(null);
```

Y los métodos dentro de la clase:

```ts
  private async cargarParroquiasDelGrupo() {
    const respuesta = await firstValueFrom(this.asignarGrupoService.listarParroquiasDeGrupo(this.idGrupo));
    this.parroquiasDelGrupo.set(respuesta.data);
  }

  async abrirPickerParroquias() {
    this.error.set(null);
    this.parroquiasSeleccionadas.set([]);
    const respuesta = await firstValueFrom(this.asignarGrupoService.listarParroquiasDisponibles());
    this.parroquiasDisponibles.set(respuesta.data);
    this.mostrarPickerParroquias.set(true);
  }

  cerrarPickerParroquias() {
    this.mostrarPickerParroquias.set(false);
  }

  alternarParroquia(parCodigo: number) {
    const actuales = this.parroquiasSeleccionadas();
    this.parroquiasSeleccionadas.set(
      actuales.includes(parCodigo) ? actuales.filter(c => c !== parCodigo) : [...actuales, parCodigo]
    );
  }

  async guardarParroquias() {
    if (this.parroquiasSeleccionadas().length === 0) return;

    this.guardandoParroquias.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.asignarGrupoService.asignarParroquias(this.idGrupo, this.parroquiasSeleccionadas()));
      await this.cargarParroquiasDelGrupo();
      this.mostrarPickerParroquias.set(false);
    } catch (error: any) {
      this.error.set(error?.error?.message ?? 'No se pudieron asignar las parroquias.');
    }
    this.guardandoParroquias.set(false);
  }

  // Quitar la parroquia solo cambia el territorio del grupo: los baches que ya se le
  // asignaron se quedan con él, porque puede haber un técnico con el trabajo en curso.
  async quitarParroquia(parCodigo: number) {
    this.quitandoParroquia.set(parCodigo);
    this.error.set(null);
    try {
      await firstValueFrom(this.asignarGrupoService.quitarParroquia(this.idGrupo, parCodigo));
      await this.cargarParroquiasDelGrupo();
    } catch (error: any) {
      this.error.set(error?.error?.message ?? 'No se pudo quitar la parroquia.');
    }
    this.quitandoParroquia.set(null);
  }
```

Llamar `await this.cargarParroquiasDelGrupo();` dentro del `ngOnInit`, después de la carga del grupo que ya existe.

Si `firstValueFrom` no está importado en el archivo, agregarlo: `import { firstValueFrom } from 'rxjs';`

- [ ] **Paso 2: Agregar el bloque a la plantilla**

En `grupo-detalle.html`, insertar antes del bloque de técnicos:

```html
<!-- Parroquias a cargo -->
<div class="mt-6">
  <div class="flex items-center justify-between mb-2">
    <h3 class="text-base font-bold text-text">Parroquias a cargo</h3>
    <button
      type="button"
      (click)="abrirPickerParroquias()"
      class="flex items-center gap-1 text-sm font-semibold text-success">
      <mat-icon class="!text-base !h-4 !w-4">add</mat-icon>
      Agregar
    </button>
  </div>

  @if (parroquiasDelGrupo().length === 0) {
    <p class="text-sm text-text-muted">
      Este grupo todavía no tiene parroquias a cargo. Agrégalas para poder traer sus baches.
    </p>
  } @else {
    <div class="flex flex-wrap gap-2">
      @for (parroquia of parroquiasDelGrupo(); track parroquia.parCodigo) {
        <span class="flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary">
          {{ parroquia.parNombre }}
          <button
            type="button"
            (click)="quitarParroquia(parroquia.parCodigo)"
            [disabled]="quitandoParroquia() === parroquia.parCodigo"
            class="transition-all active:scale-90 disabled:opacity-50"
            [attr.aria-label]="'Quitar ' + parroquia.parNombre">
            <mat-icon class="!text-sm !h-4 !w-4">close</mat-icon>
          </button>
        </span>
      }
    </div>
  }
</div>

<!-- Selector de parroquias -->
@if (mostrarPickerParroquias()) {
  <div class="fixed inset-0 z-[500] flex items-center justify-center px-6">
    <div class="absolute inset-0 bg-black/50" (click)="cerrarPickerParroquias()" aria-hidden="true"></div>

    <div class="relative z-10 w-full max-w-sm rounded-3xl bg-surface p-6 shadow-2xl">
      <h3 class="text-lg font-bold text-text">Agregar parroquias</h3>
      <p class="mt-1 text-sm text-text-muted">
        Solo aparecen las parroquias que no están a cargo de ningún otro grupo.
      </p>

      @if (parroquiasDisponibles().length === 0) {
        <p class="mt-4 text-sm text-text-muted">No quedan parroquias libres.</p>
      } @else {
        <div class="mt-4 max-h-64 overflow-y-auto flex flex-col gap-1">
          @for (parroquia of parroquiasDisponibles(); track parroquia.parCodigo) {
            <button
              type="button"
              (click)="alternarParroquia(parroquia.parCodigo)"
              class="flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-all hover:bg-surface-alt"
              [class.bg-primary-soft]="parroquiasSeleccionadas().includes(parroquia.parCodigo)">
              <span class="text-text">{{ parroquia.parNombre }}</span>
              @if (parroquiasSeleccionadas().includes(parroquia.parCodigo)) {
                <mat-icon class="!text-lg !h-5 !w-5 text-primary">check_circle</mat-icon>
              }
            </button>
          }
        </div>
      }

      <div class="mt-6 flex gap-3">
        <button
          type="button"
          (click)="cerrarPickerParroquias()"
          class="flex-1 rounded-xl bg-surface-alt px-4 py-3 text-sm font-semibold text-text">
          Cancelar
        </button>
        <button
          type="button"
          (click)="guardarParroquias()"
          [disabled]="parroquiasSeleccionadas().length === 0 || guardandoParroquias()"
          class="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary disabled:opacity-50">
          {{ guardandoParroquias() ? 'Guardando...' : 'Agregar' }}
        </button>
      </div>
    </div>
  </div>
}
```

- [ ] **Paso 3: Verificar que compila y que la suite sigue verde**

Ejecutar: `npm run build --prefix frontend`
Esperado: compila sin errores.

Ejecutar: `npm test --prefix frontend`
Esperado: 49 pruebas verdes.

- [ ] **Paso 4: Commit**

```bash
git add frontend/src/app/features/admin/grupo-detalle
git commit -m "feat: administrar las parroquias a cargo desde el detalle del grupo"
```

---

## Tarea 7: Frontend — bloque "Traer baches" con previsualización

**Archivos:**
- Modificar: `frontend/src/app/features/admin/grupo-detalle/grupo-detalle.ts`
- Modificar: `frontend/src/app/features/admin/grupo-detalle/grupo-detalle.html`

**Interfaces:**
- Consume: `previsualizarBachesPorParroquia`, `asignarBachesPorParroquia` de la Tarea 5, y `parroquiasDelGrupo` de la Tarea 6.

- [ ] **Paso 1: Agregar el estado y los métodos**

En `grupo-detalle.ts`, extender el import:

```ts
import { AsignarGrupoService, BacheDisponible, GrupoDetalle, TecnicoGrupo, ParroquiaGrupo, PrevisualizacionBaches } from '../asignar-grupo/asignar-grupo.service';
```

Agregar los signals:

```ts
  previsualizacion = signal<PrevisualizacionBaches | null>(null);
  cargandoPrevisualizacion = signal(false);
  asignandoMasivo = signal(false);
  mensajeMasivo = signal<string | null>(null);
```

Y los métodos:

```ts
  // Asignar cambia el estado real de cada bache a 'Reasignado', así que el administrador
  // ve primero el desglose y recién después confirma.
  async abrirPrevisualizacion() {
    this.mensajeMasivo.set(null);
    this.error.set(null);
    this.cargandoPrevisualizacion.set(true);
    try {
      const respuesta = await firstValueFrom(this.asignarGrupoService.previsualizarBachesPorParroquia(this.idGrupo));
      this.previsualizacion.set(respuesta.data);
    } catch (error: any) {
      this.error.set(error?.error?.message ?? 'No se pudo consultar los baches de tus parroquias.');
    }
    this.cargandoPrevisualizacion.set(false);
  }

  cerrarPrevisualizacion() {
    this.previsualizacion.set(null);
  }

  async confirmarAsignacionMasiva() {
    this.asignandoMasivo.set(true);
    this.error.set(null);
    try {
      const respuesta = await firstValueFrom(this.asignarGrupoService.asignarBachesPorParroquia(this.idGrupo));
      // El conteo del servidor es el real al momento de asignar: puede diferir del previsualizado.
      this.mensajeMasivo.set(`Se asignaron ${respuesta.data.asignados} baches al grupo.`);
      this.previsualizacion.set(null);
      // cargarGrupo() ya existe en el componente (grupo-detalle.ts:68) y NO es async:
      // usa .subscribe() internamente. Llamarlo sin await — ponerle await esperaría
      // undefined y daría una falsa sensación de que la recarga terminó.
      this.cargarGrupo();
    } catch (error: any) {
      this.error.set(error?.error?.message ?? 'No se pudieron asignar los baches.');
    }
    this.asignandoMasivo.set(false);
  }
```

- [ ] **Paso 2: Agregar el bloque y el modal a la plantilla**

En `grupo-detalle.html`, justo después del bloque de parroquias de la Tarea 6:

```html
<!-- Traer baches de las parroquias del grupo -->
<div class="mt-4">
  @if (mensajeMasivo(); as mensaje) {
    <div class="mb-3 flex items-center gap-2 rounded-2xl bg-success-bg px-4 py-3">
      <mat-icon class="!text-xl text-success">check_circle</mat-icon>
      <span class="text-sm font-medium text-success">{{ mensaje }}</span>
    </div>
  }

  <button
    type="button"
    (click)="abrirPrevisualizacion()"
    [disabled]="parroquiasDelGrupo().length === 0 || cargandoPrevisualizacion()"
    class="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary transition-all active:scale-[0.98] disabled:opacity-50">
    <mat-icon class="!text-lg !h-5 !w-5">playlist_add</mat-icon>
    {{ cargandoPrevisualizacion() ? 'Consultando...' : 'Traer baches de mis parroquias' }}
  </button>

  @if (parroquiasDelGrupo().length === 0) {
    <p class="mt-2 text-xs font-medium text-text-muted">
      Primero asigna al menos una parroquia a este grupo.
    </p>
  }
</div>

<!-- Previsualización de la asignación masiva -->
@if (previsualizacion(); as previa) {
  <div class="fixed inset-0 z-[500] flex items-center justify-center px-6">
    <div class="absolute inset-0 bg-black/50" (click)="cerrarPrevisualizacion()" aria-hidden="true"></div>

    <div class="relative z-10 w-full max-w-sm rounded-3xl bg-surface p-6 shadow-2xl" role="alertdialog" aria-modal="true">
      <h3 class="text-lg font-bold text-text">Traer baches de tus parroquias</h3>

      @if (previa.total === 0) {
        <p class="mt-3 text-sm text-text-muted">No hay baches pendientes en tus parroquias.</p>
        <button
          type="button"
          (click)="cerrarPrevisualizacion()"
          class="mt-6 w-full rounded-xl bg-surface-alt px-4 py-3 text-sm font-semibold text-text">
          Entendido
        </button>
      } @else {
        <div class="mt-4 flex flex-col gap-1.5">
          @for (fila of previa.detalle; track fila.parCodigo) {
            <div class="flex items-center justify-between text-sm">
              <span class="text-text-muted">{{ fila.parNombre }}</span>
              <span class="font-semibold text-text">{{ fila.cantidad }}</span>
            </div>
          }
          <div class="mt-2 flex items-center justify-between border-t border-black/10 pt-2 text-sm">
            <span class="font-bold text-text">Total</span>
            <span class="font-extrabold text-text">{{ previa.total }}</span>
          </div>
        </div>

        <p class="mt-4 text-xs text-text-muted">
          Se asignarán a este grupo y pasarán a estado "Reasignado".
        </p>

        <div class="mt-6 flex gap-3">
          <button
            type="button"
            (click)="cerrarPrevisualizacion()"
            class="flex-1 rounded-xl bg-surface-alt px-4 py-3 text-sm font-semibold text-text">
            Cancelar
          </button>
          <button
            type="button"
            (click)="confirmarAsignacionMasiva()"
            [disabled]="asignandoMasivo()"
            class="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary disabled:opacity-50">
            {{ asignandoMasivo() ? 'Asignando...' : 'Asignar ' + previa.total }}
          </button>
        </div>
      }
    </div>
  </div>
}
```

- [ ] **Paso 3: Verificar que compila y que la suite sigue verde**

Ejecutar: `npm run build --prefix frontend`
Esperado: compila sin errores.

Ejecutar: `npm test --prefix frontend`
Esperado: 49 pruebas verdes.

- [ ] **Paso 4: Commit**

```bash
git add frontend/src/app/features/admin/grupo-detalle
git commit -m "feat: traer en bloque los baches de las parroquias del grupo con previsualizacion"
```

---

## Tarea 8: Reporte de entrega

**Archivos:**
- Crear: `contexto_claude/reportes/2026-08-02-grupo-parroquias.md`

> ⚠️ **La QA manual contra producción NO se ejecuta en esta tarea.** La asignación masiva cambia el estado de baches reales y requiere autorización explícita del usuario. Esta tarea solo deja el reporte y las instrucciones listas.

- [ ] **Paso 1: Escribir el reporte**

Crear `contexto_claude/reportes/2026-08-02-grupo-parroquias.md` con:
- Archivos creados y modificados
- El contrato implementado (las 6 rutas con su forma de entrada y salida, y las firmas del servicio)
- Resultado real de `npm test` en backend y en frontend (pegar la salida, no describirla)
- Resultado real de `npm run build`
- El script SQL entregado y el recordatorio de que lo debe correr el usuario
- Qué quedó fuera y por qué

- [ ] **Paso 2: Dejar escritas las instrucciones de QA manual**

Incluir en el reporte, como sección aparte, los pasos que el usuario debe autorizar y ejecutar:

1. Correr `database/grupo_parroquias_setup.sql` contra Oracle.
2. Crear GRUPO_A con dos técnicos y GRUPO_B con el tercero.
3. Asignar 1171/1172/1173 al GRUPO_A y 1175/1176/1177 al GRUPO_B.
4. Comprobar que al intentar asignar 1171 al GRUPO_B el sistema lo rechaza con 409.
5. Previsualizar en GRUPO_A: debe mostrar el desglose por parroquia y un total.
6. Confirmar y verificar en Oracle que `OP_BACHERITO_GRUPO_TAREAS` recibió las filas y que esos baches quedaron en `ESTADO='R'`.
7. Quitar una parroquia del GRUPO_A y comprobar que **los baches ya asignados siguen en el grupo** (decisión D2).

- [ ] **Paso 3: Commit**

```bash
git add contexto_claude/reportes/2026-08-02-grupo-parroquias.md
git commit -m "docs: agregar reporte de entrega de grupos con parroquias"
```

---

## Criterios de aceptación (checklist final)

- [ ] Existe `database/grupo_parroquias_setup.sql`, entregado y **no ejecutado**
- [ ] `npm test` existe y pasa en `backend/` (14 pruebas)
- [ ] `npm test` pasa en `frontend/` (49 pruebas)
- [ ] `npm run build` compila sin errores
- [ ] Un grupo puede tener N parroquias; el `UNIQUE` de Oracle impide que una esté en dos grupos
- [ ] El selector solo ofrece parroquias libres
- [ ] Quitar una parroquia no invoca ninguna baja de tareas
- [ ] La previsualización muestra desglose por parroquia y total
- [ ] Confirmar asigna en una transacción y devuelve el conteo real
- [ ] Previsualización y asignación comparten el criterio de selección
- [ ] El botón está deshabilitado, con razón visible, si el grupo no tiene parroquias
- [ ] `/grupos/parroquias-disponibles` está declarada antes de `/grupos/:id`
