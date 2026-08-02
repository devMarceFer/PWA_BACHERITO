import { Injectable, effect, signal } from '@angular/core';

export type Tema = 'light' | 'dark';

const STORAGE_KEY = 'bacherito-theme';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  tema = signal<Tema>(this.obtenerTemaInicial());

  constructor() {
    // Aplica el tema al <html> y lo persiste cada vez que cambia el Signal
    effect(() => {
      const tema = this.tema();
      document.documentElement.setAttribute('data-theme', tema);
      localStorage.setItem(STORAGE_KEY, tema);
    });
  }

  alternar() {
    this.tema.update(actual => (actual === 'dark' ? 'light' : 'dark'));
  }

  private obtenerTemaInicial(): Tema {
    const guardado = localStorage.getItem(STORAGE_KEY);
    if (guardado === 'light' || guardado === 'dark') {
      return guardado;
    }

    // Sin preferencia guardada: usamos la del sistema operativo como punto de partida
    const prefiereOscuro = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    return prefiereOscuro ? 'dark' : 'light';
  }
}
