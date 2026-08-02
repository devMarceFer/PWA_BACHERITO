-- =====================================================================
-- Bacherito pasa a ser una app exclusiva para funcionarios municipales.
-- Este script:
--   1) Crea la vista de autorización (módulo + rol por usuario). [YA EJECUTADO]
--   2) Agrega el rol TECNICO (no existía). [YA EJECUTADO]
--   3) Agrega el módulo ASIGNAR_GRUPO para la pantalla nueva. [YA EJECUTADO]
--   4) Le da al admin actual (titecnico28@ambato.gob.ec, ID_USUARIO=3)
--      acceso ADMIN al módulo nuevo. [YA EJECUTADO]
--   5) Crea las tablas de "grupos de técnicos" (independientes de
--      OP_BACHERITO_CUA, que sigue siendo la tabla real de cuadrillas). [YA EJECUTADO]
--
-- Nota: el paso 1 se ejecutó con el nombre GADMAPPS.VW_AUTORIZACION_USUARIOS
-- (prefijo VW_, igual que VW_TH_FUNCIONARIOS) y el paso 5 con el nombre
-- OP_BACHERITO_GRUPOS/OP_BACHERITO_GRUPO_TECNICOS (prefijo OP_BACHERITO_, igual
-- que OP_BACHERITO_REQ/OP_BACHERITO_CUA) — el backend ya apunta a esos nombres.
-- Este archivo se deja completo solo como referencia/documentación.
--
-- Ejecutar todo en orden, en una sola sesión, con el usuario GADMAPPS
-- o uno con privilegios equivalentes.
-- =====================================================================

-- 1) Vista de autorización — YA EJECUTADO, se deja aquí solo como referencia
CREATE OR REPLACE VIEW GADMAPPS.VW_AUTORIZACION_USUARIOS AS
SELECT
        U.ID_USUARIO,
        U.EMAIL,
        M.ID_MODULO,
        S.ID_SISTEMA,
        R.ID_ROL,
        S.NOMBRE AS SISTEMA,
        M.NOMBRE AS MODULO,
        R.NOMBRE AS ROL
FROM    GADMAPPS.RBAC_USUARIOS U
JOIN    GADMAPPS.RBAC_USUARIO_MODULO_ROL UMR   ON U.ID_USUARIO = UMR.ID_USUARIO
JOIN    GADMAPPS.RBAC_MODULOS M                ON UMR.ID_MODULO = M.ID_MODULO
JOIN    GADMAPPS.RBAC_SISTEMAS S               ON M.ID_SISTEMA = S.ID_SISTEMA
JOIN    GADMAPPS.RBAC_ROLES R                  ON UMR.ID_ROL = R.ID_ROL
WHERE   U.ESTADO = 'S'
AND     U.BLOQUEADO = 0
AND     UMR.ESTADO = 'S'
AND     M.ESTADO = 'S'
AND     S.ESTADO = 'S'
AND     R.ESTADO = 'S'
AND     (UMR.FECHA_INICIO IS NULL OR UMR.FECHA_INICIO <= TRUNC(SYSDATE))
AND     (UMR.FECHA_FIN IS NULL OR UMR.FECHA_FIN >= TRUNC(SYSDATE));


-- 2) Rol TECNICO
INSERT INTO GADMAPPS.RBAC_ROLES (NOMBRE, DESCRIPCION)
VALUES ('TECNICO', 'Técnico de cuadrilla que atiende baches en campo');


-- 3) Módulo ASIGNAR_GRUPO (sistema BACHERITO = ID_SISTEMA 1)
INSERT INTO GADMAPPS.RBAC_MODULOS (ID_SISTEMA, NOMBRE, DESCRIPCION, RUTA_BASE)
VALUES (1, 'ASIGNAR_GRUPO', 'Asignación de técnicos a sectores/parroquias', '/admin/grupos');


-- 4) Acceso ADMIN del módulo nuevo para el admin actual
INSERT INTO GADMAPPS.RBAC_USUARIO_MODULO_ROL (ID_USUARIO, ID_MODULO, ID_ROL, ASIGNADO_POR)
VALUES (
    3,
    (SELECT ID_MODULO FROM GADMAPPS.RBAC_MODULOS WHERE NOMBRE = 'ASIGNAR_GRUPO' AND ID_SISTEMA = 1),
    (SELECT ID_ROL FROM GADMAPPS.RBAC_ROLES WHERE NOMBRE = 'ADMIN'),
    3
);


-- 5) Tablas nuevas e independientes para grupos de técnicos por parroquia
-- YA EJECUTADO (con el nombre OP_BACHERITO_*, para seguir la convención del resto
-- del proyecto en vez de BACH_*) — el backend ya apunta a estos nombres.
CREATE TABLE GADMAPPS.OP_BACHERITO_GRUPOS (
    ID_GRUPO        NUMBER GENERATED ALWAYS AS IDENTITY,
    PAR_CODIGO      NUMBER NOT NULL,
    FECHA_CREACION  DATE DEFAULT SYSDATE NOT NULL,
    CREADO_POR      NUMBER NOT NULL,
    ESTADO          CHAR(1) DEFAULT 'S' NOT NULL,
    CONSTRAINT PK_OP_BACHERITO_GRUPOS PRIMARY KEY (ID_GRUPO),
    CONSTRAINT FK_GRUPO_CREADOR FOREIGN KEY (CREADO_POR) REFERENCES GADMAPPS.RBAC_USUARIOS(ID_USUARIO),
    CONSTRAINT CHK_GRUPO_ESTADO CHECK (ESTADO IN ('S', 'N'))
);

CREATE TABLE GADMAPPS.OP_BACHERITO_GRUPO_TECNICOS (
    ID_GRUPO_TECNICO NUMBER GENERATED ALWAYS AS IDENTITY,
    ID_GRUPO         NUMBER NOT NULL,
    ID_USUARIO       NUMBER NOT NULL,
    CONSTRAINT PK_GRUPO_TECNICOS PRIMARY KEY (ID_GRUPO_TECNICO),
    CONSTRAINT FK_GT_GRUPO FOREIGN KEY (ID_GRUPO) REFERENCES GADMAPPS.OP_BACHERITO_GRUPOS(ID_GRUPO) ON DELETE CASCADE,
    CONSTRAINT FK_GT_USUARIO FOREIGN KEY (ID_USUARIO) REFERENCES GADMAPPS.RBAC_USUARIOS(ID_USUARIO),
    CONSTRAINT UK_GRUPO_USUARIO UNIQUE (ID_GRUPO, ID_USUARIO)
);


-- Verificación rápida tras ejecutar (opcional):
-- SELECT * FROM GADMAPPS.VW_AUTORIZACION_USUARIOS WHERE EMAIL = 'titecnico28@ambato.gob.ec';
