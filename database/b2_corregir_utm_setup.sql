-- =====================================================================
-- Corrección de bug B2: coordenadas UTM (X, Y) invertidas.
--
-- backend/src/utils/coordenadas.util.js cruzaba internamente latitud y
-- longitud antes de llamar a proj4, por lo que las 16 filas de abajo
-- quedaron guardadas con X e Y intercambiados (X con valores > 1.000.000
-- e Y con valores < 1.000.000, cuando en Ambato/UTM 17S debería ser al
-- revés: X ronda 763.000-766.000 e Y ronda 9.859.000-9.864.000).
--
-- El bug ya fue corregido en el código para los reportes nuevos. Este
-- script recalcula X e Y para las filas históricas afectadas (IDs 55 a
-- 70) a partir de COORDENADAX/COORDENADAY (que no se tocan) usando la
-- conversión correcta. Los valores fueron precalculados fuera de la base
-- con la misma librería (proj4) y la misma proyección (UTM 17S) que usa
-- el backend.
-- =====================================================================

UPDATE GADMAPPS.OP_BACHERITO_REQ SET X = 763987.45, Y = 9859698.25 WHERE ID = 55;
UPDATE GADMAPPS.OP_BACHERITO_REQ SET X = 763987.23, Y = 9859698.47 WHERE ID = 56;
UPDATE GADMAPPS.OP_BACHERITO_REQ SET X = 764044.61, Y = 9861819.68 WHERE ID = 57;
UPDATE GADMAPPS.OP_BACHERITO_REQ SET X = 764044.61, Y = 9861819.68 WHERE ID = 58;
UPDATE GADMAPPS.OP_BACHERITO_REQ SET X = 764044.61, Y = 9861819.68 WHERE ID = 59;
UPDATE GADMAPPS.OP_BACHERITO_REQ SET X = 763988.45, Y = 9859698.47 WHERE ID = 60;
UPDATE GADMAPPS.OP_BACHERITO_REQ SET X = 763986.78, Y = 9859700.35 WHERE ID = 61;
UPDATE GADMAPPS.OP_BACHERITO_REQ SET X = 763991.13, Y = 9859699.35 WHERE ID = 62;
UPDATE GADMAPPS.OP_BACHERITO_REQ SET X = 763985.45, Y = 9859702.79 WHERE ID = 63;
UPDATE GADMAPPS.OP_BACHERITO_REQ SET X = 763989.90, Y = 9859701.24 WHERE ID = 64;
UPDATE GADMAPPS.OP_BACHERITO_REQ SET X = 763986.23, Y = 9859697.92 WHERE ID = 65;
UPDATE GADMAPPS.OP_BACHERITO_REQ SET X = 765905.83, Y = 9863140.32 WHERE ID = 66;
UPDATE GADMAPPS.OP_BACHERITO_REQ SET X = 765910.83, Y = 9863133.56 WHERE ID = 67;
UPDATE GADMAPPS.OP_BACHERITO_REQ SET X = 764044.61, Y = 9861819.68 WHERE ID = 68;
UPDATE GADMAPPS.OP_BACHERITO_REQ SET X = 764044.61, Y = 9861819.68 WHERE ID = 69;
UPDATE GADMAPPS.OP_BACHERITO_REQ SET X = 764044.61, Y = 9861819.68 WHERE ID = 70;

COMMIT;

-- Verificación (ejecutar manualmente después del COMMIT): las 16 filas
-- deben tener X entre 760.000 y 766.000, e Y entre 9.858.000 y 9.864.000.
-- SELECT ID, COORDENADAX, COORDENADAY, X, Y
-- FROM GADMAPPS.OP_BACHERITO_REQ
-- WHERE ID BETWEEN 55 AND 70
-- ORDER BY ID;
