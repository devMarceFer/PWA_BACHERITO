import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-bienvenida',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule
  ],
  templateUrl: './bienvenida.html'
})
export class BienvenidaComponent {
  private router = inject(Router);

  continuarConCorreo() {
    this.router.navigate(['/cognito/crear']);
  }

  continuarConTelefono() {
    // TODO: el registro por número de teléfono se implementará más adelante
    alert('El registro por número de teléfono estará disponible próximamente.');
  }
}
