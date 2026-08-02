-- Estado de la asignación en OP_BACHERITO_GRUPO_TAREAS: D=Descargado (el técnico ya lo bajó a su
-- dispositivo), I=Ingresado (recién asignado, valor por defecto), F=Finalizado (el bache llegó a
-- Atendido de verdad en OP_BACHERITO_REQ). Se usa para que el botón "Descargar Tareas" del Home
-- se oculte cuando ya no hay nada nuevo por bajar, sin depender solo de lo que tenga guardado
-- localmente el dispositivo (un técnico que trabaja siempre en línea, sin descargar nunca, también
-- debe dejar de ver el botón una vez que atendió todo).
ALTER TABLE GADMAPPS.OP_BACHERITO_GRUPO_TAREAS ADD ESTADO CHAR(1) DEFAULT 'I' NOT NULL;

-- Backfill: marca como Finalizado lo que ya está atendido en el bache real
UPDATE GADMAPPS.OP_BACHERITO_GRUPO_TAREAS gt
SET ESTADO = 'F'
WHERE EXISTS (
    SELECT 1 FROM GADMAPPS.OP_BACHERITO_REQ r
    WHERE r.ID = gt.ID_REQUERIMIENTO AND r.ESTADO = 'A'
);

COMMIT;
