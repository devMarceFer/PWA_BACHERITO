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
