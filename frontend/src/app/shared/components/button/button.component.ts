import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './button.component.html'
})
export class ButtonComponent {
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() variant: 'primary' | 'secondary' | 'danger' = 'primary';
  @Input() disabled: boolean = false;
  @Input() cargando: boolean = false;

  @Output() btnClick = new EventEmitter<void>();

  onClick() {
    if (!this.disabled && !this.cargando) {
      this.btnClick.emit();
    }
  }

  // Mapeo dinámico de clases de utilidad de Tailwind CSS (basado en tokens de color globales)
  getVariantClasses(): string {
    const variants = {
      primary: 'bg-primary text-on-primary hover:bg-primary-hover active:scale-98',
      secondary: 'bg-surface-alt text-text hover:bg-border active:scale-98',
      danger: 'bg-danger text-white hover:opacity-90 active:scale-98'
    };

    return variants[this.variant] || variants.primary;
  }
}