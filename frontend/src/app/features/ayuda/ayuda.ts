import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CardComponent } from '../../shared/components/card/card.component';
import { NavigationDrawerComponent } from '../../shared/components/navigation_drawer/navigation_drawer.component';
import { NavbarTopComponent } from '../../shared/components/toolbar/toolbar.component';

@Component({
  selector: 'app-ayuda',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    CardComponent,
    NavigationDrawerComponent,
    NavbarTopComponent
  ],
  templateUrl: './ayuda.html'
})
export class AyudaComponent {
  menuAbierto = signal(false);

  pasosReporte = signal([
    { numero: 1, icono: 'warning', titulo: 'Inicia un reporte', desc: "Desde la pantalla de inicio, presiona el botón 'Reportar un hueco' para comenzar." },
    { numero: 2, icono: 'location_on', titulo: 'Selecciona la parroquia y calles', desc: 'Elige la parroquia donde se encuentra el bache e ingresa el nombre de la calle principal y secundaria (intersección).' },
    { numero: 3, icono: 'photo_camera', titulo: 'Toma una foto', desc: 'Presiona el área de foto para tomar una imagen del bache con tu cámara o selecciona una foto de tu galería.' },
    { numero: 4, icono: 'near_me', titulo: 'Indica la ubicación', desc: 'Puedes usar tu GPS para obtener tu ubicación automáticamente, o buscar y seleccionar el punto exacto en el mapa interactivo.' },
    { numero: 5, icono: 'send', titulo: 'Envía el reporte', desc: "Revisa que toda la información esté correcta y presiona 'Enviar Reporte'. Recibirás un código de seguimiento." }
  ]);

  estadosBache = signal([
    { tipo: 'pendiente', icono: 'schedule', titulo: 'Pendiente', desc: 'El reporte ha sido recibido pero aún no ha sido atendido. Está en espera de ser asignado a un equipo de mantenimiento.' },
    { tipo: 'proceso', icono: 'progress_activity', titulo: 'En proceso', desc: 'Un equipo de mantenimiento ha tomado el reporte y está trabajando en la reparación del bache.' },
    { tipo: 'atendido', icono: 'check_circle', titulo: 'Atendido', desc: 'El bache ha sido reparado y el reporte se considera resuelto. Se incluye una foto del trabajo finalizado.' }
  ]);

  consejos = signal([
    'Toma la foto de frente y con buena iluminación para que el bache se vea claramente.',
    'Indica la intersección de dos calles para facilitar la localización exacta.',
    'Asegúrate de que el GPS esté activado para una ubicación más precisa.',
    'Guarda el código de tu reporte para hacer seguimiento del estado.'
  ]);
}