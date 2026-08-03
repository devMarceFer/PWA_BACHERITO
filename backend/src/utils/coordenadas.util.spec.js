import { describe, it, expect } from 'vitest';
import { convertirAUtm } from './coordenadas.util.js';

// Convención del proyecto: COORDENADAX = longitud, COORDENADAY = latitud.
// convertirAUtm recibe (longitud, latitud), en ese orden.
describe('convertirAUtm', () => {
  it('convierte longitud/latitud de Ambato al rango correcto en UTM 17S', () => {
    const { x, y } = convertirAUtm(-78.62722, -1.24908);

    expect(x).toBeGreaterThan(760000);
    expect(x).toBeLessThan(766000);
    expect(y).toBeGreaterThan(9858000);
    expect(y).toBeLessThan(9864000);
  });

  it('devuelve {x: null, y: null} si algún valor no es numérico', () => {
    expect(convertirAUtm('no-es-numero', -1.24908)).toEqual({ x: null, y: null });
    expect(convertirAUtm(-78.62722, 'tampoco')).toEqual({ x: null, y: null });
    expect(convertirAUtm(undefined, undefined)).toEqual({ x: null, y: null });
  });

  it('NO debe devolver el rango invertido (X e Y cruzados) que producía el bug', () => {
    const { x, y } = convertirAUtm(-78.62722, -1.24908);

    // El bug original entregaba X ~1.757.087 e Y ~230.847 (cruzados) porque proj4
    // recibía [latitud, longitud] en vez de [longitud, latitud]. Si vuelve a pasar,
    // X superará el millón e Y quedará muy por debajo del millón.
    expect(x).toBeLessThan(1000000);
    expect(y).toBeGreaterThan(1000000);
  });
});
