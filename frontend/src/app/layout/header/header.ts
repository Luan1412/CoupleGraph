import { Component, EventEmitter, Output, Input } from '@angular/core';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.html',
  styleUrl: './header.scss'    
})
export class Header { 
  
  @Output() menuToggle = new EventEmitter<void>();

  @Input() menuAberto: boolean = false;

  abrirMenu() {
    this.menuToggle.emit(); 
  }
}