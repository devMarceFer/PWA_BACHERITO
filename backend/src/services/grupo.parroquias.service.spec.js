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
