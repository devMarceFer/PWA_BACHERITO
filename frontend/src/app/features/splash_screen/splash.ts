import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-splash',
  standalone: true,
  imports: [
    CommonModule, 
    MatIconModule
  ],
  templateUrl: './splash.html'
})
export class SplashComponent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);

  ngOnInit() {
    setTimeout(() => {
      // 🚀 Redirección inteligente
      if (this.authService.isLoggedIn()) {
        this.router.navigate(['/home']);
      } else {
        this.router.navigate(['/bienvenida']);
      }
    }, 3000);
  }
}