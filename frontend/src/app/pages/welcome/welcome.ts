import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ThemeService } from '../../core/services/theme';

@Component({
  selector: 'app-welcome',
  standalone: true,
  templateUrl: './welcome.html',
  styleUrl: './welcome.scss',
})
export class Welcome {
  private router = inject(Router);
  themeService = inject(ThemeService);

  irParaCadastro() {
    this.router.navigate(['/cadastro']);
  }

  irParaLogin() {
    this.router.navigate(['/login']);
  }
}