import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Location } from '@angular/common';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './toolbar.component.html'
})
export class NavbarTopComponent {
  private location = inject(Location);

  // Parámetros personalizables desde cualquier pantalla
  @Input() titulo: string = 'Aplicación Municipal';
  @Input() mostrarBotonAtras: boolean = true;
  @Input() mostrarBotonMenu: boolean = false;

  // Emite cuando se presiona el botón de menú (abre el Navigation Drawer)
  @Output() menuClick = new EventEmitter<void>();

  // Método nativo para regresar a la pantalla anterior en el historial
  regresar() {
    this.location.back();
  }

  abrirMenu() {
    this.menuClick.emit();
  }
}