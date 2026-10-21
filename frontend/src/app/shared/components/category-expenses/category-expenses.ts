import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../../core/services/theme';

@Component({
  selector: 'app-category-expenses',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './category-expenses.html',
  styleUrl: './category-expenses.scss'
})
export class CategoryExpenses {
  themeService = inject(ThemeService);

  @Input() titulo: string = 'Gastos por espaço';
  @Input() total: number = 0;
  @Input() itens: any[] = [];
  @Input() categorias: any[] = [];
  @Input() mensagemVazio: string = 'Sem gasto em espaços';

  get listaItens(): any[] {
    return this.itens.length > 0 ? this.itens : this.categorias;
  }

  calcularPercentagem(valor: number): number {
    if (this.total === 0) return 0;
    return Math.min(100, Math.max(0, (valor / this.total) * 100));
  }

  formatarMoeda(valor: number): string {
    return this.themeService.formatarMoeda(valor);
  }
}