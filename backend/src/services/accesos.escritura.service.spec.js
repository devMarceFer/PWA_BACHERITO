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
