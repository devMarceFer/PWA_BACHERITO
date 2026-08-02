import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { UbicacionService } from '../../core/services/ubicacion.service';
import { CardComponent } from '../../shared/components/card/card.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { NavbarTopComponent } from '../../shared/components/toolbar/toolbar.component';
import { NavigationDrawerComponent } from '../../shared/components/navigation_drawer/navigation_drawer.component';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    CardComponent,
    ButtonComponent,
    NavbarTopComponent,
    NavigationDrawerComponent
  ],
  templateUrl: './perfil.html'
})
export class PerfilComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  themeService = inject(ThemeService);
  ubicacionService = inject(UbicacionService);

  menuAbierto = signal(false);

  get correo(): string {
    return this.authService.usuarioActual() ?? 'Sin correo registrado';
  }

  // El switch representa "modo oscuro activado" (convención estándar: apagado = tema claro,
  // encendido = tema oscuro), y la etiqueta/ícono siempre describen el tema que está activo
  // en este momento, para que nunca quede ambiguo cuál es el tema actual.
  get temaOscuroActivo(): boolean {
    return this.themeService.tema() === 'dark';
  }

  get etiquetaTema(): string {
    return this.temaOscuroActivo ? 'Tema oscuro' : 'Tema claro';
  }

  get iconoTema(): string {
    return this.temaOscuroActivo ? 'dark_mode' : 'light_mode';
  }

  alternarTema() {
    this.themeService.alternar();
  }

  alternarUbicacion() {
    this.ubicacionService.alternar();
  }

  cerrarSesion() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
