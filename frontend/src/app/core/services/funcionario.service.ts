import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FuncionarioEncontrado {
  correo: string;
  nombres: string;
  apellidos: string;
  celular1: string;
}

@Injectable({
  providedIn: 'root'
})
export class FuncionarioService {
  private http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/funcionarios`;

  // Devuelve null tanto si no se encontró como si la cédula no tiene un formato válido;
  // el componente solo necesita distinguir "encontrado" de "no encontrado".
  buscarPorCedula(cedula: string): Observable<FuncionarioEncontrado | null> {
    return this.http.get<{ success: boolean; data: FuncionarioEncontrado }>(`${this.API_URL}/buscar`, {
      params: { cedula }
    }).pipe(
      map((respuesta) => respuesta.data),
      catchError(() => of(null))
    );
  }
}
