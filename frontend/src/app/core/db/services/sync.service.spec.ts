import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { SyncService } from './sync.service';
import { dbLocal, ReporteOffline } from '../offline-db';

function reporteDePrueba(sufijo: number): ReporteOffline {
  return {
    NOMBRES: `Vecino ${sufijo}`,
    CEDULA: '1804567890',
    TELEFONO: '0999999999',
    PARROQUIA: 1,
    COORDENADAX: '-78.62722',
    COORDENADAY: '-1.24908',
    X: null,
    Y: null,
    ESTADO: 'N',
    FECHA_INGRESO: 1754150400000,
    FOTOGRAFIA: 'data:image/png;base64,AAAA',
    NOMBRE_IMAGEN: `${sufijo}_test_bache_ant.png`,
    SINCRONIZADO: 0
  };
}

describe('SyncService', () => {
  let servicio: SyncService;
  let httpFalso: { post: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    await dbLocal.reportesOff.clear();
    httpFalso = { post: vi.fn(() => of({ success: true })) };

    TestBed.configureTestingModule({
      providers: [SyncService, { provide: HttpClient, useValue: httpFalso }]
    });
    servicio = TestBed.inject(SyncService);
  });

  it('no hace ninguna petición si no hay pendientes', async () => {
    const resultado = await servicio.sincronizarReportesPendientes();

    expect(httpFalso.post).not.toHaveBeenCalled();
    expect(resultado).toEqual({ enviados: 0, fallidos: 0 });
  });

  it('conserva la fila con SINCRONIZADO=1 y sin la foto en base64', async () => {
    await dbLocal.reportesOff.add(reporteDePrueba(1));

    const resultado = await servicio.sincronizarReportesPendientes();

    expect(resultado).toEqual({ enviados: 1, fallidos: 0 });
    const filas = await dbLocal.reportesOff.toArray();
    expect(filas).toHaveLength(1);           // no se borra
    expect(filas[0].SINCRONIZADO).toBe(1);
    expect(filas[0].FOTOGRAFIA).toBeNull();  // se libera el base64
  });

  it('deja en cola lo que falló y sube lo que sí pudo', async () => {
    await dbLocal.reportesOff.add(reporteDePrueba(1));
    await dbLocal.reportesOff.add(reporteDePrueba(2));
    httpFalso.post
      .mockImplementationOnce(() => of({ success: true }))
      .mockImplementationOnce(() => throwError(() => new Error('sin red')));

    const resultado = await servicio.sincronizarReportesPendientes();

    expect(resultado).toEqual({ enviados: 1, fallidos: 1 });
    expect(await dbLocal.reportesOff.where('SINCRONIZADO').equals(0).count()).toBe(1);
    expect(await dbLocal.reportesOff.where('SINCRONIZADO').equals(1).count()).toBe(1);
  });
});
