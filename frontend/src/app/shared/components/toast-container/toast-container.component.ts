import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed bottom-5 right-5 z-[999] flex flex-col gap-3 pointer-events-none">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          [attr.data-type]="toast.type"
          class="rounded-xl shadow-lg px-4 py-3 text-sm font-medium backdrop-blur-sm pointer-events-auto animate-slideIn"
          [ngClass]="{
            'bg-green-50 text-green-800 border border-green-200': toast.type === 'success',
            'bg-red-50 text-red-800 border border-red-200': toast.type === 'error',
            'bg-blue-50 text-blue-800 border border-blue-200': toast.type === 'info',
            'bg-amber-50 text-amber-800 border border-amber-200': toast.type === 'warning'
          }">
          <div class="flex items-center gap-2">
            <span>
              @switch (toast.type) {
                @case ('success') {
                  <span class="text-lg">✓</span>
                }
                @case ('error') {
                  <span class="text-lg">✕</span>
                }
                @case ('info') {
                  <span class="text-lg">ℹ</span>
                }
                @case ('warning') {
                  <span class="text-lg">⚠</span>
                }
              }
            </span>
            <span>{{ toast.message }}</span>
            <button
              type="button"
              (click)="toastService.remove(toast.id)"
              class="ml-auto text-lg opacity-60 hover:opacity-100 transition-opacity">
              ×
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .animate-slideIn {
      animation: slideIn 0.3s ease-out;
    }
  `]
})
export class ToastContainerComponent {
  toastService = inject(ToastService);
}
