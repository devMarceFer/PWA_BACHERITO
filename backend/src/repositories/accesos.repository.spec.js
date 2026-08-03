import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('oracledb', () => ({
  default: {
    getConnection: vi.fn()
  }
}));

const oracledb = (await import('oracledb')).default;
const accesosRepository = (await import('./accesos.repository.js')).default;

// Conexión simulada con los cuatro métodos que usa otorgarAccesos: execute, commit,
// rollback y close. Cada prueba encadena mockResolvedValueOnce/mockRejectedValueOnce
// sobre `execute` en el mismo orden en que el repositorio los invoca (SELECT, luego
// UPDATE de reactivación, luego INSERT), para ejercitar la lógica SQL real de los tres
// caminos sin tocar Oracle.
function crearConexionMock() {
  const connection = {
    execute: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined)
  };
  oracledb.getConnection.mockResolvedValue(connection);
  return connection;
}

describe('AccesosRepository · otorgarAccesos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('si el par ya esta activo, no ejecuta UPDATE ni INSERT y no suma al conteo', async () => {
    const connection = crearConexionMock();
    // SELECT encuentra una fila activa.
    connection.execute.mockResolvedValueOnce({ rows: [{ ID_UMR: 1 }] });

    const resultado = await accesosRepository.otorgarAccesos(22, [{ idModulo: 1, idRol: 21 }], 21);

    expect(connection.execute).toHaveBeenCalledTimes(1);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(resultado).toEqual({ otorgados: 0, reactivados: 0 });
  });

  it('si el par esta revocado, ejecuta el UPDATE de reactivacion y NO el INSERT', async () => {
    const connection = crearConexionMock();
    connection.execute
      // SELECT: no hay fila activa.
      .mockResolvedValueOnce({ rows: [] })
      // UPDATE de reactivación: afecta una fila.
      .mockResolvedValueOnce({ rowsAffected: 1 });

    const resultado = await accesosRepository.otorgarAccesos(22, [{ idModulo: 1, idRol: 21 }], 21);

    expect(connection.execute).toHaveBeenCalledTimes(2);
    expect(connection.execute.mock.calls[1][0]).toMatch(/UPDATE/);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(resultado).toEqual({ otorgados: 0, reactivados: 1 });
  });

  it('si el par no existe, ejecuta el INSERT y devuelve otorgados: 1', async () => {
    const connection = crearConexionMock();
    connection.execute
      // SELECT: no hay fila activa.
      .mockResolvedValueOnce({ rows: [] })
      // UPDATE de reactivación: no afecta nada (no había fila revocada).
      .mockResolvedValueOnce({ rowsAffected: 0 })
      // INSERT: entra sin problema.
      .mockResolvedValueOnce({ rowsAffected: 1 });

    const resultado = await accesosRepository.otorgarAccesos(22, [{ idModulo: 1, idRol: 21 }], 21);

    expect(connection.execute).toHaveBeenCalledTimes(3);
    expect(connection.execute.mock.calls[2][0]).toMatch(/INSERT/);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(resultado).toEqual({ otorgados: 1, reactivados: 0 });
  });

  // El caso de la corrección: dos transacciones casi simultáneas otorgan el mismo par
  // nuevo. Ambas pasan el SELECT sin encontrar nada; la que confirma segunda choca en
  // el INSERT contra UK_USUARIO_MODULO_ROL con ORA-00001. Ese par se ignora (no se
  // cuenta), pero la transacción sigue adelante: se llama a commit(), nunca a
  // rollback(), y el método devuelve normalmente en vez de propagar el error.
  it('si el INSERT choca con ORA-00001, ignora el par, comitea y no hace rollback', async () => {
    const connection = crearConexionMock();
    const errorDuplicado = Object.assign(new Error('ORA-00001: unique constraint violated'), { errorNum: 1 });
    connection.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rowsAffected: 0 })
      .mockRejectedValueOnce(errorDuplicado);

    const resultado = await accesosRepository.otorgarAccesos(22, [{ idModulo: 1, idRol: 21 }], 21);

    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(resultado).toEqual({ otorgados: 0, reactivados: 0 });
  });

  it('si el INSERT falla con otro error, hace rollback y relanza', async () => {
    const connection = crearConexionMock();
    const errorReal = Object.assign(new Error('ORA-12899: value too large'), { errorNum: 12899 });
    connection.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rowsAffected: 0 })
      .mockRejectedValueOnce(errorReal);

    await expect(
      accesosRepository.otorgarAccesos(22, [{ idModulo: 1, idRol: 21 }], 21)
    ).rejects.toThrow('ORA-12899');

    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
  });
});
