import { Component, EventEmitter, Output, Input, inject } from '@angular/core';
import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.html',
  styleUrl: './header.scss'    
})
export class Header { 
  authService = inject(Auth);

  @Output() menuToggle = new EventEmitter<void>();

  @Input() menuAberto: boolean = false;

  abrirMenu() {
    this.menuToggle.emit(); 
  }
}