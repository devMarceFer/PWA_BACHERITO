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
