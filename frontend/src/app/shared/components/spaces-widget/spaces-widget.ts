import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ThemeService } from '../../../core/services/theme';
import { EspacoService } from '../../../core/services/espaco';

@Component({
  selector: 'app-spaces-widget',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './spaces-widget.html',
  styleUrl: './spaces-widget.scss'
})
export class SpacesWidget {
  private router = inject(Router);
  private espacoService = inject(EspacoService);
  themeService = inject(ThemeService);

  @Input() espacos: any[] = [];
  @Input() carregando: boolean = false;
  @Output() acessar = new EventEmitter<any>();
  @Output() criar = new EventEmitter<void>();

  formatarMoeda(valor: any): string {
    if (valor === null || valor === undefined || valor === '') return '';
    return this.themeService.formatarMoeda(valor);
  }

  onCriar(): void {
    if (this.criar.observed) {
      this.criar.emit();
    } else {
      this.router.navigate(['/espacos']);
    }
  }

  onAcessar(espaco: any): void {
    if (espaco?.id) {
      this.espacoService.definirEspacoAtivoId(espaco.id);
    }
    if (this.acessar.observed) {
      this.acessar.emit(espaco);
    } else {
      this.router.navigate(['/movimentacoes'], { queryParams: espaco?.id ? { espaco: espaco.id } : undefined });
    }
  }
}