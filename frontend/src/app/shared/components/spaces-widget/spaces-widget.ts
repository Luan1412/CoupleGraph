import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-spaces-widget',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './spaces-widget.html',
  styleUrl: './spaces-widget.scss'
})
export class SpacesWidget {
  private router = inject(Router);

  @Input() espacos: any[] = [];
  @Input() carregando: boolean = false;
  @Output() acessar = new EventEmitter<any>();
  @Output() criar = new EventEmitter<void>();

  onCriar(): void {
    if (this.criar.observed) {
      this.criar.emit();
    } else {
      this.router.navigate(['/espacos']);
    }
  }

  onAcessar(espaco: any): void {
    if (this.acessar.observed) {
      this.acessar.emit(espaco);
    } else {
      this.router.navigate(['/espacos']);
    }
  }
}