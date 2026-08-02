-- Completa GADMAPPS.RBAC_MODULOS.RUTA_BASE para los módulos que quedaron sin ese campo
-- (confirmado por consulta: REPORTAR_BACHE y SEGUIMIENTO_BACHE tienen RUTA_BASE = NULL;
-- ASIGNAR_GRUPO y MIS_TAREAS ya lo tienen). La ruta es la del frontend Angular que protege
-- cada módulo (ver app.routes.ts).

UPDATE GADMAPPS.RBAC_MODULOS
SET RUTA_BASE = '/reporta/nuevo'
WHERE ID_SISTEMA = 1 AND NOMBRE = 'REPORTAR_BACHE' AND RUTA_BASE IS NULL;

UPDATE GADMAPPS.RBAC_MODULOS
SET RUTA_BASE = '/reporta'
WHERE ID_SISTEMA = 1 AND NOMBRE = 'SEGUIMIENTO_BACHE' AND RUTA_BASE IS NULL;

COMMIT;

-- Verificación (debe mostrar las 4 filas del sistema BACHERITO con RUTA_BASE lleno):
-- SELECT NOMBRE, RUTA_BASE FROM GADMAPPS.RBAC_MODULOS WHERE ID_SISTEMA = 1;
