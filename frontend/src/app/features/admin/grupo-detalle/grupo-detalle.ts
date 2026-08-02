import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AsignarGrupoService, BacheDisponible, GrupoDetalle, TecnicoGrupo } from '../asignar-grupo/asignar-grupo.service';
import { ParroquiaService } from '../../../core/services/parroquia.service';
import { ParroquiaOffline } from '../../../core/db/offline-db';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { NavbarTopComponent } from '../../../shared/components/toolbar/toolbar.component';
import { NavigationDrawerComponent } from '../../../shared/components/navigation_drawer/navigation_drawer.component';

type FiltroBaches = 'todo' | 'parroquia';

@Component({
  selector: 'app-grupo-detalle',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    ButtonComponent,
    NavbarTopComponent,
    NavigationDrawerComponent
  ],
  templateUrl: './grupo-detalle.html'
})
export class GrupoDetalleComponent implements OnInit {
  private asignarGrupoService = inject(AsignarGrupoService);
  private parroquiaService = inject(ParroquiaService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private idGrupo!: number;

  menuAbierto = signal(false);
  grupo = signal<GrupoDetalle | null>(null);
  cargando = signal(false);

  mostrarPicker = signal(false);
  filtro = signal<FiltroBaches>('todo');
  parroquias = signal<ParroquiaOffline[]>([]);
  parCodigoFiltro = signal<number | null>(null);
  bachesDisponibles = signal<BacheDisponible[]>([]);
  cargandoDisponibles = signal(false);
  asignando = signal<number | null>(null);
  quitando = signal<number | null>(null);
  error = signal<string | null>(null);

  mostrarPickerTecnicos = signal(false);
  busquedaTecnico = signal('');
  buscandoTecnicos = signal(false);
  resultadosTecnicos = signal<TecnicoGrupo[]>([]);
  mensajeSinResultados = signal<string | null>(null);
  agregandoTecnico = signal<number | null>(null);
  quitandoTecnico = signal<number | null>(null);
  errorTecnico = signal<string | null>(null);

  ngOnInit() {
    this.idGrupo = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.idGrupo) {
      this.router.navigate(['/admin/grupos']);
      return;
    }
    this.cargarGrupo();
  }

  private cargarGrupo() {
    this.cargando.set(true);
    this.asignarGrupoService.obtenerGrupo(this.idGrupo).subscribe({
      next: (respuesta) => {
        this.grupo.set(respuesta.data);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.router.navigate(['/admin/grupos']);
      }
    });
  }

  async abrirPicker() {
    this.error.set(null);
    this.filtro.set('todo');
    this.parCodigoFiltro.set(null);
    this.mostrarPicker.set(true);

    this.cargarBachesDisponibles();

    if (this.parroquias().length === 0) {
      const parroquias = await this.parroquiaService.obtenerParroquias();
      this.parroquias.set(parroquias);
    }
  }

  cerrarPicker() {
    this.mostrarPicker.set(false);
  }

  cambiarFiltro(filtro: FiltroBaches) {
    this.filtro.set(filtro);
    if (filtro === 'todo') {
      this.parCodigoFiltro.set(null);
      this.cargarBachesDisponibles();
    } else if (this.parCodigoFiltro() !== null) {
      this.cargarBachesDisponibles();
    } else {
      this.bachesDisponibles.set([]);
    }
  }

  cambiarParroquiaFiltro(parCodigo: number | null) {
    this.parCodigoFiltro.set(parCodigo);
    if (parCodigo !== null) {
      this.cargarBachesDisponibles();
    } else {
      this.bachesDisponibles.set([]);
    }
  }

  private cargarBachesDisponibles() {
    this.cargandoDisponibles.set(true);
    const parCodigo = this.filtro() === 'parroquia' ? (this.parCodigoFiltro() ?? undefined) : undefined;

    this.asignarGrupoService.listarBachesDisponibles(this.idGrupo, parCodigo).subscribe({
      next: (respuesta) => {
        this.bachesDisponibles.set(respuesta.data);
        this.cargandoDisponibles.set(false);
      },
      error: () => {
        this.cargandoDisponibles.set(false);
      }
    });
  }

