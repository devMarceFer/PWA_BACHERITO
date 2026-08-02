-- =====================================================================
-- Extiende "Asignar Grupo": nombre de grupo + asignación de tareas (baches).
-- Este script:
--   1) Agrega la columna NOMBRE a OP_BACHERITO_GRUPOS (no existía).
--   2) Crea OP_BACHERITO_GRUPO_TAREAS: los baches concretos asignados a
--      cada grupo. UNIQUE(ID_REQUERIMIENTO) obliga a que un mismo bache
--      no pueda estar en más de un grupo al mismo tiempo.
--
-- Ejecutar todo en orden, en una sola sesión, con el usuario GADMAPPS
-- o uno con privilegios equivalentes.
-- =====================================================================

-- 1) Nombre del grupo
-- Ya existe al menos un grupo creado (de las pruebas), así que se agrega como
-- nullable, se rellena con un nombre provisional, y luego se exige NOT NULL.
-- Si más adelante quieres renombrarlo, es solo un UPDATE normal.
ALTER TABLE GADMAPPS.OP_BACHERITO_GRUPOS ADD (NOMBRE VARCHAR2(100));
UPDATE GADMAPPS.OP_BACHERITO_GRUPOS SET NOMBRE = 'Grupo ' || ID_GRUPO WHERE NOMBRE IS NULL;
ALTER TABLE GADMAPPS.OP_BACHERITO_GRUPOS MODIFY (NOMBRE NOT NULL);


-- 2) Tareas: baches concretos asignados a un grupo
CREATE TABLE GADMAPPS.OP_BACHERITO_GRUPO_TAREAS (
    ID_TAREA          NUMBER GENERATED ALWAYS AS IDENTITY,
    ID_GRUPO          NUMBER NOT NULL,
    ID_REQUERIMIENTO  NUMBER NOT NULL,
    ASIGNADO_POR      NUMBER NOT NULL,
    FECHA_ASIGNACION  DATE DEFAULT SYSDATE NOT NULL,
    CONSTRAINT PK_GRUPO_TAREAS PRIMARY KEY (ID_TAREA),
    CONSTRAINT FK_TAREA_GRUPO FOREIGN KEY (ID_GRUPO) REFERENCES GADMAPPS.OP_BACHERITO_GRUPOS(ID_GRUPO) ON DELETE CASCADE,
    CONSTRAINT FK_TAREA_REQUERIMIENTO FOREIGN KEY (ID_REQUERIMIENTO) REFERENCES GADMAPPS.OP_BACHERITO_REQ(ID),
    CONSTRAINT FK_TAREA_ASIGNADOR FOREIGN KEY (ASIGNADO_POR) REFERENCES GADMAPPS.RBAC_USUARIOS(ID_USUARIO),
    CONSTRAINT UK_TAREA_REQUERIMIENTO UNIQUE (ID_REQUERIMIENTO)
);


-- Verificación rápida tras ejecutar (opcional):
-- SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE OWNER='GADMAPPS' AND TABLE_NAME='OP_BACHERITO_GRUPOS';
-- SELECT * FROM GADMAPPS.OP_BACHERITO_GRUPO_TAREAS;
