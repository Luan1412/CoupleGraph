import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-category-expenses',
  standalone: true,
  templateUrl: './category-expenses.html',
  styleUrl: './category-expenses.scss'
})
export class CategoryExpenses {
  @Input() total: number = 0;
  @Input() categorias: any[] = [];

  calcularPercentagem(valor: number): number {
    if (this.total === 0) return 0;
    return (valor / this.total) * 100;
  }
}