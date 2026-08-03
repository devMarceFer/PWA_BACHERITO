import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AccesosService, UsuarioBusqueda } from './accesos.service';
import { AccesosUsuarioComponent } from './accesos-usuario';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { NavbarTopComponent } from '../../../shared/components/toolbar/toolbar.component';
import { NavigationDrawerComponent } from '../../../shared/components/navigation_drawer/navigation_drawer.component';

@Component({
  selector: 'app-accesos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    ButtonComponent,
    NavbarTopComponent,
    NavigationDrawerComponent,
    AccesosUsuarioComponent
  ],
  templateUrl: './accesos.html'
})
export class AccesosComponent {
  private accesosService = inject(AccesosService);

  menuAbierto = signal(false);

  busqueda = signal('');
  buscando = signal(false);
  resultados = signal<UsuarioBusqueda[]>([]);
  errorBusqueda = signal<string | null>(null);
  yaBusco = signal(false);

  usuarioSeleccionado = signal<UsuarioBusqueda | null>(null);

  buscar() {
    const q = this.busqueda().trim();
    if (!q) {
      this.errorBusqueda.set('Escribe una cédula, nombre o correo para buscar.');
      return;
    }

    this.buscando.set(true);
    this.errorBusqueda.set(null);

    this.accesosService.buscarUsuarios(q).subscribe({
      next: (respuesta) => {
        this.resultados.set(respuesta.data);
        this.yaBusco.set(true);
        this.buscando.set(false);
      },
      error: () => {
        this.errorBusqueda.set('No se pudo completar la búsqueda. Revisa tu conexión e intenta de nuevo.');
        this.buscando.set(false);
      }
    });
  }

  seleccionar(usuario: UsuarioBusqueda) {
    this.usuarioSeleccionado.set(usuario);
  }

  volverAlListado() {
    this.usuarioSeleccionado.set(null);
  }

  // La tarea 7 la llama cuando el hijo cambia algo, para que el contador de accesos
  // del listado no quede desactualizado.
  refrescarListado() {
    if (this.yaBusco()) this.buscar();
  }
}