  asignarBache(bache: BacheDisponible) {
    this.asignando.set(bache.idRequerimiento);
    this.asignarGrupoService.asignarTarea(this.idGrupo, bache.idRequerimiento).subscribe({
      next: () => {
        this.asignando.set(null);
        this.bachesDisponibles.update(actual => actual.filter(b => b.idRequerimiento !== bache.idRequerimiento));
        this.cargarGrupo();
      },
      error: (err) => {
        this.asignando.set(null);
        this.error.set(err?.error?.message || 'No se pudo asignar el bache. Intenta de nuevo.');
      }
    });
  }

  quitarTarea(idRequerimiento: number) {
    this.quitando.set(idRequerimiento);
    this.asignarGrupoService.quitarTarea(this.idGrupo, idRequerimiento).subscribe({
      next: () => {
        this.quitando.set(null);
        this.cargarGrupo();
      },
      error: () => {
        this.quitando.set(null);
      }
    });
  }

  abrirPickerTecnicos() {
    this.errorTecnico.set(null);
    this.busquedaTecnico.set('');
    this.resultadosTecnicos.set([]);
    this.mensajeSinResultados.set(null);
    this.mostrarPickerTecnicos.set(true);
  }

  cerrarPickerTecnicos() {
    this.mostrarPickerTecnicos.set(false);
  }

  buscarTecnicos() {
    const texto = this.busquedaTecnico().trim();
    if (!texto) return;

    this.buscandoTecnicos.set(true);
    this.mensajeSinResultados.set(null);
    this.asignarGrupoService.buscarTecnicos(texto).subscribe({
      next: (respuesta) => {
        this.buscandoTecnicos.set(false);
        const yaEnGrupo = new Set((this.grupo()?.tecnicos ?? []).map(t => t.idUsuario));
        const resultados = respuesta.data.filter(t => !yaEnGrupo.has(t.idUsuario));
        this.resultadosTecnicos.set(resultados);
        this.mensajeSinResultados.set(resultados.length === 0 ? (respuesta.mensaje ?? 'No se encontraron técnicos disponibles con ese criterio.') : null);
      },
      error: () => {
        this.buscandoTecnicos.set(false);
      }
    });
  }

  // Agregar el técnico al grupo le da acceso inmediato a las tareas que el grupo ya tenía
  // asignadas (se relacionan por ID_GRUPO, no hace falta reasignarlas una por una).
  agregarTecnico(tecnico: TecnicoGrupo) {
    this.agregandoTecnico.set(tecnico.idUsuario);
    this.asignarGrupoService.agregarTecnico(this.idGrupo, tecnico.idUsuario).subscribe({
      next: () => {
        this.agregandoTecnico.set(null);
        this.resultadosTecnicos.update(actual => actual.filter(t => t.idUsuario !== tecnico.idUsuario));
        this.cargarGrupo();
      },
      error: (err) => {
        this.agregandoTecnico.set(null);
        this.errorTecnico.set(err?.error?.message || 'No se pudo agregar el técnico. Intenta de nuevo.');
      }
    });
  }

  quitarTecnico(idUsuario: number) {
    this.errorTecnico.set(null);
    this.quitandoTecnico.set(idUsuario);
    this.asignarGrupoService.quitarTecnico(this.idGrupo, idUsuario).subscribe({
      next: () => {
        this.quitandoTecnico.set(null);
        this.cargarGrupo();
      },
      error: (err) => {
        this.quitandoTecnico.set(null);
        this.errorTecnico.set(err?.error?.message || 'No se pudo quitar el técnico. Intenta de nuevo.');
      }
    });
  }
}
