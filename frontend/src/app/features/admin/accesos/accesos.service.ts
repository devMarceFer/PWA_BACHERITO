import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface ModuloCatalogo {
  idModulo: number;
  nombre: string;
  descripcion: string | null;
}

export interface SistemaCatalogo {
  idSistema: number;
  nombre: string;
  modulos: ModuloCatalogo[];
}

export interface RolCatalogo {
  idRol: number;
  nombre: string;
}

export interface Catalogo {
  sistemas: SistemaCatalogo[];
  roles: RolCatalogo[];
}

export interface UsuarioBusqueda {
  idUsuario: number;
  nombre: string;
  apellido: string;
  numDocumento: string;
  email: string;
  estado: string;
  bloqueado: number;
  totalAccesosActivos: number;
}

// estado 'S' = activo, 'N' = revocado. Los revocados se muestran colapsados: la revocación
// es blanda justamente para no perder el historial de quién tuvo qué acceso.
export interface Acceso {
  idUmr: number;
  idSistema: number;
  sistema: string;
  idModulo: number;
  modulo: string;
  idRol: number;
  rol: string;
  estado: string;
  creadoEn: string;
}

export interface DetalleUsuario {
  usuario: UsuarioBusqueda;
  accesos: Acceso[];
}

export interface Otorgamiento {
  idModulo: number;
  idRol: number;
}

interface RespuestaCatalogo {
  success: boolean;
  data: Catalogo;
}

interface RespuestaUsuarios {
  success: boolean;
  count: number;
  data: UsuarioBusqueda[];
}

interface RespuestaDetalle {
  success: boolean;
  data: DetalleUsuario;
}

interface RespuestaOtorgamiento {
  success: boolean;
  message: string;
  data: { otorgados: number; reactivados: number };
}

@Injectable({
  providedIn: 'root'
})
export class AccesosService {
  private http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/accesos`;

  obtenerCatalogo(): Observable<RespuestaCatalogo> {
    return this.http.get<RespuestaCatalogo>(`${this.API_URL}/catalogo`);
  }

  buscarUsuarios(q: string): Observable<RespuestaUsuarios> {
    return this.http.get<RespuestaUsuarios>(`${this.API_URL}/usuarios`, { params: { q } });
  }

  obtenerDetalleUsuario(idUsuario: number): Observable<RespuestaDetalle> {
    return this.http.get<RespuestaDetalle>(`${this.API_URL}/usuarios/${idUsuario}`);
  }

  otorgar(idUsuario: number, otorgamientos: Otorgamiento[]): Observable<RespuestaOtorgamiento> {
    return this.http.post<RespuestaOtorgamiento>(`${this.API_URL}/usuarios/${idUsuario}`, { otorgamientos });
  }

  revocar(idUsuario: number, idModulo: number, idRol: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.API_URL}/usuarios/${idUsuario}/modulos/${idModulo}/roles/${idRol}`
    );
  }
}
