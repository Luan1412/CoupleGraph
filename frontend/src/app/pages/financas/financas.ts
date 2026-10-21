import { Component, signal, inject, OnInit, ChangeDetectorRef, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SummaryCard } from '../../shared/components/summary-card/summary-card';
import { EspacoService, EspacoUsuarioModel } from '../../core/services/espaco';
import { CategoriaService, CategoriaItem } from '../../core/services/categoria';
import { MovimentacaoService, MovimentacaoItem } from '../../core/services/movimentacao';
import { ThemeService } from '../../core/services/theme';

export interface BalancoEspaco {
  id: number;
  nome: string;
  tipo: string;
  saldo: number;
  receitas: number;
  despesas: number;
}

@Component({
  selector: 'app-financas',
  standalone: true,
  imports: [CommonModule, FormsModule, SummaryCard],
  templateUrl: './financas.html',
  styleUrl: './financas.scss'
})
export class Financas implements OnInit {
  private espacoService = inject(EspacoService);
  private categoriaService = inject(CategoriaService);
  private movimentacaoService = inject(MovimentacaoService);
  themeService = inject(ThemeService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  // Filtros
  espacoSelecionadoId = signal<string>('todos');
  presetAtivo = signal<string>('mes_atual');
  dataInicio = signal<string>('2026-10-01');
  dataFim = signal<string>('2026-10-31');
  periodoAplicadoInicio = signal<string>('2026-10-01');
  periodoAplicadoFim = signal<string>('2026-10-31');
  erroData = signal<string>('');
  carregandoFiltro = signal<boolean>(false);

  listaEspacos = signal<EspacoUsuarioModel[]>([]);
  carregando = signal<boolean>(true);

  // Métricas do Topo
  saldoDisponivel = signal<number>(0);
  totalReceitas = signal<number>(0);
  totalDespesas = signal<number>(0);
  taxaEconomia = signal<number>(0);

  // Orçamentos por Categoria (Vindo reativamente do CategoriaService compartilhado)
  orcamentos = computed(() => this.categoriaService.categorias());

  // Total do Orçamento Planejado vs Gasto
  totalPlanejado = computed(() => this.categoriaService.totalPlanejado());
  totalGastoOrcamento = computed(() => this.categoriaService.totalGasto());

  percentualGeralOrcamento = computed(() => {
    const total = this.totalPlanejado();
    if (total === 0) return 0;
    return Math.min(100, Math.round((this.totalGastoOrcamento() / total) * 100));
  });

  // Balanço por Espaço
  balancoEspacos = signal<BalancoEspaco[]>([]);

  // Mensagem calculada dinamicamente a partir dos Signals aplicados
  mensagemPeriodo = computed(() => {
    const inicio = this.periodoAplicadoInicio();
    const fim = this.periodoAplicadoFim();
    if (!inicio || !fim) return '';
    return `Exibindo dados de ${this.formatarDataBr(inicio)} até ${this.formatarDataBr(fim)}`;
  });

  // Insight Inteligente e Universal (indivíduo, casal, grupo de amigos)
  insightTitulo = computed(() => {
    const espacoId = this.espacoSelecionadoId();
    if (espacoId !== 'todos') {
      const idNum = parseInt(espacoId, 10);
      const esp = this.balancoEspacos().find(b => b.id === idNum);
      if (esp) {
        return `Insight financeiro · ${esp.nome}`;
      }
    }
    return 'Insight financeiro inteligente';
  });

  insightDescricao = computed(() => {
    const taxa = this.taxaEconomia();
    if (taxa >= 50) {
      return `Excelente controle financeiro! Seus gastos estão bem abaixo do teto planejado (${taxa}% poupado). Esse saldo positivo pode ser destinado a reservas financeiras ou metas futuras do espaço.`;
    } else if (taxa > 0) {
      return `Bom andamento orçamentário. O consumo segue estável com ${taxa}% de sobra no período. Mantenha os limites de categoria para garantir a tranquilidade até o fechamento do mês.`;
    } else {
      return `Atenção aos limites estabelecidos. As despesas consumiram a totalidade das receitas no período. Avalie reajustar os tetos nas categorias com maior volume de gastos.`;
    }
  });

  // Estado do Modal de Limites de Orçamento
  modalOrcamentoAberto = signal<boolean>(false);
  categoriasEdicao = signal<CategoriaItem[]>([]);
  novaCategoriaNome = '';
  novaCategoriaLimite: number | null = null;
  erroModalOrcamento = signal<string>('');

  ngOnInit(): void {
    this.carregarDados();
  }

  carregarDados(): void {
    this.carregando.set(true);
    this.espacoService.listarMeusEspacos().subscribe({
      next: (dados) => {
        this.listaEspacos.set(dados || []);
        this.aplicarPreset('mes_atual');
      },
      error: (err) => {
        console.error('Erro ao carregar espaços em finanças:', err);
        this.listaEspacos.set([]);
        this.aplicarPreset('mes_atual');
      }
    });
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
    this.aplicarFiltros();
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

  aplicarFiltros(): void {
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
    this.carregandoFiltro.set(true);

    const espacoId = this.espacoSelecionadoId();
    const espacoParam = espacoId === 'todos' ? undefined : parseInt(espacoId, 10);

    const filtros = {
      espaco_id: espacoParam,
      data_inicio: inicio,
      data_fim: fim
    };

    this.movimentacaoService.listar(filtros).subscribe({
      next: (itens) => {
        this.processarMovimentacoes(itens || []);
        this.carregandoFiltro.set(false);
        this.carregando.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erro ao listar movimentações em finanças:', err);
        this.processarMovimentacoes([]);
        this.carregandoFiltro.set(false);
        this.carregando.set(false);
        this.cdr.detectChanges();
      }
    });
  }

  private processarMovimentacoes(itens: MovimentacaoItem[]): void {
    const rec = itens
      .filter(m => m.tipo === 'receita')
      .reduce((acc, m) => acc + (m.valor || 0), 0);

    const desp = itens
      .filter(m => m.tipo === 'despesa')
      .reduce((acc, m) => acc + (m.valor || 0), 0);

    const saldo = rec - desp;
    const taxa = rec > 0 ? Math.round(((rec - desp) / rec) * 100) : 0;

    this.totalReceitas.set(rec);
    this.totalDespesas.set(desp);
    this.saldoDisponivel.set(saldo);
    this.taxaEconomia.set(Math.max(0, taxa));

    // Atualiza os gastos reais de cada categoria para sincronizar com os orçamentos
    const gastosPorCat = new Map<string, number>();
    itens.filter(m => m.tipo === 'despesa').forEach(m => {
      const cat = (m.categoria || 'Outros').toLowerCase().trim();
      gastosPorCat.set(cat, (gastosPorCat.get(cat) || 0) + (m.valor || 0));
    });

    const categorias = this.categoriaService.categorias();
    categorias.forEach(cat => {
      const gasto = gastosPorCat.get(cat.nome.toLowerCase().trim()) || 0;
      this.categoriaService.atualizarCategoria(cat.id ?? cat.nome, { gasto });
    });

    // Atualiza o balanço por espaço
    this.atualizarBalancoEspacos(itens);
  }

  private atualizarBalancoEspacos(itens: MovimentacaoItem[]): void {
    const espacos = this.listaEspacos();
    if (!espacos || espacos.length === 0) {
      this.balancoEspacos.set([]);
      return;
    }

    const balancos: BalancoEspaco[] = espacos.map(item => {
      const numMembros = item.espaco.total_membros || 1;
      const tipo = numMembros > 1 ? `Compartilhado · ${numMembros} pessoas` : 'Espaço pessoal';

      const movsDoEspaco = itens.filter(m => m.espaco_id === item.espaco.id);
      const rec = movsDoEspaco
        .filter(m => m.tipo === 'receita')
        .reduce((acc, m) => acc + (m.valor || 0), 0);
      const desp = movsDoEspaco
        .filter(m => m.tipo === 'despesa')
        .reduce((acc, m) => acc + (m.valor || 0), 0);
      const saldo = rec - desp;

      return {
        id: item.espaco.id,
        nome: item.espaco.nome,
        tipo,
        saldo,
        receitas: rec,
        despesas: desp
      };
    });

    this.balancoEspacos.set(balancos);
  }

  calcularPorcentagem(gasto: number, limite: number): number {
    if (limite === 0) return 0;
    return Math.min(100, Math.round((gasto / limite) * 100));
  }

  formatarMoeda(valor: number): string {
    return this.themeService.formatarMoeda(valor);
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

  // Abertura e Gestão do Modal de Orçamentos
  abrirModalOrcamento(): void {
    const clone = this.categoriaService.categorias().map(c => ({ ...c }));
    this.categoriasEdicao.set(clone);
    this.novaCategoriaNome = '';
    this.novaCategoriaLimite = null;
    this.erroModalOrcamento.set('');
    this.modalOrcamentoAberto.set(true);
    this.cdr.detectChanges();
  }

  fecharModalOrcamento(): void {
    this.modalOrcamentoAberto.set(false);
    this.erroModalOrcamento.set('');
    this.cdr.detectChanges();
  }

  adicionarCategoriaNaEdicao(): void {
    const nome = this.novaCategoriaNome.trim();
    const limite = this.novaCategoriaLimite ?? 0;

    if (!nome) {
      this.erroModalOrcamento.set('Informe o nome da nova categoria.');
      this.cdr.detectChanges();
      return;
    }

    if (limite < 0) {
      this.erroModalOrcamento.set('O limite deve ser um valor positivo.');
      this.cdr.detectChanges();
      return;
    }

    const jaExiste = this.categoriasEdicao().some(
      c => c.nome.toLowerCase() === nome.toLowerCase()
    );
    if (jaExiste) {
      this.erroModalOrcamento.set('Já existe uma categoria com este nome.');
      this.cdr.detectChanges();
      return;
    }

    this.erroModalOrcamento.set('');
    const novaCor = this.categoriaService.obterProximaCor();
    const novaCat: CategoriaItem = {
      id: Date.now().toString(),
      nome,
      limite,
      gasto: 0,
      cor: novaCor
    };

    this.categoriasEdicao.update(lista => [...lista, novaCat]);
    this.novaCategoriaNome = '';
    this.novaCategoriaLimite = null;
    this.cdr.detectChanges();
  }

  removerCategoriaNaEdicao(idOuNome: string): void {
    this.categoriasEdicao.update(lista => lista.filter(c => (c.id || c.nome) !== idOuNome));
    this.cdr.detectChanges();
  }

  salvarModalOrcamento(): void {
    this.categoriaService.salvarTodas(this.categoriasEdicao());
    this.fecharModalOrcamento();
  }

  irParaEspacos(): void {
    this.router.navigate(['/espacos']);
  }

  irParaMovimentacoes(): void {
    this.router.navigate(['/movimentacoes']);
  }
}
