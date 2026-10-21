import { Component, signal, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SummaryCard } from '../../shared/components/summary-card/summary-card';
import { CategoryExpenses } from '../../shared/components/category-expenses/category-expenses';
import { CategoriaService } from '../../core/services/categoria';
import { MovimentacaoService, MovimentacaoItem } from '../../core/services/movimentacao';

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
export class Relatorios implements OnInit {
  private categoriaService = inject(CategoriaService);
  private movimentacaoService = inject(MovimentacaoService);
  private cdr = inject(ChangeDetectorRef);

  // Período selecionado
  periodoSelecionado = signal<string>('10-2026');
  carregando = signal<boolean>(false);

  opcoesPeriodo = [
    { label: 'Outubro 2026', value: '10-2026', mes: 10, ano: 2026 },
    { label: 'Setembro 2026', value: '09-2026', mes: 9, ano: 2026 },
    { label: 'Agosto 2026', value: '08-2026', mes: 8, ano: 2026 },
    { label: 'Julho 2026', value: '07-2026', mes: 7, ano: 2026 },
    { label: 'Junho 2026', value: '06-2026', mes: 6, ano: 2026 },
    { label: 'Maio 2026', value: '05-2026', mes: 5, ano: 2026 },
    { label: 'Todos os períodos', value: 'todos', mes: undefined, ano: undefined }
  ];

  // Cards de Resumo
  saldo = signal<string>('R$ 0,00');
  saldoSubtitulo = signal<string>('Saldo no período');
  saldoNegativo = signal<boolean>(false);
  receitas = signal<string>('R$ 0,00');
  despesas = signal<string>('R$ 0,00');

  // Gastos por Categoria
  categoriasGastos = signal<{ nome: string; valor: number; cor: string }[]>([]);
  totalGastosCategoria = signal<number>(0);

  // Gráfico Receitas x Despesas por Semana
  dadosSemanas = signal<SemanaChartData[]>([]);

  // Resumo do Período
  totalMovimentacoes = signal<number>(0);
  mediaGastos = signal<string>('R$ 0,00');

  ngOnInit(): void {
    this.carregarDadosRelatorio();
  }

  onPeriodoChange(novoValor: string): void {
    this.periodoSelecionado.set(novoValor);
    this.carregarDadosRelatorio();
  }

  filtrarPeriodo(): void {
    this.carregarDadosRelatorio();
  }

  carregarDadosRelatorio(): void {
    this.carregando.set(true);

    const opcao = this.opcoesPeriodo.find(o => o.value === this.periodoSelecionado());
    const mes = opcao?.mes;
    const ano = opcao?.ano;

    this.movimentacaoService.listar({ mes, ano }).subscribe({
      next: (itens) => {
        this.processarDados(itens || []);
        this.carregando.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erro ao listar movimentações para o relatório:', err);
        this.processarDados([]);
        this.carregando.set(false);
        this.cdr.detectChanges();
      }
    });
  }

  private processarDados(itens: MovimentacaoItem[]): void {
    const totalRec = itens
      .filter(m => m.tipo === 'receita')
      .reduce((acc, m) => acc + (m.valor || 0), 0);

    const totalDesp = itens
      .filter(m => m.tipo === 'despesa')
      .reduce((acc, m) => acc + (m.valor || 0), 0);

    const saldoVal = totalRec - totalDesp;

    this.receitas.set(this.formatarMoeda(totalRec));
    this.despesas.set(this.formatarMoeda(totalDesp));
    this.saldo.set(this.formatarMoeda(saldoVal));
    this.saldoNegativo.set(saldoVal < 0);
    this.saldoSubtitulo.set(saldoVal >= 0 ? 'Saldo positivo no período' : 'Saldo negativo no período');

    // Resumo
    this.totalMovimentacoes.set(itens.length);
    const despesasItens = itens.filter(m => m.tipo === 'despesa');
    const media = despesasItens.length > 0 ? totalDesp / despesasItens.length : 0;
    this.mediaGastos.set(this.formatarMoeda(media));

    // Gastos por categoria reais
    const mapaGastos = new Map<string, number>();
    despesasItens.forEach(m => {
      const cat = (m.categoria || 'Outros').trim();
      mapaGastos.set(cat, (mapaGastos.get(cat) || 0) + (m.valor || 0));
    });

    const categoriasGlobais = this.categoriaService.categorias();
    const listaCategorias: { nome: string; valor: number; cor: string }[] = [];

    mapaGastos.forEach((gasto, catNome) => {
      const catCadastrada = categoriasGlobais.find(
        c => c.nome.toLowerCase() === catNome.toLowerCase()
      );
      listaCategorias.push({
        nome: catCadastrada ? catCadastrada.nome : catNome,
        valor: gasto,
        cor: catCadastrada ? catCadastrada.cor : this.gerarCorFallback(catNome)
      });
    });

    listaCategorias.sort((a, b) => b.valor - a.valor);
    this.categoriasGastos.set(listaCategorias);
    this.totalGastosCategoria.set(totalDesp);

    // Gráfico Receitas x Despesas por Semana
    const semanas = [
      { rotulo: 'Semana 1', rec: 0, desp: 0 },
      { rotulo: 'Semana 2', rec: 0, desp: 0 },
      { rotulo: 'Semana 3', rec: 0, desp: 0 },
      { rotulo: 'Semana 4', rec: 0, desp: 0 }
    ];

    itens.forEach(m => {
      let idx = 0;
      if (m.data) {
        const partes = m.data.substring(0, 10).split('-');
        const dia = partes.length === 3 ? parseInt(partes[2], 10) : new Date(m.data).getDate();
        if (dia <= 7) idx = 0;
        else if (dia <= 14) idx = 1;
        else if (dia <= 21) idx = 2;
        else idx = 3;
      }
      if (m.tipo === 'receita') {
        semanas[idx].rec += (m.valor || 0);
      } else {
        semanas[idx].desp += (m.valor || 0);
      }
    });

    let maiorValor = 0;
    semanas.forEach(s => {
      if (s.rec > maiorValor) maiorValor = s.rec;
      if (s.desp > maiorValor) maiorValor = s.desp;
    });

    const chartData: SemanaChartData[] = semanas.map(s => {
      const alturaRec = maiorValor > 0 && s.rec > 0
        ? Math.max(8, Math.round((s.rec / maiorValor) * 100))
        : 0;

      const alturaDesp = maiorValor > 0 && s.desp > 0
        ? Math.max(8, Math.round((s.desp / maiorValor) * 100))
        : 0;

      return {
        rotulo: s.rotulo,
        barras: [
          {
            valor: alturaRec,
            cor: '#16a34a',
            legenda: `Receitas: ${this.formatarMoeda(s.rec)}`
          },
          {
            valor: alturaDesp,
            cor: '#ef4444',
            legenda: `Despesas: ${this.formatarMoeda(s.desp)}`
          }
        ]
      };
    });

    this.dadosSemanas.set(chartData);
  }

  private gerarCorFallback(nome: string): string {
    const cores = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#ec4899', '#10b981', '#6366f1'];
    let hash = 0;
    for (let i = 0; i < nome.length; i++) {
      hash = nome.charCodeAt(i) + ((hash << 5) - hash);
    }
    return cores[Math.abs(hash) % cores.length];
  }

  formatarMoeda(valor: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(valor || 0);
  }
}
