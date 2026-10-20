import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SummaryCard } from '../../shared/components/summary-card/summary-card';
import { CategoryExpenses } from '../../shared/components/category-expenses/category-expenses';
import { CategoriaService } from '../../core/services/categoria';

export interface SemanaChartData {
  rotulo: string;
  barras: {
    valor: number;
    cor: string;
    legenda: string;
  }[];
}

@Component({
  selector: 'app-relatorios',
  standalone: true,
  imports: [CommonModule, FormsModule, SummaryCard, CategoryExpenses],
  templateUrl: './relatorios.html',
  styleUrl: './relatorios.scss'
})
export class Relatorios {
  private categoriaService = inject(CategoriaService);

  // Período selecionado
  periodoSelecionado = signal<string>('09-2026');

  opcoesPeriodo = [
    { label: 'Setembro 2026', value: '09-2026' },
    { label: 'Outubro 2026', value: '10-2026' },
    { label: 'Novembro 2026', value: '11-2026' },
    { label: 'Dezembro 2026', value: '12-2026' },
    { label: 'Agosto 2026', value: '08-2026' },
    { label: 'Julho 2026', value: '07-2026' }
  ];

  // Cards de Resumo
  saldo = signal<string>('R$ 3.250');
  saldoSubtitulo = signal<string>('Saldo no período');
  receitas = signal<string>('R$ 5.000');
  despesas = signal<string>('R$ 1.750');

  // Gastos por Categoria ligados reativamente ao CategoriaService compartilhado
  categoriasGastos = computed(() => {
    return this.categoriaService.categorias().map(c => ({
      nome: c.nome,
      valor: c.gasto,
      cor: c.cor
    }));
  });

  totalGastosCategoria = computed(() => {
    return this.categoriasGastos().reduce((acc, c) => acc + (c.valor || 0), 0);
  });

  // Gráfico Receitas x Despesas por Semana
  dadosSemanas = signal<SemanaChartData[]>([
    {
      rotulo: 'Semana 1',
      barras: [
        { valor: 35, cor: '#8b5cf6', legenda: 'R$ 1.050' }, // Roxo
        { valor: 85, cor: '#22c55e', legenda: 'R$ 2.800' }  // Verde
      ]
    },
    {
      rotulo: 'Semana 2',
      barras: [
        { valor: 65, cor: '#f97316', legenda: 'R$ 2.200' }, // Laranja
        { valor: 25, cor: '#3b82f6', legenda: 'R$ 700' }   // Azul
      ]
    }
  ]);

  // Resumo do Período
  totalMovimentacoes = signal<number>(6);
  mediaGastos = signal<string>('R$ 400');

  filtrarPeriodo(): void {
    // Atualiza ou recalcula conforme o período selecionado
    const periodo = this.periodoSelecionado();
    if (periodo === '09-2026') {
      this.saldo.set('R$ 3.250');
      this.receitas.set('R$ 5.000');
      this.despesas.set('R$ 1.750');
      this.totalMovimentacoes.set(6);
      this.mediaGastos.set('R$ 400');
    } else {
      // Mock de outro período para demonstrar interatividade
      this.saldo.set('R$ 2.100');
      this.receitas.set('R$ 4.500');
      this.despesas.set('R$ 2.400');
      this.totalMovimentacoes.set(8);
      this.mediaGastos.set('R$ 300');
    }
  }
}
