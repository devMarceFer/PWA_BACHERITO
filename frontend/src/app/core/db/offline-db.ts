import Dexie, { Table, Transaction } from 'dexie';

export interface ParroquiaOffline {
  codigo: number;
  nombre: string;
}

// Nueva interfaz emparejada con GADMAPPS.OP_BACHERITO_REQ
export interface ReporteOffline {
  id?: number;              // Autoincremental interno de Dexie
  NOMBRES: string;          // Nombre del bacherito / usuario por defecto
  CEDULA: string;           // Cédula del usuario logueado (username de Cognito)
  TELEFONO: string;         // Teléfono
  PARROQUIA: number;        // Código numérico de la parroquia
  COORDENADAX: string;      // Latitud (WGS84), cruda tal como la entrega el GPS/mapa
  COORDENADAY: string;      // Longitud (WGS84), cruda tal como la entrega el GPS/mapa
  // X/Y (UTM 17S) los calcula el backend a partir de COORDENADAX/COORDENADAY al recibir el
  // reporte (ya sea envío en vivo o sincronización posterior); no se calculan en el cliente.
  X: number | null;
  Y: number | null;
  // Estado del bache para el mapa de seguimiento: 'N' Nuevo (rojo), 'M' Mantenimiento (amarillo), 'A' Atendido (verde)
  ESTADO: string;
  FECHA_INGRESO: number;    // Timestamp o Fecha
  FOTOGRAFIA: string | null;// Base64 de la imagen del reporte original mientras no se ha subido
  NOMBRE_IMAGEN: string;    // id + usuario + fecha + 'bache_ant'.png (solo referencia local)
  SINCRONIZADO: number;     // Control de sincronización: 0 = Pendiente, 1 = Ok
}

// Payload real que espera el backend (POST /api/requerimientos): nombres de campo en
// camelCase, coordenadas crudas y foto en base64. El backend calcula X/Y y sube la imagen.
export interface RequerimientoPayload {
  nombres: string;
  telefono: string;
  parroquia: number;
  coordenadaX: string;
  coordenadaY: string;
  foto: string | null;
}

export function reporteOfflineAPayload(reporte: ReporteOffline): RequerimientoPayload {
  return {
    nombres: reporte.NOMBRES,
    telefono: reporte.TELEFONO,
    parroquia: reporte.PARROQUIA,
    coordenadaX: reporte.COORDENADAX,
    coordenadaY: reporte.COORDENADAY,
    foto: reporte.FOTOGRAFIA
  };
}

// Tareas (baches) asignadas al técnico logueado, descargadas para trabajar sin conexión.
// Reflejo mínimo de GADMAPPS.OP_BACHERITO_REQ: id es el autoincremental de Dexie,
// idRequerimiento es el ID real del bache en Oracle (necesario para marcarlo atendido en el servidor).
export interface TareaTecnicoOffline {
  id?: number;              // Autoincremental interno de Dexie
  idRequerimiento: number;   // OP_BACHERITO_REQ.ID
  estado: string;            // OP_BACHERITO_REQ.ESTADO (código crudo: I/E/R/A)
  nombreReporto: string;     // OP_BACHERITO_REQ.NOMBRES
  coordenadaX: number;       // OP_BACHERITO_REQ.COORDENADAX (columna NUMBER en Oracle)
  coordenadaY: number;       // OP_BACHERITO_REQ.COORDENADAY (columna NUMBER en Oracle)
  fechaIngreso: string;      // OP_BACHERITO_REQ.FECHA_INGRESO
  pendienteSubir: 0 | 1;     // 0 = Ok/sincronizado, 1 = Pendiente de subir al servidor
}

// Claves para la tabla de metadatos de sincronización
export type ClaveMetaSync = 'ultimaDescarga' | 'ultimoEnvio';

// Metadatos de sincronización: timestamps de última descarga de tareas y último envío de cambios
export interface MetaSync {
  clave: ClaveMetaSync;
  valor: number;  // Timestamp en milisegundos
}

