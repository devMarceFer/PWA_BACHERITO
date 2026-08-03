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
