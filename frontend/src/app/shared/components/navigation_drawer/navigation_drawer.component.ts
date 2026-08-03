import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-navigation-drawer',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    MatIconModule
  ],
  templateUrl: './navigation_drawer.component.html'
})
export class NavigationDrawerComponent {
  private authService = inject(AuthService);

  @Input() abierto: boolean = false;
  @Output() cerrado = new EventEmitter<void>();

  get nombreUsuario(): string {
    return this.authService.usuarioActual() ?? 'Funcionario';
  }

  get tieneAccesoAsignarGrupo(): boolean {
    return this.authService.tieneAcceso('ASIGNAR_GRUPO');
  }

  get tieneAccesoGestionarAccesos(): boolean {
    return this.authService.tieneAcceso('GESTIONAR_ACCESOS');
  }

  get tieneAccesoBacherito(): boolean {
    return this.authService.tieneAcceso('REPORTAR_BACHE') || this.authService.tieneAcceso('SEGUIMIENTO_BACHE');
  }

  get tieneAccesoMisTareas(): boolean {
    return this.authService.tieneAcceso('MIS_TAREAS');
  }

  cerrar() {
    this.cerrado.emit();
  }
}
