import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ConnectionService {
  // Signal reactivo para que cualquier componente se entere si hay internet
  isOnline = signal<boolean>(navigator.onLine);

  constructor() {
    // Escuchamos eventos nativos del navegador
    window.addEventListener('online', () => this.isOnline.set(true));
    window.addEventListener('offline', () => this.isOnline.set(false));
  }
}