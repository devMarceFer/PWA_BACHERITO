# Historial de Cambios de Desarrollo (Dev Log)

## Reporte Frontend (PWA - Angular)
- **Nuevas Funcionalidades:**
    -- **ROL ADMINISTRADOR**
        -- En el home de administrador agregar componentes visuales para verificar el cumplimiento del trabajo de los tecnicos por dia, semana.
        -- Agrega un nuevo submenu dentro del menu que diga asignar modulos. El administrador le dara acceso a las pantallas que puede utilizar el tecnico en este caso se encuentra en las tablas: 
        SELECT * FROM GADMAPPS.RBAC_USUARIOS;
        SELECT * FROM GADMAPPS.RBAC_ROLES;
        SELECT * FROM GADMAPPS.RBAC_MODULOS;
        SELECT * FROM GADMAPPS.RBAC_USUARIO_MODULO_ROL;
        El administrador busca el usuario por su cedula escoge el rol y puede seleccionar uno o mas modulos y se guarda en  la tabla de GADMAPPS.RBAC_USUARIO_MODULO_ROL, puede insertar, actualizar o quitarle modulos pero siempre debe quedarse con un rol y un modulo no puede quedarse sin ninguno;
    -- **ROL TECNICO**
        -- En el Home del tecnico 

  - Se agregó el `OfflineStorageService` utilizando la API de IndexedDB para persistir los formularios localmente.
- **Modificaciones:**
  - Actualización del archivo `ngsw-config.json` para incluir las rutas de API en el caché de datos.
- **Notas para QA:** Validar que al apagar el WiFi en DevTools se puedan crear incidencias sin que la app lance un error de red.

---

## Reporte Backend (API - Oracle)
- **Nuevas Funcionalidades:**
  - Implementación del procedimiento almacenado `PR_CREAR_INCIDENCIA` en la base de datos Oracle.
  - Creación del modelo `IncidenciaDto` en TypeScript derivado del contrato OpenAPI.
- **Errores Corregidos:**
  - Corrección de la secuencia de ID en la tabla `INCIDENCIAS` para evitar colisión de claves primarias.
- **Notas para QA:** Probar el endpoint `POST /api/v1/incidencias` enviando coordenadas geográficas nulas para verificar la validación 400 Bad Request.