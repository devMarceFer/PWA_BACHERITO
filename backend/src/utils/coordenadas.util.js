import proj4 from 'proj4';

const WGS84 = '+proj=longlat +datum=WGS84 +no_defs';
const UTM_17S = '+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs';

// Ambato está en UTM zona 17S. Convención del proyecto: COORDENADAX = longitud,
// COORDENADAY = latitud (así se llama en todo el sistema, aunque sea contraintuitivo).
// Recibe (longitud, latitud) en WGS84 y devuelve {x, y} en UTM 17S.
export function convertirAUtm(longitud, latitud) {
    const lon = parseFloat(longitud);
    const lat = parseFloat(latitud);

    if (Number.isNaN(lon) || Number.isNaN(lat)) {
        return { x: null, y: null };
    }

    const [x, y] = proj4(WGS84, UTM_17S, [lon, lat]);
    return { x, y };
}
