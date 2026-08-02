-- =====================================================================
-- Los técnicos agregados a un grupo (OP_BACHERITO_GRUPO_TECNICOS) todavía
-- no tienen ninguna fila en RBAC_USUARIO_MODULO_ROL, y el login exige al
-- menos un módulo asignado — sin este script, ningún técnico puede iniciar
-- sesión. Este acceso se otorga de forma MANUAL (decisión del usuario),
-- no automática.
-- =====================================================================

-- 1) Módulo para que los técnicos puedan iniciar sesión y ver "Mis Tareas"
INSERT INTO GADMAPPS.RBAC_MODULOS (ID_SISTEMA, NOMBRE, DESCRIPCION, RUTA_BASE)
VALUES (1, 'MIS_TAREAS', 'Tareas de bache asignadas a un técnico', '/mis-tareas');


-- 2) Otorga el módulo, con rol TECNICO, a TODOS los técnicos que ya están
-- en algún grupo hoy (uso retroactivo, una sola vez)
INSERT INTO GADMAPPS.RBAC_USUARIO_MODULO_ROL (ID_USUARIO, ID_MODULO, ID_ROL, ASIGNADO_POR)
SELECT DISTINCT gt.ID_USUARIO,
       (SELECT ID_MODULO FROM GADMAPPS.RBAC_MODULOS WHERE NOMBRE = 'MIS_TAREAS' AND ID_SISTEMA = 1),
       (SELECT ID_ROL FROM GADMAPPS.RBAC_ROLES WHERE NOMBRE = 'TECNICO'),
       3
FROM GADMAPPS.OP_BACHERITO_GRUPO_TECNICOS gt
WHERE NOT EXISTS (
    SELECT 1 FROM GADMAPPS.RBAC_USUARIO_MODULO_ROL umr
    WHERE umr.ID_USUARIO = gt.ID_USUARIO
    AND umr.ID_MODULO = (SELECT ID_MODULO FROM GADMAPPS.RBAC_MODULOS WHERE NOMBRE = 'MIS_TAREAS' AND ID_SISTEMA = 1)
);


-- 3) Plantilla para otorgar el acceso a un técnico nuevo más adelante.
-- Reemplaza :ID_USUARIO_TECNICO por el ID_USUARIO real (ver RBAC_USUARIOS)
-- y descomenta antes de correr:
--
-- INSERT INTO GADMAPPS.RBAC_USUARIO_MODULO_ROL (ID_USUARIO, ID_MODULO, ID_ROL, ASIGNADO_POR)
-- VALUES (
--     :ID_USUARIO_TECNICO,
--     (SELECT ID_MODULO FROM GADMAPPS.RBAC_MODULOS WHERE NOMBRE = 'MIS_TAREAS' AND ID_SISTEMA = 1),
--     (SELECT ID_ROL FROM GADMAPPS.RBAC_ROLES WHERE NOMBRE = 'TECNICO'),
--     3
-- );


-- Verificación rápida tras ejecutar (opcional):
-- SELECT * FROM GADMAPPS.VW_AUTORIZACION_USUARIOS WHERE MODULO = 'MIS_TAREAS';
