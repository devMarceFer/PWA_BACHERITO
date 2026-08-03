import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface TecnicoGrupo {
  idUsuario: number;
  nombre: string;
  apellido: string;
  numDocumento: string;
}

export interface TareaGrupo {
  idTarea: number;
  idRequerimiento: number;
  nombres: string;
  parroquiaNombre: string;
  estado: string;
  fechaIngreso: string;
  fechaAsignacion: string;
}

export interface BacheDisponible {
  idRequerimiento: number;
  nombres: string;
  parroquiaNombre: string;
  estado: string;
  fechaIngreso: string;
}

export interface Grupo {
  idGrupo: number;
  nombre: string;
  bachesReportados: number;
  bachesAtendidos: number;
  fechaCreacion: string;
  tecnicos: TecnicoGrupo[];
}

export interface ResumenAdmin {
  totalHuecos: number;
  pendientes: number;
  enProgreso: number;
  resueltos: number;
}

// Bache para el mapa de supervisión del administrador: de solo lectura, incluye el grupo y
// técnico(s) asignado (null si el bache todavía no se asignó a ningún grupo).
export interface BacheMapa {
  idRequerimiento: number;
  nombres: string;
  coordenadaX: number;
  coordenadaY: number;
  parroquiaNombre: string;
  estado: string;
  estadoCrudo: string;
  fechaIngreso: string;
  nombreGrupo: string | null;
  tecnicos: string | null;
}

export interface GrupoDetalle extends Grupo {
  tareas: TareaGrupo[];
}

export interface ParroquiaGrupo {
  parCodigo: number;
  parNombre: string;
}

export interface ConteoParroquia {
  parCodigo: number;
  parNombre: string;
  cantidad: number;
}

export interface PrevisualizacionBaches {
  total: number;
  detalle: ConteoParroquia[];
}

interface RespuestaListado {
  success: boolean;
  data: Grupo[];
}

interface RespuestaResumenAdmin {
  success: boolean;
  data: ResumenAdmin;
}

interface RespuestaDetalle {
  success: boolean;
  data: GrupoDetalle;
}

interface RespuestaTecnicos {
  success: boolean;
  data: TecnicoGrupo[];
  // Cuando data viene vacío, explica por qué (usuario inexistente, inactivo, sin rol de
  // técnico, o ya asignado a otro grupo) en vez de dejar un resultado vacío sin contexto.
  mensaje: string | null;
}

interface RespuestaBachesDisponibles {
  success: boolean;
  data: BacheDisponible[];
}

interface RespuestaMapaAdmin {
  success: boolean;
  data: BacheMapa[];
}

interface RespuestaParroquias {
  success: boolean;
  data: ParroquiaGrupo[];
}

interface RespuestaPrevisualizacion {
  success: boolean;
  data: PrevisualizacionBaches;
}

interface RespuestaAsignacionMasiva {
  success: boolean;
  message: string;
  data: { asignados: number };
}

@Injectable({
  providedIn: 'root'
})
export class AsignarGrupoService {
  private http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/grupos`;

  listarGrupos(): Observable<RespuestaListado> {
    return this.http.get<RespuestaListado>(this.API_URL);
  }

  obtenerResumenAdmin(): Observable<RespuestaResumenAdmin> {
    return this.http.get<RespuestaResumenAdmin>(`${this.API_URL}/resumen`);
  }

  // Solo lectura: todos los baches con su grupo/técnico(s) asignado, para el mapa de supervisión.
  obtenerMapaAdmin(): Observable<RespuestaMapaAdmin> {
    return this.http.get<RespuestaMapaAdmin>(`${this.API_URL}/mapa`);
  }

  obtenerGrupo(idGrupo: number): Observable<RespuestaDetalle> {
    return this.http.get<RespuestaDetalle>(`${this.API_URL}/${idGrupo}`);
  }

  buscarTecnicos(q: string): Observable<RespuestaTecnicos> {
    return this.http.get<RespuestaTecnicos>(`${this.API_URL}/tecnicos`, { params: { q } });
  }

  crearGrupo(datos: { nombre: string; tecnicos: number[] }): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(this.API_URL, datos);
  }

  // parCodigo es opcional: sin él, trae baches disponibles de todas las parroquias.
  listarBachesDisponibles(idGrupo: number, parCodigo?: number): Observable<RespuestaBachesDisponibles> {
    let params = new HttpParams();
    if (parCodigo) {
      params = params.set('parCodigo', parCodigo);
    }
    return this.http.get<RespuestaBachesDisponibles>(`${this.API_URL}/${idGrupo}/baches-disponibles`, { params });
  }

  asignarTarea(idGrupo: number, idRequerimiento: number): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.API_URL}/${idGrupo}/tareas`, { idRequerimiento });
  }

  quitarTarea(idGrupo: number, idRequerimiento: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.API_URL}/${idGrupo}/tareas/${idRequerimiento}`);
  }

  // Agregar un técnico a un grupo ya creado: hereda automáticamente las tareas que el grupo
  // ya tenía asignadas (se relacionan por ID_GRUPO, no hace falta reasignarlas).
  agregarTecnico(idGrupo: number, idUsuario: number): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.API_URL}/${idGrupo}/tecnicos`, { idUsuario });
  }

  quitarTecnico(idGrupo: number, idUsuario: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.API_URL}/${idGrupo}/tecnicos/${idUsuario}`);
  }

  listarParroquiasDeGrupo(idGrupo: number): Observable<RespuestaParroquias> {
    return this.http.get<RespuestaParroquias>(`${this.API_URL}/${idGrupo}/parroquias`);
  }

  // Solo las que no tiene ningún grupo: así el administrador no puede elegir una ya tomada.
  listarParroquiasDisponibles(): Observable<RespuestaParroquias> {
    return this.http.get<RespuestaParroquias>(`${this.API_URL}/parroquias-disponibles`);
  }

  asignarParroquias(idGrupo: number, parroquias: number[]): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.API_URL}/${idGrupo}/parroquias`, { parroquias });
  }

  quitarParroquia(idGrupo: number, parCodigo: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.API_URL}/${idGrupo}/parroquias/${parCodigo}`);
  }

  // Desglose de lo que traería la asignación masiva, sin ejecutarla.
  previsualizarBachesPorParroquia(idGrupo: number): Observable<RespuestaPrevisualizacion> {
    return this.http.get<RespuestaPrevisualizacion>(`${this.API_URL}/${idGrupo}/baches-por-parroquia`);
  }

  asignarBachesPorParroquia(idGrupo: number): Observable<RespuestaAsignacionMasiva> {
    return this.http.post<RespuestaAsignacionMasiva>(`${this.API_URL}/${idGrupo}/tareas/por-parroquia`, {});
  }
}
