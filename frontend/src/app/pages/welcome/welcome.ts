import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-welcome',
  standalone: true,
  templateUrl: './welcome.html',
  styleUrl: './welcome.scss',
})
export class Welcome {
  private router = inject(Router);

  irParaCadastro() {
    this.router.navigate(['/cadastro']);
  }

  irParaLogin() {
    this.router.navigate(['/login']);
  }
}