import proj4 from 'proj4';

const WGS84 = '+proj=longlat +datum=WGS84 +no_defs';
const UTM_17S = '+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs';

// Ambato está en UTM zona 17S. Recibe lat/lon (WGS84) y devuelve {x, y} en UTM 17S.
export function convertirAUtm(lat, lon) {
    const latitud = parseFloat(lat);
    const longitud = parseFloat(lon);

    if (Number.isNaN(latitud) || Number.isNaN(longitud)) {
        return { x: null, y: null };
    }

    const [x, y] = proj4(WGS84, UTM_17S, [longitud, latitud]);
    return { x, y };
}
