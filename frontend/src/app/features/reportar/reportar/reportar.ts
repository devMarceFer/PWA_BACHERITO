import { Component, signal, OnInit, AfterViewInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ParroquiaService } from '../../../core/services/parroquia.service';
import { ParroquiaOffline } from '../../../core/db/offline-db';
import { NavbarTopComponent } from '../../../shared/components/toolbar/toolbar.component';
import { ReporteService } from '../../../core/services/reporte.service';
import { UbicacionService } from '../../../core/services/ubicacion.service';
import { firstValueFrom } from 'rxjs';

// Importamos Leaflet de forma segura
import * as L from 'leaflet';

// Popup de confirmación mostrado tras enviar el reporte, tanto si se envió en vivo al
// servidor como si quedó guardado localmente a la espera de conexión.
interface ConfirmacionReporte {
  offline: boolean;
  parroquia: number;
  coordenadaX: string;
  coordenadaY: string;
  fotografia: string | null;
  fechaIngreso: number;
}

@Component({
  selector: 'app-reportar',
  standalone: true,
  imports: [
    MatIconModule,
    CommonModule,
    FormsModule,
    NavbarTopComponent
  ],
  templateUrl: './reportar.html'
})
export class ReportarComponent implements OnInit, AfterViewInit, OnDestroy {
  private parroquiaService = inject(ParroquiaService);
  private reporteService = inject(ReporteService);
  private ubicacionService = inject(UbicacionService);
  private http = inject(HttpClient);
  private router = inject(Router);

  // Signals de estado
  parroquiaSeleccionada = signal('');
  // Solo lectura: nombre de la calle bajo el marcador, resuelto por geocodificación inversa (Nominatim)
  calleDetectada = signal('');
  busquedaDireccion = signal('');
  imagenPreview = signal<string | null>(null);
  coordenadas = signal<{ lat: number; lng: number } | null>(null);
  parroquias = signal<ParroquiaOffline[]>([]);
  // Popup de confirmación tras enviar el reporte (online u offline)
  reporteConfirmado = signal<ConfirmacionReporte | null>(null);

  // Instancias de Leaflet
  private map!: L.Map;
  private marker!: L.Marker;

  // Coordenada por defecto centrada en Ambato, Ecuador
  private readonly defaultCoords: [number, number] = [-1.24908, -78.62722];

  async ngOnInit() {
    const data = await this.parroquiaService.obtenerParroquias('184');
    this.parroquias.set(data);
  }

  // Inicializamos el mapa únicamente cuando la vista del DOM ya está lista
  ngAfterViewInit() {
    this.inicializarMapa();
  }

