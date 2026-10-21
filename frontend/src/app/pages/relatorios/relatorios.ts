import { Component, signal, inject, OnInit, ChangeDetectorRef, computed } from '@angular/core';
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

  // Controle reativo de datas do calendário usando Signals
  presetAtivo = signal<string>('mes_atual');
  dataInicio = signal<string>('2026-10-01');
  dataFim = signal<string>('2026-10-31');
  periodoAplicadoInicio = signal<string>('2026-10-01');
  periodoAplicadoFim = signal<string>('2026-10-31');
  erroData = signal<string>('');
  carregando = signal<boolean>(false);

  // Cards de Resumo
  saldo = signal<string>('R$ 0,00');
  saldoSubtitulo = signal<string>('Saldo no período');
  saldoNegativo = signal<boolean>(false);
  receitas = signal<string>('R$ 0,00');
  despesas = signal<string>('R$ 0,00');

  // Gastos por Categoria
  categoriasGastos = signal<{ nome: string; valor: number; cor: string }[]>([]);
  totalGastosCategoria = signal<number>(0);

  // Gráfico Receitas x Despesas
  dadosSemanas = signal<SemanaChartData[]>([]);

  // Resumo do Período
  totalMovimentacoes = signal<number>(0);
  mediaGastos = signal<string>('R$ 0,00');

  // Mensagem calculada dinamicamente a partir dos Signals aplicados
  mensagemPeriodo = computed(() => {
    const inicio = this.periodoAplicadoInicio();
    const fim = this.periodoAplicadoFim();
    if (!inicio || !fim) return '';
    return `Exibindo lançamentos de ${this.formatarDataBr(inicio)} até ${this.formatarDataBr(fim)}`;
  });

  ngOnInit(): void {
    this.aplicarPreset('mes_atual');
  }

  aplicarPreset(preset: 'mes_atual' | 'ultimos_7' | 'ultimos_30'): void {
    this.presetAtivo.set(preset);
    this.erroData.set('');
    const hoje = new Date();
    const refDate = hoje.getFullYear() >= 2026 ? hoje : new Date('2026-10-21');

    let inicio = '';
    let fim = '';

    if (preset === 'mes_atual') {
      const ano = refDate.getFullYear();
      const mes = refDate.getMonth();
      const primeiroDia = new Date(ano, mes, 1);
      const ultimoDia = new Date(ano, mes + 1, 0);

      inicio = this.formatarDataIso(primeiroDia);
      fim = this.formatarDataIso(ultimoDia);
    } else if (preset === 'ultimos_7') {
      const seteDiasAtras = new Date(refDate.getTime() - 6 * 24 * 60 * 60 * 1000);
      inicio = this.formatarDataIso(seteDiasAtras);
      fim = this.formatarDataIso(refDate);
    } else if (preset === 'ultimos_30') {
      const trintaDiasAtras = new Date(refDate.getTime() - 29 * 24 * 60 * 60 * 1000);
      inicio = this.formatarDataIso(trintaDiasAtras);
      fim = this.formatarDataIso(refDate);
    }

    this.dataInicio.set(inicio);
    this.dataFim.set(fim);
    this.periodoAplicadoInicio.set(inicio);
    this.periodoAplicadoFim.set(fim);
    this.carregarDadosRelatorio();
  }

  onDataInicioChange(novoValor: string): void {
    this.dataInicio.set(novoValor);
    this.presetAtivo.set('personalizado');
    this.validarDatasEmTempoReal();
  }

  onDataFimChange(novoValor: string): void {
    this.dataFim.set(novoValor);
    this.presetAtivo.set('personalizado');
    this.validarDatasEmTempoReal();
  }

  private validarDatasEmTempoReal(): void {
    const inicio = this.dataInicio();
    const fim = this.dataFim();

    if (!inicio || !fim) {
      this.erroData.set('Por favor, informe a data inicial e final.');
      return;
    }

    if (inicio > fim) {
      this.erroData.set(`A data inicial (${this.formatarDataBr(inicio)}) é maior que a data final (${this.formatarDataBr(fim)}).`);
    } else {
      this.erroData.set('');
    }
  }

  filtrarPeriodo(): void {
    const inicio = this.dataInicio();
    const fim = this.dataFim();

    if (!inicio || !fim) {
      this.erroData.set('Por favor, informe a data inicial e final.');
      return;
    }

    if (inicio > fim) {
      this.erroData.set(`A data inicial (${this.formatarDataBr(inicio)}) não pode ser posterior à data final (${this.formatarDataBr(fim)}).`);
      return;
    }

    this.erroData.set('');
    this.periodoAplicadoInicio.set(inicio);
    this.periodoAplicadoFim.set(fim);
    this.carregarDadosRelatorio();
  }

  carregarDadosRelatorio(): void {
    this.carregando.set(true);

    const filtros = {
      data_inicio: this.periodoAplicadoInicio() || undefined,
      data_fim: this.periodoAplicadoFim() || undefined
    };

    this.movimentacaoService.listar(filtros).subscribe({
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

    // Gráfico de Barras flexível e adaptado ao intervalo selecionado
    this.dadosSemanas.set(this.gerarDadosGrafico(itens, this.periodoAplicadoInicio(), this.periodoAplicadoFim()));
  }

  private gerarDadosGrafico(itens: MovimentacaoItem[], dtInicioStr: string, dtFimStr: string): SemanaChartData[] {
    const dtInicio = new Date((dtInicioStr || '2026-10-01') + 'T00:00:00');
    const dtFim = new Date((dtFimStr || '2026-10-31') + 'T23:59:59');
    const diffMs = dtFim.getTime() - dtInicio.getTime();
    const diffDias = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    let numBlocos = 4;
    if (diffDias <= 4) {
      numBlocos = diffDias;
    }

    const blocos: { rotulo: string; inicio: number; fim: number; rec: number; desp: number }[] = [];
    const diasPorBloco = Math.ceil(diffDias / numBlocos);

    for (let i = 0; i < numBlocos; i++) {
      const bInicio = new Date(dtInicio.getTime() + i * diasPorBloco * 86400000);
      let bFim = new Date(dtInicio.getTime() + (i + 1) * diasPorBloco * 86400000 - 1);
      if (bFim > dtFim || i === numBlocos - 1) {
        bFim = dtFim;
      }

      let rotulo = '';
      if (diffDias <= 7) {
        const d = bInicio.getDate().toString().padStart(2, '0');
        const m = (bInicio.getMonth() + 1).toString().padStart(2, '0');
        rotulo = `${d}/${m}`;
      } else if (diffDias <= 15) {
        const d1 = bInicio.getDate().toString().padStart(2, '0');
        const d2 = bFim.getDate().toString().padStart(2, '0');
        rotulo = `Dias ${d1}-${d2}`;
      } else {
        rotulo = `Semana ${i + 1}`;
      }

      blocos.push({
        rotulo,
        inicio: bInicio.getTime(),
        fim: bFim.getTime(),
        rec: 0,
        desp: 0
      });
    }

    itens.forEach(m => {
      if (!m.data) return;
      const t = new Date(m.data).getTime();
      const bloco = blocos.find(b => t >= b.inicio && t <= b.fim) || blocos[blocos.length - 1];
      if (bloco) {
        if (m.tipo === 'receita') {
          bloco.rec += (m.valor || 0);
        } else {
          bloco.desp += (m.valor || 0);
        }
      }
    });

    let maiorValor = 0;
    blocos.forEach(b => {
      if (b.rec > maiorValor) maiorValor = b.rec;
      if (b.desp > maiorValor) maiorValor = b.desp;
    });

    return blocos.map(b => {
      const alturaRec = maiorValor > 0 && b.rec > 0
        ? Math.max(8, Math.round((b.rec / maiorValor) * 100))
        : 0;

      const alturaDesp = maiorValor > 0 && b.desp > 0
        ? Math.max(8, Math.round((b.desp / maiorValor) * 100))
        : 0;

      return {
        rotulo: b.rotulo,
        barras: [
          {
            valor: alturaRec,
            cor: '#16a34a',
            legenda: `Receitas: ${this.formatarMoeda(b.rec)}`
          },
          {
            valor: alturaDesp,
            cor: '#ef4444',
            legenda: `Despesas: ${this.formatarMoeda(b.desp)}`
          }
        ]
      };
    });
  }

  private formatarDataIso(data: Date): string {
    const ano = data.getFullYear();
    const mes = (data.getMonth() + 1).toString().padStart(2, '0');
    const dia = data.getDate().toString().padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  formatarDataBr(iso: string): string {
    if (!iso) return '';
    const partes = iso.split('-');
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return iso;
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
