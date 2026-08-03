-- =====================================================================
-- B5: borrado de las filas de prueba 57, 58 y 59 de OP_BACHERITO_REQ.
--
-- Son reportes generados durante QA el 2026-07-30 (nombre 'Marcelo Fernando',
-- sin cédula, sin fotografía, tres en tres minutos consecutivos).
-- Se verificó antes del borrado que NINGUNA está referenciada en
-- GADMAPPS.OP_BACHERITO_GRUPO_TAREAS, así que el borrado no deja huérfanos.
--
-- Ejecutado el 2026-08-02 con autorización explícita del usuario.
-- =====================================================================

DELETE FROM GADMAPPS.OP_BACHERITO_REQ WHERE ID IN (57, 58, 59);

COMMIT;

-- Verificación posterior (debe devolver 0 filas):
-- SELECT ID FROM GADMAPPS.OP_BACHERITO_REQ WHERE ID IN (57, 58, 59);
