import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AsignarGrupoService, Grupo, TecnicoGrupo } from './asignar-grupo.service';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputErrorComponent } from '../../../shared/components/message_error/msg_error.component';
import { NavbarTopComponent } from '../../../shared/components/toolbar/toolbar.component';
import { NavigationDrawerComponent } from '../../../shared/components/navigation_drawer/navigation_drawer.component';

@Component({
  selector: 'app-asignar-grupo',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    ButtonComponent,
    InputErrorComponent,
    NavbarTopComponent,
    NavigationDrawerComponent
  ],
  templateUrl: './asignar-grupo.html'
})
export class AsignarGrupoComponent implements OnInit {
  private asignarGrupoService = inject(AsignarGrupoService);
  private router = inject(Router);

  menuAbierto = signal(false);
  grupos = signal<Grupo[]>([]);
  cargandoGrupos = signal(false);

  mostrarModal = signal(false);
  nombreGrupo = signal('');

  busquedaTecnico = signal('');
  buscandoTecnicos = signal(false);
  resultadosTecnicos = signal<TecnicoGrupo[]>([]);
  mensajeSinResultados = signal<string | null>(null);
  tecnicosSeleccionados = signal<TecnicoGrupo[]>([]);

  creando = signal(false);
  errorCrear = signal<string | null>(null);

  ngOnInit() {
    this.cargarGrupos();
  }

  private cargarGrupos() {
    this.cargandoGrupos.set(true);
    this.asignarGrupoService.listarGrupos().subscribe({
      next: (respuesta) => {
        this.grupos.set(respuesta.data);
        this.cargandoGrupos.set(false);
      },
      error: () => {
        this.cargandoGrupos.set(false);
      }
    });
  }

  irADetalle(idGrupo: number) {
    this.router.navigate(['/admin/grupos', idGrupo]);
  }

  abrirModal() {
    this.nombreGrupo.set('');
    this.busquedaTecnico.set('');
    this.resultadosTecnicos.set([]);
    this.mensajeSinResultados.set(null);
    this.tecnicosSeleccionados.set([]);
    this.errorCrear.set(null);
    this.mostrarModal.set(true);
  }

  cerrarModal() {
    this.mostrarModal.set(false);
  }

  buscarTecnicos() {
    const texto = this.busquedaTecnico().trim();
    if (!texto) return;

    this.buscandoTecnicos.set(true);
    this.mensajeSinResultados.set(null);
    this.asignarGrupoService.buscarTecnicos(texto).subscribe({
      next: (respuesta) => {
        this.buscandoTecnicos.set(false);
        const yaSeleccionados = new Set(this.tecnicosSeleccionados().map(t => t.idUsuario));
        const resultados = respuesta.data.filter(t => !yaSeleccionados.has(t.idUsuario));
        this.resultadosTecnicos.set(resultados);
        this.mensajeSinResultados.set(resultados.length === 0 ? (respuesta.mensaje ?? 'No se encontraron técnicos disponibles con ese criterio.') : null);
      },
      error: () => {
        this.buscandoTecnicos.set(false);
      }
    });
  }

  agregarTecnico(tecnico: TecnicoGrupo) {
    this.tecnicosSeleccionados.update(actual => [...actual, tecnico]);
    this.resultadosTecnicos.update(actual => actual.filter(t => t.idUsuario !== tecnico.idUsuario));
  }

  quitarTecnico(idUsuario: number) {
    this.tecnicosSeleccionados.update(actual => actual.filter(t => t.idUsuario !== idUsuario));
  }

  get formularioValido(): boolean {
    return !!this.nombreGrupo().trim() && this.tecnicosSeleccionados().length > 0;
  }

  crearGrupo() {
    if (!this.nombreGrupo().trim() || this.tecnicosSeleccionados().length === 0) return;

    this.errorCrear.set(null);
    this.creando.set(true);

    this.asignarGrupoService.crearGrupo({
      nombre: this.nombreGrupo().trim(),
      tecnicos: this.tecnicosSeleccionados().map(t => t.idUsuario)
    }).subscribe({
      next: () => {
        this.creando.set(false);
        this.cerrarModal();
        this.cargarGrupos();
      },
      error: (err) => {
        this.creando.set(false);
        this.errorCrear.set(err?.error?.message || 'No se pudo crear el grupo. Intenta de nuevo.');
      }
    });
  }
}
