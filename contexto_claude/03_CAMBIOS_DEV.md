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
        -- Reestructura la tabla de asignación de grupos.
        Un grupo puede estar a cargo de diferentes parroquias. Por lo tanto toca corregir las relaciones de las tablas, el backend, frontend. Las siguientes tablas estas creadas modifica su nueva estructura:
          SELECT * FROM GADMAPPS.OP_BACHERITO_GRUPOS;
          SELECT * FROM GADMAPPS.OP_BACHERITO_GRUPO_TECNICOS;
          SELECT * FROM GADMAPPS.OP_BACHERITO_GRUPO_TAREAS;
    -- **ROL TECNICO**
        -- En el Home del tecnico agrega componentes visuales dashboard para ver el cumplimiento de tus tareas en lo que lleva por día, semana y mes.
        -- Elimina el boton de descargar tareas y las funcionalidades que tenia dentro de esa pantalla.
        -- Agregaremos una nueva opción dentro del menu que diga sincronizar con un icono de tuerca. Al dar clic el usuario le redirecciona a una nueva feature que contendra lo siguiente.
        Titulo: Sincronización
        Subtitulo: Administra la descarga de tus tareas y el envio de respuestas y nuevo reportes.
        Dos card, en la una un contador de las baches reportados de manera offline y en el otro card los reporte sincronizados con un contador. 
        En la parte inferior de las dos card. Una card general que diga Descargar Recursos del sistema. Al lado izquierdo debe estar un icono de descarga solo visual y como subtitulo de descargar formularios uno que diga Ultima descarga: Nunca si no se ha descargado o la fecha en la que descargo. Una descripcion que diga trae los recursos del sistema para trabajar sin conoxión y un boton de descargar con su respectivo icono. El boton lo que hara es descargar las tareas pendientes de GADMAPPS.OP_BACHERITO_GRUPO_TAREAS que son asignado al grupo que pertenece. Tambien descargara las parroquias, esa logica de descargar las parroquias ya se encuentra en la pantalla de reportar un nuevo bache.
        De bajo de la card general otra card que diga Subir respuesta. Eso vinculara el offline con el online que se ira reportando en la tabla de: GADMAPPS.OP_BACHERITO_REQ dato vinculado en la bd de datos real dato eliminado en el indexDB.
        Igual contiene un icono de subir archivo. Titulo sera Subir respuesta al igual tendra su ultimo envio, un texto descriptivo de bajo de su ultimo envio que diga Envia al servidor las respuestas guardadas localmente en el dispositivo. Un cuadro que diga: Sin respuestas pendientes o tener el contador que cuantas tareas le falta y un boton que diga Subir respuestas.
        Por ultimo un card que diga Borrar caché con un icono de advertencia. El descriptivo dira Elimina los recursos del sistema descargador y todas las respuestas del dispositivo incluyendo las pendientes de envio. Un boton que diga borrar caché y su icono de basura. Su funcionalidad sera limpiar toda el indexdb pero antes de eso mostrarle un mensaje que diga estas seguro de eliminar la cache del dispositivo?
        Luego de haber terminado la descarga de los recursos que va a necesitar para que el aplicativo movil funcione offline, en la parte del home tiene un apartado que dice Tareas asignadas con la fecha de la tarea descargada, mostrar en unas card las tareas que tiene pendiente tambien tiene un apartado que dice ver todas, al dar clic el podra solo visualizar las tareas de su grupo a nivel general sin importar su estado si esta pendiente, finalizado etc.
        

  - Se agregó el `OfflineStorageService` utilizando la API de IndexedDB para persistir los formularios localmente.
- **Modificaciones:**
  - Actualización del archivo `ngsw-config.json` para incluir las rutas de API en el caché de datos.
- **Notas para QA:** Validar que al apagar el WiFi en DevTools se puedan crear incidencias sin que la app lance un error de red.

---

## Reporte Backend (API - Oracle)
Verifica que tengas acceso a la base de datos en oracle y el registro, cambio de contraseña, satelite asignado en cognito.
- **Nuevas Funcionalidades:**
  - 
  - 
- **Errores Corregidos:**
  - 
- **Notas para QA:**