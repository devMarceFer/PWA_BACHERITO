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