  private inicializarMapa() {
    // 1. Crear mapa enganchado al ID del HTML
    this.map = L.map('mapa-reporte', {
      zoomControl: false // Quitamos los botones +/- por estética móvil, los podemos manejar gestualmente
    }).setView(this.defaultCoords, 15);

    // 2. Agregar la capa visual de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(this.map);

    // 3. Crear el marcador arrastrable (Draggable) en la posición por defecto
    // Usamos el icono estándar configurando las rutas de Leaflet
    const defaultIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41]
    });

    this.marker = L.marker(this.defaultCoords, {
      draggable: true,
      icon: defaultIcon
    }).addTo(this.map);

    // Guardar coordenadas iniciales en el Signal
    this.coordenadas.set({ lat: this.defaultCoords[0], lng: this.defaultCoords[1] });
    this.obtenerCalleDesdeCoordenadas(this.defaultCoords[0], this.defaultCoords[1]);

    // 4. Escuchar cuando el usuario arrastra el marcador
    this.marker.on('dragend', async () => {
      const position = this.marker.getLatLng();
      this.coordenadas.set({ lat: position.lat, lng: position.lng });

      // Consultamos a Nominatim qué calle es esa nueva coordenada
      await this.obtenerCalleDesdeCoordenadas(position.lat, position.lng);
    });

    // Forzar redibujo de Leaflet (evita mapas grises o rotos en contenedores dinámicos)
    setTimeout(() => {
      this.map.invalidateSize();
    }, 200);

    // Si el usuario activó "Compartir mi ubicación" en su perfil, centramos de una vez en su
    // posición real en lugar de esperar a que presione "Usar mi ubicación" manualmente.
    if (this.ubicacionService.compartirUbicacion()) {
      this.obtenerUbicacionActual();
    }
  }

  // GEOLOCALIZACIÓN: Mover el marcador a la posición del GPS
  obtenerUbicacionActual() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          this.coordenadas.set({ lat, lng });

          // Mover mapa y marcador
          this.map.setView([lat, lng], 17);
          this.marker.setLatLng([lat, lng]);

          // Resolver nombre de la calle
          await this.obtenerCalleDesdeCoordenadas(lat, lng);
        },
        () => {
          alert('No se pudo acceder a tu ubicación exacta. Por favor activa el GPS.');
        }
      );
    } else {
      alert('Tu dispositivo no soporta geolocalización.');
    }
  }

  // BÚSQUEDA: Buscar dirección de texto y mover el mapa hacia ella
  async buscarDireccion() {
    const query = this.busquedaDireccion().trim();
    if (!query) return;

    try {
      // Consultamos la API de Nominatim filtrada para Ecuador/Ambato si es posible
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Ambato, Ecuador')}&limit=1`;
      const data: any = await firstValueFrom(this.http.get(url));

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);

        this.coordenadas.set({ lat, lng });

        // Enfocar mapa y mover marcador
        this.map.setView([lat, lng], 17);
        this.marker.setLatLng([lat, lng]);

        this.calleDetectada.set(data[0].display_name.split(',')[0]);
      } else {
        alert('No se encontró la dirección introducida.');
      }
    } catch (error) {
      console.error('Error buscando dirección:', error);
    }
  }

  // GEOCERCA / REVERSE GEOLOCATION: Obtener nombre de calle a partir de lat/lng
  private async obtenerCalleDesdeCoordenadas(lat: number, lng: number) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const data: any = await firstValueFrom(this.http.get(url));

      if (data && data.address) {
        // Extraemos la calle del objeto retornado por Nominatim
        const calle = data.address.road || data.address.pedestrian || 'Calle no identificada';
        this.calleDetectada.set(calle);
      }
    } catch (error) {
      console.error('Error obteniendo calle:', error);
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.imagenPreview.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  async enviarReporte() {
    const datos = {
      parroquia: Number(this.parroquiaSeleccionada()),
      coordenadas: this.coordenadas(),
      foto: this.imagenPreview()
    };

    if (!datos.parroquia || !datos.coordenadas) {
      alert('Por favor, llena los campos requeridos y ubica el bache en el mapa.');
      return;
    }

    const resultado = await this.reporteService.enviarReporte(datos);

    if (!resultado.success) {
      alert(resultado.message);
      return;
    }

    // Mostramos el mismo popup de confirmación tanto si el reporte se envió en vivo al
    // servidor como si quedó guardado localmente a la espera de conexión, para que el
    // ciudadano siempre sepa en qué modo quedó su bache.
    this.reporteConfirmado.set({
      offline: resultado.offline,
      parroquia: datos.parroquia,
      coordenadaX: datos.coordenadas.lng.toString(),
      coordenadaY: datos.coordenadas.lat.toString(),
      fotografia: datos.foto,
      fechaIngreso: Date.now()
    });
  }

  nombreParroquia(codigo: number): string {
    return this.parroquias().find(p => p.codigo === codigo)?.nombre ?? `Parroquia ${codigo}`;
  }

  cerrarPopupConfirmacion() {
    this.reporteConfirmado.set(null);
    this.router.navigate(['/reporta']);
  }

  // Destruimos el mapa para evitar pérdidas de memoria (memory leaks)
  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }
}
