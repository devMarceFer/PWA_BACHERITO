# Especificación del Proyecto: Sistema de Gestión de Reportes

## 1. Visión General
Aplicación web progresiva (PWA) con soporte offline para la gestión y reporte de incidencias en campo, integrada con un backend REST de soporte.

## 2. Arquitectura Técnica
- **Frontend:** Angular (versión estable actual) configurado como PWA con Service Workers e IndexedDB para almacenamiento offline local.
- **Backend:** Node.js / Express estructurado / Cognito
- **Base de Datos:** Oracle Database | IndexDB | Cognito
- **Librerias** Leaflet | OpenStreetMap

## 3. Requerimientos Funcionales
1. **Módulo Autenticación:** Login con JWT y almacenamiento local de sesión.
2. **Módulo Reportes (Offline First):**
   - CRUD de formularios de incidencias sin conexión a internet.
   - CRUD de asignación de roles y modulos de tecnicos.
   - ACTUALIZAR contraseña con cognito y la BD. 
   - Verificar si el usuario tiene su sesion activa y en el caso que su sesión fue dada de baja o la sesion caduco mostrarle una notificación de volver a iniciar sesión.
3. **Módulo Backoffice (Admin):**
   - Dashboard para la visualización.