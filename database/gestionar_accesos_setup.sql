-- =====================================================================
-- Alta del módulo GESTIONAR_ACCESOS y del acceso inicial del administrador.
--
-- Ejecutar con el usuario GADMAPPS o uno con privilegios equivalentes.
--
-- Después de correrlo hay que CERRAR SESIÓN Y VOLVER A ENTRAR en la app:
-- los módulos viajan dentro del JWT que se firma en el login, así que un
-- token ya emitido no contiene el módulo nuevo y el guard rebota.
-- =====================================================================

-- 1) El módulo. ID_MODULO es columna de identidad: no se fija su valor.
INSERT INTO GADMAPPS.RBAC_MODULOS (ID_SISTEMA, NOMBRE, DESCRIPCION, RUTA_BASE)
VALUES (1, 'GESTIONAR_ACCESOS', 'Gestión de accesos por sistema, rol y módulo', '/admin/accesos');

-- 2) Acceso del administrador actual (ID_USUARIO 21, marcelofrobayo@gmail.com).
--    Los ids de módulo y rol se resuelven por subconsulta sobre NOMBRE, nunca quemados.
INSERT INTO GADMAPPS.RBAC_USUARIO_MODULO_ROL (ID_USUARIO, ID_MODULO, ID_ROL, ASIGNADO_POR)
VALUES (21,
        (SELECT ID_MODULO FROM GADMAPPS.RBAC_MODULOS WHERE NOMBRE = 'GESTIONAR_ACCESOS' AND ID_SISTEMA = 1),
        (SELECT ID_ROL    FROM GADMAPPS.RBAC_ROLES   WHERE NOMBRE = 'ADMIN'),
        21);

COMMIT;

-- Verificación posterior (debe devolver 1 fila con SISTEMA='BACHERITO', ROL='ADMIN'):
-- SELECT SISTEMA, MODULO, ROL FROM GADMAPPS.VW_AUTORIZACION_USUARIOS
-- WHERE ID_USUARIO = 21 AND MODULO = 'GESTIONAR_ACCESOS';
