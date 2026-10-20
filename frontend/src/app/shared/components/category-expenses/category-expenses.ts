import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-category-expenses',
  standalone: true,
  templateUrl: './category-expenses.html',
  styleUrl: './category-expenses.scss'
})
export class CategoryExpenses {
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

  formatarValor(valor: number): string {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(valor || 0);
  }
}