export class OfflineAppDB extends Dexie {
  parroquiasOff!: Table<ParroquiaOffline, number>;
  reportesOff!: Table<ReporteOffline, number>;
  tareasTecnicoOff!: Table<TareaTecnicoOffline, number>;
  metaSyncOff!: Table<MetaSync, string>;

  constructor() {
    super('BacheritoOfflineDB');

    this.version(3).stores({
      parroquias: 'codigo, nombre',
      reportes: '++id, PARROQUIA, SINCRONIZADO, FECHA_INGRESO'
    });

    this.version(4).stores({
      parroquias: 'codigo, nombre',
      reportes: '++id, PARROQUIA, SINCRONIZADO, FECHA_INGRESO',
      tareasTecnico: 'idRequerimiento, estadoCrudo, atendidoPendienteSubir'
    });

    // v5: las tablas se renombran con el sufijo "Off" para dejar claro que son la copia local /
    // cola de sincronización del dispositivo, no la fuente de verdad (que es Oracle). De paso se
    // recorta cada índice a solo los campos que de verdad se consultan con .where()/.orderBy();
    // el resto de los campos (PARROQUIA, nombre, estadoCrudo, etc.) se siguen guardando en el
    // value tal cual, solo dejan de tener un índice B-tree propio porque nunca se buscan por ahí.
    this.version(5).stores({
      parroquias: null,
      reportes: null,
      tareasTecnico: null,
      parroquiasOff: 'codigo',
      reportesOff: '++id, SINCRONIZADO, FECHA_INGRESO',
      tareasTecnicoOff: 'idRequerimiento, atendidoPendienteSubir',
      estadoBacheOff: 'idReporte, sincronizado'
    });

    // v6/v7: tareasTecnicoOff pasa a usar un id autoincremental de Dexie como clave primaria
    // (antes era idRequerimiento). IndexedDB no permite cambiar el keyPath/autoIncrement de un
    // object store existente, así que se borra en v6 y se vuelve a crear en v7 ya con el nuevo
    // esquema; idRequerimiento se conserva como campo indexado para ubicar la tarea local al
    // marcarla atendida en el servidor.
    this.version(6).stores({
      tareasTecnicoOff: null
    });

    this.version(7).stores({
      tareasTecnicoOff: '++id, idRequerimiento'
    });

    // v8: se retira estadoBacheOff. Era la cola de sincronización de reporteService.marcarComoAtendido(),
    // un flujo de "dar seguimiento" que quedó sin uso al migrar los técnicos a mis-tareas.service.ts
    // (tareasTecnicoOff + cambiarEstado, que sí habla con el servidor).
    this.version(8).stores({
      estadoBacheOff: null
    });

    // v9: se añade el campo pendienteSubir a tareasTecnicoOff (0 = sincronizado, 1 = pendiente de subir)
    // y la nueva tabla metaSyncOff para almacenar metadatos de sincronización (últimas fechas de descarga/envío).
    this.version(9)
      .stores({
        tareasTecnicoOff: '++id, idRequerimiento, pendienteSubir',
        metaSyncOff: 'clave'
      })
      .upgrade(migrarTareasAV9);
  }
}

/**
 * Migración a v9: añade el campo pendienteSubir a todas las tareas existentes.
 * Este campo indica si la tarea pendiente de cambio de estado ha sido subida al servidor (0 = sincronizado, 1 = pendiente).
 * Para las tareas existentes, se asume que están sincronizadas (pendienteSubir = 0).
 *
 * @param tx Transacción de Dexie para acceder a las tablas durante la migración
 * @returns Número de tareas migradas
 */
export async function migrarTareasAV9(tx: Transaction): Promise<number> {
  // Obtener todas las tareas de la versión anterior (v8)
  const tareas = await tx.table('tareasTecnicoOff').toArray();

  // Añadir el campo pendienteSubir = 0 a cada tarea
  let migracionesRealizadas = 0;
  for (const tarea of tareas) {
    if (tarea.pendienteSubir === undefined) {
      tarea.pendienteSubir = 0;
      await tx.table('tareasTecnicoOff').put(tarea);
      migracionesRealizadas++;
    }
  }

  return migracionesRealizadas;
}

export const dbLocal = new OfflineAppDB();
