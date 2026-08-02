-- =====================================================================
-- Agrega un usuario existente (ya registrado como funcionario, con fila
-- en RBAC_USUARIOS) a los módulos que necesita un TÉCNICO de Bacherito:
--   - MIS_TAREAS        -> imprescindible: sin este módulo no puede
--                          iniciar sesión (el login exige al menos uno).
--   - SEGUIMIENTO_BACHE -> ver el mapa de baches.
--   - REPORTAR_BACHE    -> reportar un bache nuevo.
-- Es el mismo patrón que ya tienen los técnicos reales (ver
-- VW_AUTORIZACION_USUARIOS), y es idempotente: se puede correr varias
-- veces sin duplicar filas ni fallar si ya tenía alguno de los módulos.
--
-- CÓMO USARLO:
--   1) Cambia el valor de v_num_documento por la cédula del usuario.
--   2) Corre todo el bloque en una sola sesión (SQL Developer / SQL*Plus).
--   3) Revisa el mensaje de salida (DBMS_OUTPUT) y la consulta de
--      verificación al final.
--
-- Nota: el usuario debe existir de antes en RBAC_USUARIOS (se crea al
-- registrarse en la app vía Cognito, validando su cédula contra
-- VW_TH_FUNCIONARIOS). Este script NO crea usuarios nuevos, solo les
-- otorga el rol TECNICO sobre los módulos de Bacherito.
-- =====================================================================

SET SERVEROUTPUT ON;

DECLARE
    v_num_documento   VARCHAR2(20) := '0000000000'; -- <-- reemplaza por la cédula real
    v_id_usuario      GADMAPPS.RBAC_USUARIOS.ID_USUARIO%TYPE;
    v_id_rol_tecnico  GADMAPPS.RBAC_ROLES.ID_ROL%TYPE;
    v_id_modulo       GADMAPPS.RBAC_MODULOS.ID_MODULO%TYPE;
    v_asignado_por    NUMBER := 3; -- ID_USUARIO del admin que otorga el acceso
    v_ya_existe       NUMBER;

    PROCEDURE otorgar_modulo(p_nombre_modulo VARCHAR2) IS
    BEGIN
        SELECT ID_MODULO INTO v_id_modulo
        FROM GADMAPPS.RBAC_MODULOS
        WHERE ID_SISTEMA = 1 AND NOMBRE = p_nombre_modulo;

        SELECT COUNT(*) INTO v_ya_existe
        FROM GADMAPPS.RBAC_USUARIO_MODULO_ROL
        WHERE ID_USUARIO = v_id_usuario AND ID_MODULO = v_id_modulo;

        IF v_ya_existe = 0 THEN
            INSERT INTO GADMAPPS.RBAC_USUARIO_MODULO_ROL (ID_USUARIO, ID_MODULO, ID_ROL, ASIGNADO_POR)
            VALUES (v_id_usuario, v_id_modulo, v_id_rol_tecnico, v_asignado_por);
            DBMS_OUTPUT.PUT_LINE('  + ' || p_nombre_modulo || ': acceso otorgado.');
        ELSE
            DBMS_OUTPUT.PUT_LINE('  = ' || p_nombre_modulo || ': ya tenía acceso, no se duplicó.');
        END IF;
    END;

BEGIN
    BEGIN
        SELECT ID_USUARIO INTO v_id_usuario
        FROM GADMAPPS.RBAC_USUARIOS
        WHERE NUM_DOCUMENTO = v_num_documento;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RAISE_APPLICATION_ERROR(-20001,
                'No existe ningún usuario con cédula ' || v_num_documento ||
                ' en RBAC_USUARIOS. Debe registrarse primero en la app.');
    END;

    SELECT ID_ROL INTO v_id_rol_tecnico
    FROM GADMAPPS.RBAC_ROLES
    WHERE NOMBRE = 'TECNICO';

    DBMS_OUTPUT.PUT_LINE('Otorgando accesos de técnico al usuario ID_USUARIO=' || v_id_usuario || '...');
    otorgar_modulo('MIS_TAREAS');
    otorgar_modulo('SEGUIMIENTO_BACHE');
    otorgar_modulo('REPORTAR_BACHE');

    COMMIT;
    DBMS_OUTPUT.PUT_LINE('Listo.');
END;
/

-- Verificación (debe mostrar las 3 filas con ROL = TECNICO):
-- SELECT * FROM GADMAPPS.VW_AUTORIZACION_USUARIOS WHERE ID_USUARIO = (
--     SELECT ID_USUARIO FROM GADMAPPS.RBAC_USUARIOS WHERE NUM_DOCUMENTO = '0000000000'
-- );
