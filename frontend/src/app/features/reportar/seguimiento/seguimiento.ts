import { AfterViewInit, Component, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MisTareasService } from '../../../core/services/mis-tareas.service';
import { AsignarGrupoService } from '../../admin/asignar-grupo/asignar-grupo.service';
import { AuthService } from '../../../core/services/auth.service';
import { LABEL_POR_ESTADO } from '../../../core/utils/estado-bache.util';
import { NavbarTopComponent } from '../../../shared/components/toolbar/toolbar.component';
import { NavigationDrawerComponent } from '../../../shared/components/navigation_drawer/navigation_drawer.component';
import { firstValueFrom } from 'rxjs';

// Importamos Leaflet de forma segura
import * as L from 'leaflet';

// Código real de OP_BACHERITO_REQ.ESTADO -> color del marcador.
// 'A' Atendido -> verde, 'E' Mantenimiento/en proceso -> amarillo, cualquier otro (I/R, sin empezar) -> rojo.
const COLOR_POR_ESTADO: Record<string, string> = {
  A: '#16a34a',
  E: '#d97706'
};
const COLOR_DEFECTO = '#dc2626';

// Forma común para pintar el mapa, sin importar si la tarea viene en vivo del servidor
// (mientras hay conexión) o de la copia local tareasTecnicoOff (respaldo sin conexión).
// nombreGrupo/tecnicos solo vienen llenos en la vista de administrador (solo lectura).
interface TareaMapa {
  idRequerimiento: number;
  nombre: string;
  coordenadaX: number;
  coordenadaY: number;
  estadoCodigo: string;
  fechaIngreso: string;
  nombreGrupo?: string | null;
  tecnicos?: string | null;
}

@Component({
  selector: 'app-seguimiento',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    NavbarTopComponent,
    NavigationDrawerComponent
  ],
  templateUrl: './seguimiento.html'
})
export class SeguimientoComponent implements AfterViewInit, OnDestroy {
  private misTareasService = inject(MisTareasService);
  private asignarGrupoService = inject(AsignarGrupoService);
  private authService = inject(AuthService);
  private router = inject(Router);

  // El administrador (ASIGNAR_GRUPO) ve TODOS los baches del sistema en modo solo lectura: puede
  // ver a qué grupo/técnico está asignado cada uno, pero no cambiar su estado desde este mapa
  // (eso es tarea exclusiva del técnico, vía MIS_TAREAS). Si además tuviera MIS_TAREAS, se
  // prioriza la vista de técnico (interactiva) sobre la de administrador.
  get esAdmin(): boolean {
    return !this.authService.tieneAcceso('MIS_TAREAS') && this.authService.tieneAcceso('ASIGNAR_GRUPO');
  }

  // Reportar un bache nuevo es una acción independiente de ver/actualizar el mapa: el administrador
  // sí puede reportar (tiene REPORTAR_BACHE asignado), solo no puede cambiar el estado de un bache
  // ajeno desde este mapa (eso queda restringido a esAdmin en el popup).
  get puedeReportar(): boolean {
    return this.authService.tieneAcceso('REPORTAR_BACHE');
  }

  menuAbierto = signal(false);
  tareaSeleccionada = signal<TareaMapa | null>(null);
  fotoCambio = signal<string | null>(null);
  guardando = signal(false);
  // Se muestra hasta que los marcadores terminan de pintarse: con todos los baches del sistema
  // (potencialmente miles, la mayoría "Atendido") pintar el mapa puede tardar un momento.
  cargando = signal(true);

  // Filtro por estado de la leyenda: qué colores se pintan en el mapa. Empiezan todos activos.
  mostrarNuevo = signal(true);
  mostrarMantenimiento = signal(true);
  mostrarAtendido = signal(true);

  private map!: L.Map;
  private marcadores: L.Marker[] = [];
  // Última lista completa cargada del servidor/local, sin filtrar; se vuelve a pintar (sin
  // volver a pedir datos) cada vez que el usuario cambia qué estados quiere ver.
  private todasLasTareas: TareaMapa[] = [];

  // Coordenada por defecto centrada en Ambato, Ecuador
  private readonly defaultCoords: [number, number] = [-1.24908, -78.62722];

  ngAfterViewInit() {
    this.inicializarMapa();
    this.cargarTareas();
  }

