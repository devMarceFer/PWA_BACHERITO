import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { NavigationDrawerComponent } from '../../shared/components/navigation_drawer/navigation_drawer.component';
import { NavbarTopComponent } from '../../shared/components/toolbar/toolbar.component';
import { PanelTecnicoComponent } from './panel-tecnico/panel-tecnico';
import { PanelAdminComponent } from './panel-admin/panel-admin';

@Component({
  selector: 'home',
  standalone: true,
  imports: [
    CommonModule,
    NavigationDrawerComponent,
    NavbarTopComponent,
    PanelTecnicoComponent,
    PanelAdminComponent
  ],
  templateUrl: './home.html'
})
export class HomeComponent {
  private authService = inject(AuthService);

  menuAbierto = signal(false);

  esTecnico = this.authService.tieneAcceso('MIS_TAREAS');
  esAdmin = this.authService.tieneAcceso('ASIGNAR_GRUPO');
}
