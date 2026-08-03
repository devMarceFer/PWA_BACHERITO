import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  toasts = signal<Toast[]>([]);
  private toastIdCounter = 0;
  private autoCloseTimers = new Map<string, ReturnType<typeof setTimeout>>();

  show(message: string, type: ToastType = 'info', duration: number = 4000): string {
    const id = `toast-${++this.toastIdCounter}`;
    const toast: Toast = { id, message, type, duration };

    this.toasts.update(toasts => [...toasts, toast]);

    if (duration > 0) {
      const timer = setTimeout(() => this.remove(id), duration);
      this.autoCloseTimers.set(id, timer);
    }

    return id;
  }

  success(message: string, duration?: number): string {
    return this.show(message, 'success', duration);
  }

  error(message: string, duration?: number): string {
    return this.show(message, 'error', duration ?? 6000);
  }

  info(message: string, duration?: number): string {
    return this.show(message, 'info', duration);
  }

  warning(message: string, duration?: number): string {
    return this.show(message, 'warning', duration);
  }

  remove(id: string): void {
    this.toasts.update(toasts => toasts.filter(t => t.id !== id));
    const timer = this.autoCloseTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.autoCloseTimers.delete(id);
    }
  }

  clear(): void {
    this.autoCloseTimers.forEach(timer => clearTimeout(timer));
    this.autoCloseTimers.clear();
    this.toasts.set([]);
  }
}