  private inicializarMapa() {
    this.map = L.map('mapa-seguimiento', {
      zoomControl: false
    }).setView(this.defaultCoords, 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(this.map);

    setTimeout(() => this.map.invalidateSize(), 200);
  }

  // El botón "Descargar Tareas" del Home es solo para preparar el trabajo sin conexión (ir a
  // territorio sin internet). Mientras haya conexión, este mapa se pinta con las tareas asignadas
  // en vivo desde el servidor, sin depender de que el técnico ya haya descargado nada. Solo cae a
  // la copia local (tareasTecnicoOff) si no hay conexión o el servidor no responde.
  private async cargarTareas() {
    this.cargando.set(true);

    if (this.esAdmin) {
      await this.cargarMapaAdmin();
      return;
    }

    try {
      const { tareas } = await this.misTareasService.obtenerResumenServidor();
      await this.establecerTareas(tareas.map(t => ({
        idRequerimiento: t.idRequerimiento,
        nombre: t.nombres,
        coordenadaX: t.coordenadaX,
        coordenadaY: t.coordenadaY,
        estadoCodigo: t.estadoCrudo,
        fechaIngreso: t.fechaIngreso
      })));
    } catch (error) {
      const locales = await this.misTareasService.obtenerTareasLocales();
      await this.establecerTareas(locales.map(t => ({
        idRequerimiento: t.idRequerimiento,
        nombre: t.nombreReporto,
        coordenadaX: t.coordenadaX,
        coordenadaY: t.coordenadaY,
        estadoCodigo: t.estado,
        fechaIngreso: t.fechaIngreso
      })));
    }
  }

  // Vista de administrador: todos los baches del sistema, de solo lectura.
  private async cargarMapaAdmin() {
    try {
      const respuesta = await firstValueFrom(this.asignarGrupoService.obtenerMapaAdmin());
      await this.establecerTareas(respuesta.data.map(b => ({
        idRequerimiento: b.idRequerimiento,
        nombre: b.nombres,
        coordenadaX: b.coordenadaX,
        coordenadaY: b.coordenadaY,
        estadoCodigo: b.estadoCrudo,
        fechaIngreso: b.fechaIngreso,
        nombreGrupo: b.nombreGrupo,
        tecnicos: b.tecnicos
      })));
    } catch (error) {
      console.error('No se pudo cargar el mapa de supervisión:', error);
      this.cargando.set(false);
    }
  }

  // Guarda la lista completa (sin filtrar) y pinta. Cede el hilo un instante antes de pintar para
  // que el navegador alcance a mostrar el spinner de carga antes de crear potencialmente miles de
  // marcadores (si no, con muchos baches "Atendido" la pantalla se queda congelada sin avisar).
  private async establecerTareas(tareas: TareaMapa[]) {
    this.todasLasTareas = tareas;
    await new Promise(resolve => setTimeout(resolve, 0));
    this.repintarConFiltro();
    this.cargando.set(false);
  }

  // Marca/desmarca un estado de la leyenda y vuelve a pintar con lo que ya está en memoria
  // (no vuelve a pedir datos al servidor).
  toggleFiltro(tipo: 'nuevo' | 'mantenimiento' | 'atendido') {
    if (tipo === 'nuevo') this.mostrarNuevo.update(v => !v);
    if (tipo === 'mantenimiento') this.mostrarMantenimiento.update(v => !v);
    if (tipo === 'atendido') this.mostrarAtendido.update(v => !v);
    this.repintarConFiltro();
  }

  private repintarConFiltro() {
    const filtradas = this.todasLasTareas.filter(tarea => this.pasaFiltro(tarea.estadoCodigo));
    this.dibujarMarcadores(filtradas);
  }

  // 'A' Atendido, 'E' Mantenimiento/en proceso, cualquier otro (I/R, sin empezar) cuenta como Nuevo.
  private pasaFiltro(estadoCodigo: string): boolean {
    if (estadoCodigo === 'A') return this.mostrarAtendido();
    if (estadoCodigo === 'E') return this.mostrarMantenimiento();
    return this.mostrarNuevo();
  }

  private dibujarMarcadores(tareas: TareaMapa[]) {
    this.marcadores.forEach(marcador => marcador.remove());
    this.marcadores = [];

    for (const tarea of tareas) {
      const icono = this.crearIcono(COLOR_POR_ESTADO[tarea.estadoCodigo] ?? COLOR_DEFECTO);
      // OP_BACHERITO_REQ.COORDENADAX/COORDENADAY guardan longitud/latitud (no lat/lon como en el
      // formulario de reportar), por eso Leaflet recibe [coordenadaY, coordenadaX] = [lat, lng].
      const marcador = L.marker([tarea.coordenadaY, tarea.coordenadaX], { icon: icono }).addTo(this.map);

      // El administrador puede ver el detalle de cualquier bache (aunque ya esté atendido), pero
      // solo lectura. El técnico solo puede abrir el popup de cambio de estado si aún no se atendió.
      if (this.esAdmin || tarea.estadoCodigo !== 'A') {
        marcador.on('click', () => this.abrirPopup(tarea));
      }

      this.marcadores.push(marcador);
    }
  }

  private crearIcono(color: string): L.DivIcon {
    return L.divIcon({
      className: '',
      html: `<div style="background:${color};width:22px;height:22px;border-radius:50%;border:3px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
  }

  labelEstado(codigo: string): string {
    return LABEL_POR_ESTADO[codigo] ?? codigo;
  }

  abrirPopup(tarea: TareaMapa) {
    this.fotoCambio.set(null);
    this.tareaSeleccionada.set(tarea);
  }

  cerrarPopup() {
    this.tareaSeleccionada.set(null);
    this.fotoCambio.set(null);
  }

  onFotoCambioSeleccionada(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => this.fotoCambio.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  async guardarCambio(nuevoEstado: 'A' | 'E') {
    if (this.esAdmin) return; // Solo lectura para el administrador.

    const tarea = this.tareaSeleccionada();
    if (!tarea) return;

    this.guardando.set(true);
    await this.misTareasService.cambiarEstado(tarea.idRequerimiento, nuevoEstado);
    this.guardando.set(false);
    this.cerrarPopup();
    await this.cargarTareas();
  }

  irAReportar() {
    this.router.navigate(['/reporta/nuevo']);
  }

  ngOnDestroy() {
    // Defensivo: si Leaflet lanza un error interno al desmontar (contenedor ya modificado, capa
    // de teselas todavía cargando, etc.), no debe impedir que Angular termine de limpiar el resto
    // de la vista de este componente al salir del mapa.
    try {
      if (this.map) {
        this.map.remove();
      }
    } catch (error) {
      console.error('Error al desmontar el mapa de seguimiento:', error);
    }
  }
}
