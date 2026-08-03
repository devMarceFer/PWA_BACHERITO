import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';

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
  private router = inject(Router);
  private toast = inject(ToastService);

  @Input() abierto: boolean = false;
  @Output() cerrado = new EventEmitter<void>();

  get nombreUsuario(): string {
    return this.authService.usuarioActual() ?? 'Funcionario';
  }

  get rolUsuario(): string {
    const tieneAdmin = this.tieneAccesoAsignarGrupo || this.tieneAccesoGestionarAccesos;
    const tieneMisTareas = this.tieneAccesoMisTareas;

    if (tieneAdmin) return 'Administrador';
    if (tieneMisTareas) return 'Técnico';
    return 'Usuario';
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

  logout() {
    this.cerrar();
    this.authService.logout();
    this.toast.success('Sesión cerrada correctamente');
    this.router.navigate(['/login']);
  }
}
