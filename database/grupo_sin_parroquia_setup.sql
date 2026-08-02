-- =====================================================================
-- Un grupo de técnicos ya no queda atado a una sola parroquia — cualquier
-- técnico del Bacherito puede pertenecer a un grupo, y el filtro por
-- parroquia se mueve al momento de asignar un bache (tarea) al grupo.
--
-- Los baches ya asignados (OP_BACHERITO_GRUPO_TAREAS) no se ven afectados:
-- siguen referenciando el ID del bache en OP_BACHERITO_REQ, que ya trae su
-- propia PARROQUIA.
-- =====================================================================

ALTER TABLE GADMAPPS.OP_BACHERITO_GRUPOS DROP COLUMN PAR_CODIGO;
