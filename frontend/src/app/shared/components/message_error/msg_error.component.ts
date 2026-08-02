import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'message-input-error',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './msg_error.component.html'
})
export class InputErrorComponent {
  // El mensaje se pasa dinámicamente desde el formulario
  @Input() mensaje: string | null = '';
}