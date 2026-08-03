-- =====================================================================
-- Parroquias a cargo de cada grupo de trabajo.
--
-- Regla de negocio: una parroquia pertenece a UN SOLO grupo. Se hace
-- cumplir con UNIQUE(PAR_CODIGO), no con lógica de aplicación, para que
-- siga valiendo aunque alguien llame la API directamente.
--
-- Ejecutar en una sola sesión con el usuario GADMAPPS o equivalente.
-- =====================================================================

CREATE TABLE GADMAPPS.OP_BACHERITO_GRUPO_PARROQUIAS (
    ID_GRUPO_PARROQUIA NUMBER GENERATED ALWAYS AS IDENTITY,
    ID_GRUPO           NUMBER NOT NULL,
    PAR_CODIGO         NUMBER NOT NULL,
    ASIGNADO_POR       NUMBER NOT NULL,
    FECHA_ASIGNACION   DATE DEFAULT SYSDATE NOT NULL,
    CONSTRAINT PK_GRUPO_PARROQUIAS PRIMARY KEY (ID_GRUPO_PARROQUIA),
    CONSTRAINT FK_GP_GRUPO FOREIGN KEY (ID_GRUPO)
        REFERENCES GADMAPPS.OP_BACHERITO_GRUPOS(ID_GRUPO) ON DELETE CASCADE,
    CONSTRAINT UQ_GP_PARROQUIA UNIQUE (PAR_CODIGO)
);

-- Consulta más frecuente: las parroquias de un grupo.
CREATE INDEX IX_GP_GRUPO ON GADMAPPS.OP_BACHERITO_GRUPO_PARROQUIAS (ID_GRUPO);

-- Verificación posterior (opcional, solo lectura):
-- SELECT * FROM GADMAPPS.OP_BACHERITO_GRUPO_PARROQUIAS;
