import { Injectable, effect, signal } from '@angular/core';

const STORAGE_KEY = 'bacherito-compartir-ubicacion';

@Injectable({
  providedIn: 'root'
})
export class UbicacionService {
  // Apagado por defecto: no se pide GPS hasta que el usuario lo active explícitamente.
  compartirUbicacion = signal<boolean>(localStorage.getItem(STORAGE_KEY) === '1');

  constructor() {
    effect(() => {
      localStorage.setItem(STORAGE_KEY, this.compartirUbicacion() ? '1' : '0');
    });
  }

  alternar() {
    this.compartirUbicacion.update(actual => !actual);
  }
}
