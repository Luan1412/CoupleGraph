import {
  Component,
  signal,
  inject,
  OnInit,
  ChangeDetectorRef,
  computed,
  effect,
  PLATFORM_ID,
  HostListener
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SummaryCard } from '../../shared/components/summary-card/summary-card';
import { CategoriaService } from '../../core/services/categoria';
import { MovimentacaoService, MovimentacaoItem } from '../../core/services/movimentacao';
import { EspacoService, OrcamentoEspacoModel } from '../../core/services/espaco';
import { ThemeService } from '../../core/services/theme';
import { Auth } from '../../core/services/auth';

export interface SemanaChartData {
  rotulo: string;
  subRotulo: string;
  receitaValor: number;
  despesaValor: number;
  alturaReceita: number;
  alturaDespesa: number;
  barras: {
    valor: number;
    valorReal: number;
    cor: string;
    legenda: string;
    tipo: 'receita' | 'despesa';
  }[];
}

export interface ItemDistribuicaoRelatorio {
  nome: string;
  valor: number;
  percentual: number;
  cor: string;
  quantidade: number;
}

export interface EspacoResumoRelatorio {
  id: number;
  nome: string;
  cor: string;
  tipo: string;
  receitas: number;
  despesas: number;
  saldo: number;
  transacoes: number;
}

export interface SegmentoDonutRelatorio {
  nome: string;
  cor: string;
  valor: number;
  percentual: number;
  dasharray: string;
  dashoffset: string;
}

export interface ItemPlanejadoRealizado {
  nome: string;
  cor: string;
  planejado: number;
  realizado: number;
  restante: number;
  excedido: number;
  percentual: number;
  status: 'normal' | 'aviso' | 'excedido';
}

export interface GrupoPlanejadoRealizadoInfo {
  espacoId: number;
  espacoNome: string;
  espacoCor: string;
  tetoGeral: number;
  totalGasto: number;
  percentualGeral: number;
  podeEditar: boolean;
  itens: ItemPlanejadoRealizado[];
}

const STORAGE_META_KEY = 'couplegraph_espacos_meta_real_v1';

@Component({
  selector: 'app-relatorios',
  standalone: true,
  imports: [CommonModule, FormsModule, SummaryCard],
  templateUrl: './relatorios.html',
  styleUrl: './relatorios.scss'
})
export class Relatorios implements OnInit {
  private categoriaService = inject(CategoriaService);
  private movimentacaoService = inject(MovimentacaoService);
  private espacoService = inject(EspacoService);
  themeService = inject(ThemeService);
  authService = inject(Auth);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  readonly CORES_PALETA = [
    '#22C55E',
    '#3B82F6',
    '#8B5CF6',
    '#F59E0B',
    '#EF4444',
    '#06B6D4',
    '#EAB308',
    '#6366F1',
    '#EC4899'
  ];

  private inicializado = false;
  private ultimoTickProcessado = -1;

  private itensCarregados = signal<MovimentacaoItem[]>([]);
  todosEspacos = signal<{ id: number; nome: string; cor: string; tipo: string; podeEditar: boolean }[]>([]);

  // Estado do Modal Rápido de Definir Teto por Categoria
  modalDefinirTetoAberto = signal<boolean>(false);
  categoriaEdicaoTeto = signal<{
    espacoId: number;
    espacoNome: string;
    categoriaNome: string;
    cor: string;
    gastoAtual: number;
    limiteAtual: number;
  } | null>(null);
  novoLimiteValor = signal<number | null>(null);
  sugestoesTeto = signal<number[]>([]);

  // Estado do Drawer Completo de Orçamento do Espaço
  modalOrcamentoCompletoAberto = signal<boolean>(false);
  espacoIdOrcamentoCompleto = signal<number | null>(null);
  espacoNomeOrcamentoCompleto = signal<string>('');
  tetoGeralEdicao: number | null = null;
  categoriasEdicao = signal<{ id?: number; nome: string; limite: number; cor: string }[]>([]);
  novaCategoriaNome = '';
  novaCategoriaLimite: number | null = null;
  salvandoOrcamento = signal<boolean>(false);
  erroModalOrcamento = signal<string>('');
  toastMensagem = signal<string>('');

  somaCategoriasEdicao = computed(() => {
    return this.categoriasEdicao().reduce((acc, c) => acc + (Number(c.limite) || 0), 0);
  });

  // Filtro de espaço ('todos' ou ID do espaço)
  espacoFiltro = signal<string>('todos');
  dropdownEspacoAberto = signal<boolean>(false);

  // Aba de distribuição ('categoria' | 'espaco')
  abaDistribuicao = signal<'categoria' | 'espaco'>('categoria');

  // Controle reativo de datas do calendário
  presetAtivo = signal<'mes_atual' | 'ultimos_7' | 'ultimos_30' | 'ultimos_90' | 'ano_atual' | 'personalizado'>('mes_atual');
  dataInicio = signal<string>('2026-10-01');
  dataFim = signal<string>('2026-10-31');
  periodoAplicadoInicio = signal<string>('2026-10-01');
  periodoAplicadoFim = signal<string>('2026-10-31');
  erroData = signal<string>('');
  carregando = signal<boolean>(false);

  // Valores numéricos brutos e formatados para KPIs
  totalReceitasNum = signal<number>(0);
  totalDespesasNum = signal<number>(0);
  saldoNum = signal<number>(0);
  qtdReceitas = signal<number>(0);
  qtdDespesas = signal<number>(0);
  taxaEconomia = signal<number>(0);

  saldo = signal<string>('R$ 0,00');
  saldoSubtitulo = signal<string>('Saldo no período');
  saldoNegativo = signal<boolean>(false);
  receitas = signal<string>('R$ 0,00');
  despesas = signal<string>('R$ 0,00');

  // Métricas analíticas extras
  totalMovimentacoes = signal<number>(0);
  mediaGastos = signal<string>('R$ 0,00');
  mediaDiariaGastos = signal<string>('R$ 0,00');
  maiorDespesaValor = signal<string>('R$ 0,00');
  maiorDespesaDesc = signal<string>('Nenhuma despesa no período');
  maiorReceitaValor = signal<string>('R$ 0,00');
  maiorReceitaDesc = signal<string>('Nenhuma receita no período');

  // Distribuições e Gráficos
  categoriasGastos = signal<ItemDistribuicaoRelatorio[]>([]);
  espacosGastos = signal<ItemDistribuicaoRelatorio[]>([]);
  resumoPorEspaco = signal<EspacoResumoRelatorio[]>([]);
  totalGastosCategoria = signal<number>(0);
  dadosSemanas = signal<SemanaChartData[]>([]);
  maioresMovimentacoes = signal<MovimentacaoItem[]>([]);

  nomeEspacoFiltrado = computed<string>(() => {
    const filtro = this.espacoFiltro();
    if (!filtro || filtro === 'todos') return 'Todos os espaços';
    const esp = this.todosEspacos().find(e => e.id === Number(filtro));
    return esp ? esp.nome : 'Todos os espaços';
  });

  corEspacoFiltrado = computed<string | null>(() => {
    const filtro = this.espacoFiltro();
    if (!filtro || filtro === 'todos') return null;
    const esp = this.todosEspacos().find(e => e.id === Number(filtro));
    return esp ? esp.cor : null;
  });

  itensDistribuicaoAtiva = computed<ItemDistribuicaoRelatorio[]>(() => {
    return this.abaDistribuicao() === 'categoria'
      ? this.categoriasGastos()
      : this.espacosGastos();
  });

  segmentosDonut = computed<SegmentoDonutRelatorio[]>(() => {
    const itens = this.itensDistribuicaoAtiva();
    if (!itens.length) return [];

    const circunferencia = 2 * Math.PI * 66; // r = 66 => ~414.69
    let acumuladoPct = 0;

    return itens.map(item => {
      const pct = Math.max(0, Math.min(100, item.percentual));
      const comp = (pct / 100) * circunferencia;
      const offset = -((acumuladoPct / 100) * circunferencia);
      acumuladoPct += pct;

      return {
        nome: item.nome,
        cor: item.cor,
        valor: item.valor,
        percentual: item.percentual,
        dasharray: `${comp} ${circunferencia}`,
        dashoffset: `${offset}`
      };
    });
  });

  mensagemPeriodo = computed(() => {
    const inicio = this.periodoAplicadoInicio();
    const fim = this.periodoAplicadoFim();
    if (!inicio || !fim) return '';
    return `Exibindo lançamentos de ${this.formatarDataBr(inicio)} até ${this.formatarDataBr(fim)}`;
  });

  insightRelatorio = computed<string>(() => {
    const qtd = this.totalMovimentacoes();
    const rec = this.totalReceitasNum();
    const desp = this.totalDespesasNum();
    const taxa = this.taxaEconomia();
    const cats = this.categoriasGastos();

    if (qtd === 0) {
      return 'Nenhuma movimentação registrada neste intervalo. Selecione outro período ou registre novos lançamentos para visualizar gráficos e indicadores detalhados.';
    }
    if (rec > 0 && desp === 0) {
      return `Excelente desempenho! Você registrou ${this.formatarMoeda(rec)} em receitas e nenhuma despesa no período analisado.`;
    }
    if (desp > rec) {
      const deficit = this.formatarMoeda(desp - rec);
      const catTopo = cats.length > 0 ? ` A categoria "${cats[0].nome}" concentrou ${cats[0].percentual}% das saídas.` : '';
      return `Atenção: as despesas superaram as receitas em ${deficit} neste período.${catTopo} Avalie revisar os limites de orçamento das principais categorias.`;
    }
    const catTopo = cats.length > 0 ? ` O maior volume de saídas foi em "${cats[0].nome}" (${cats[0].percentual}%).` : '';
    return `Fluxo positivo no período! Você economizou ${taxa}% das receitas (${this.formatarMoeda(rec - desp)} de saldo líquido).${catTopo}`;
  });

  // Análise de Orçamento do Grupo: Planejado vs Realizado no Período
  gruposPlanejadoVsRealizado = computed<GrupoPlanejadoRealizadoInfo[]>(() => {
    const _versao = this.espacoService.versaoEspacos();
    const filtroEspaco = this.espacoFiltro();
    const espacos = this.todosEspacos();
    const todasMovs = this.itensCarregados().filter(m => m.tipo === 'despesa');

    const alvos = filtroEspaco !== 'todos'
      ? espacos.filter(e => e.id === Number(filtroEspaco))
      : espacos.filter(e => e.tipo.toLowerCase().includes('compartilhado') || espacos.length === 1);

    const listaEspacos = alvos.length > 0 ? alvos : espacos;

    return listaEspacos.map(esp => {
      const orc = this.espacoService.orcamentosPorEspaco().get(esp.id);
      const movsEspaco = todasMovs.filter(m => m.espaco_id === esp.id);
      const totalGasto = movsEspaco.reduce((acc, m) => acc + (m.valor || 0), 0);

      const gastosMap = new Map<string, number>();
      movsEspaco.forEach(m => {
        const cat = (m.categoria || 'Outros').trim();
        gastosMap.set(cat.toLowerCase(), (gastosMap.get(cat.toLowerCase()) || 0) + (m.valor || 0));
      });

      const nomesProcessados = new Set<string>();
      const itens: ItemPlanejadoRealizado[] = [];

      if (orc && orc.categorias) {
        orc.categorias.forEach(c => {
          const nome = c.nome;
          const chave = nome.toLowerCase().trim();
          nomesProcessados.add(chave);
          const planejado = Number(c.limite) || 0;
          const realizado = gastosMap.get(chave) || 0;
          const pct = planejado > 0 ? Math.round((realizado / planejado) * 100) : (realizado > 0 ? 100 : 0);
          const cor = c.cor || this.categoriaService.obterCor(nome, esp.id);
          let status: 'normal' | 'aviso' | 'excedido' = 'normal';
          if (realizado > planejado && planejado > 0) {
            status = 'excedido';
          } else if (pct >= 80) {
            status = 'aviso';
          }

          itens.push({
            nome,
            cor,
            planejado,
            realizado,
            restante: Math.max(0, planejado - realizado),
            excedido: Math.max(0, realizado - planejado),
            percentual: pct,
            status
          });
        });
      }

      movsEspaco.forEach(m => {
        const nome = (m.categoria || 'Outros').trim();
        const chave = nome.toLowerCase();
        if (!nomesProcessados.has(chave)) {
          nomesProcessados.add(chave);
          const planejado = 0;
          const realizado = gastosMap.get(chave) || 0;
          const cor = this.categoriaService.obterCor(nome, esp.id);
          itens.push({
            nome,
            cor,
            planejado: 0,
            realizado,
            restante: 0,
            excedido: realizado,
            percentual: 100,
            status: 'normal'
          });
        }
      });

      itens.sort((a, b) => b.realizado - a.realizado);

      const tetoGeral = (orc && orc.teto_geral !== null && Number(orc.teto_geral) > 0)
        ? Number(orc.teto_geral)
        : itens.reduce((acc, i) => acc + i.planejado, 0);

      const percentualGeral = tetoGeral > 0
        ? Math.min(100, Math.round((totalGasto / tetoGeral) * 100))
        : 0;

      const podeEditar = orc ? orc.pode_editar !== false : esp.podeEditar;

      return {
        espacoId: esp.id,
        espacoNome: esp.nome,
        espacoCor: esp.cor,
        tetoGeral,
        totalGasto,
        percentualGeral,
        podeEditar,
        itens
      };
    });
  });

  constructor() {
    effect(() => {
      this.themeService.moedaPadrao();
      this.espacoService.versaoEspacos();
      const itens = this.itensCarregados();
      this.processarDados(itens);
    });

    effect(() => {
      const idAtivo = this.espacoService.espacoAtivoId();
      const tick = this.espacoService.selecaoEspacoTick();
      if (!this.inicializado) {
        this.ultimoTickProcessado = tick;
        return;
      }
      if (tick === this.ultimoTickProcessado) {
        return;
      }
      this.ultimoTickProcessado = tick;

      const novoFiltro = idAtivo ? String(idAtivo) : 'todos';
      if (this.espacoFiltro() !== novoFiltro) {
        this.espacoFiltro.set(novoFiltro);
        this.processarDados(this.itensCarregados());
      }
    });
  }

  ngOnInit(): void {
    const idAtivo = this.espacoService.espacoAtivoId();
    if (idAtivo) {
      this.espacoFiltro.set(String(idAtivo));
    } else {
      this.espacoFiltro.set('todos');
    }
    this.ultimoTickProcessado = this.espacoService.selecaoEspacoTick();
    this.inicializado = true;
    this.carregarEspacos();
    this.aplicarPreset('mes_atual');
  }

  toggleDropdownEspaco(event: MouseEvent): void {
    event.stopPropagation();
    this.dropdownEspacoAberto.update(v => !v);
  }

  selecionarEspaco(valor: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.espacoFiltro.set(valor);
    if (valor !== 'todos') {
      const idNum = parseInt(valor, 10);
      if (!isNaN(idNum) && idNum > 0) {
        this.ultimoTickProcessado = this.espacoService.selecaoEspacoTick() + 1;
        this.espacoService.definirEspacoAtivoId(idNum);
      }
    } else {
      this.ultimoTickProcessado = this.espacoService.selecaoEspacoTick() + 1;
      this.espacoService.definirEspacoAtivoId(null);
    }
    this.dropdownEspacoAberto.set(false);
    this.processarDados(this.itensCarregados());
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.dropdownEspacoAberto()) {
      this.dropdownEspacoAberto.set(false);
    }
  }

  private carregarEspacos(): void {
    const metaMap = this.lerMetaStorage();
    this.espacoService.listarMeusEspacos().subscribe({
      next: (lista) => {
        const coresUsadas = new Set<string>();
        const mapeados = (lista || []).map((item, idx) => {
          const id = item.espaco.id;
          const nome = item.espaco.nome;
          const meta = metaMap[id] || {};
          let cor = item.espaco.cor || meta.cor || this.CORES_PALETA[idx % this.CORES_PALETA.length];
          if (!item.espaco.cor && !meta.corPersonalizada && coresUsadas.has(cor.toUpperCase())) {
            const alt = this.CORES_PALETA.find(c => !coresUsadas.has(c.toUpperCase()));
            cor = alt || this.CORES_PALETA[idx % this.CORES_PALETA.length];
          }
          coresUsadas.add(cor.toUpperCase());

          const numMembros = item.espaco.total_membros || 1;
          const tipoMeta = meta.tipo || (numMembros > 1 ? 'compartilhado' : 'individual');
          const tipo = tipoMeta === 'individual' ? 'Individual' : 'Compartilhado';
          const meuId = this.authService.usuarioAtual()?.id;
          const ehAdmin = item.papel === 'admin' || item.papel === 'administrador' || (meuId && item.espaco.criado_por === meuId) || numMembros <= 1;

          return { id, nome, cor, tipo, podeEditar: !!ehAdmin };
        });
        this.todosEspacos.set(mapeados);
        const ids = (lista || []).map(item => item.espaco.id);
        this.espacoService.carregarOrcamentosDeEspacos(ids);
        this.processarDados(this.itensCarregados());
        this.cdr.detectChanges();
      },
      error: () => {
        this.todosEspacos.set([]);
      }
    });
  }

  aplicarPreset(preset: 'mes_atual' | 'ultimos_7' | 'ultimos_30' | 'ultimos_90' | 'ano_atual'): void {
    this.presetAtivo.set(preset);
    this.erroData.set('');
    const hoje = new Date();
    const refDate = hoje.getFullYear() >= 2026 ? hoje : new Date('2026-10-21');

    let inicio = '';
    let fim = '';

    if (preset === 'mes_atual') {
      const ano = refDate.getFullYear();
      const mes = refDate.getMonth();
      inicio = this.formatarDataIso(new Date(ano, mes, 1));
      fim = this.formatarDataIso(new Date(ano, mes + 1, 0));
    } else if (preset === 'ultimos_7') {
      const d = new Date(refDate.getTime() - 6 * 86400000);
      inicio = this.formatarDataIso(d);
      fim = this.formatarDataIso(refDate);
    } else if (preset === 'ultimos_30') {
      const d = new Date(refDate.getTime() - 29 * 86400000);
      inicio = this.formatarDataIso(d);
      fim = this.formatarDataIso(refDate);
    } else if (preset === 'ultimos_90') {
      const d = new Date(refDate.getTime() - 89 * 86400000);
      inicio = this.formatarDataIso(d);
      fim = this.formatarDataIso(refDate);
    } else if (preset === 'ano_atual') {
      const ano = refDate.getFullYear();
      inicio = `${ano}-01-01`;
      fim = `${ano}-12-31`;
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
      this.erroData.set(
        `A data inicial (${this.formatarDataBr(inicio)}) é maior que a data final (${this.formatarDataBr(fim)}).`
      );
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
      this.erroData.set(
        `A data inicial (${this.formatarDataBr(inicio)}) não pode ser posterior à data final (${this.formatarDataBr(fim)}).`
      );
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
        const lista = itens || [];
        this.itensCarregados.set(lista);
        this.processarDados(lista);
        this.carregando.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erro ao listar movimentações para o relatório:', err);
        this.itensCarregados.set([]);
        this.processarDados([]);
        this.carregando.set(false);
        this.cdr.detectChanges();
      }
    });
  }

  private processarDados(todosItens: MovimentacaoItem[]): void {
    const filtroEspaco = this.espacoFiltro();
    const itens =
      !filtroEspaco || filtroEspaco === 'todos'
        ? todosItens
        : todosItens.filter(m => m.espaco_id === Number(filtroEspaco));

    const receitasItens = itens.filter(m => m.tipo === 'receita');
    const despesasItens = itens.filter(m => m.tipo === 'despesa');

    const totalRec = receitasItens.reduce((acc, m) => acc + (m.valor || 0), 0);
    const totalDesp = despesasItens.reduce((acc, m) => acc + (m.valor || 0), 0);
    const saldoVal = totalRec - totalDesp;
    const taxa = totalRec > 0 ? Math.max(0, Math.round(((totalRec - totalDesp) / totalRec) * 100)) : 0;

    this.totalReceitasNum.set(totalRec);
    this.totalDespesasNum.set(totalDesp);
    this.saldoNum.set(saldoVal);
    this.qtdReceitas.set(receitasItens.length);
    this.qtdDespesas.set(despesasItens.length);
    this.taxaEconomia.set(taxa);

    this.receitas.set(this.formatarMoeda(totalRec));
    this.despesas.set(this.formatarMoeda(totalDesp));
    this.saldo.set(this.formatarMoeda(saldoVal));
    this.saldoNegativo.set(saldoVal < 0);
    this.saldoSubtitulo.set(saldoVal >= 0 ? 'Resultado positivo no período' : 'Resultado negativo no período');

    // Resumo e médias
    this.totalMovimentacoes.set(itens.length);
    const mediaPorLancamento = despesasItens.length > 0 ? totalDesp / despesasItens.length : 0;
    this.mediaGastos.set(this.formatarMoeda(mediaPorLancamento));

    const diasPeriodo = this.calcularDiasPeriodo(this.periodoAplicadoInicio(), this.periodoAplicadoFim());
    this.mediaDiariaGastos.set(this.formatarMoeda(totalDesp / Math.max(1, diasPeriodo)));

    // Maior Despesa e Maior Receita
    if (despesasItens.length > 0) {
      const maiorD = [...despesasItens].sort((a, b) => (b.valor || 0) - (a.valor || 0))[0];
      this.maiorDespesaValor.set(this.formatarMoeda(maiorD.valor || 0));
      this.maiorDespesaDesc.set(`${maiorD.descricao} (${maiorD.categoria})`);
    } else {
      this.maiorDespesaValor.set(this.formatarMoeda(0));
      this.maiorDespesaDesc.set('Sem despesas no período');
    }

    if (receitasItens.length > 0) {
      const maiorR = [...receitasItens].sort((a, b) => (b.valor || 0) - (a.valor || 0))[0];
      this.maiorReceitaValor.set(this.formatarMoeda(maiorR.valor || 0));
      this.maiorReceitaDesc.set(`${maiorR.descricao} (${maiorR.categoria})`);
    } else {
      this.maiorReceitaValor.set(this.formatarMoeda(0));
      this.maiorReceitaDesc.set('Sem receitas no período');
    }

    // 1. Gastos por Categoria
    const mapaGastosCat = new Map<string, { valor: number; qtd: number }>();
    despesasItens.forEach(m => {
      const cat = (m.categoria || 'Outros').trim();
      const atual = mapaGastosCat.get(cat) || { valor: 0, qtd: 0 };
      mapaGastosCat.set(cat, { valor: atual.valor + (m.valor || 0), qtd: atual.qtd + 1 });
    });

    const categoriasGlobais = this.categoriaService.categorias();
    const listaCategorias: ItemDistribuicaoRelatorio[] = [];
    const espId = this.espacoFiltro() !== 'todos' ? Number(this.espacoFiltro()) : undefined;

    mapaGastosCat.forEach((dados, catNome) => {
      const catCadastrada = categoriasGlobais.find(
        c => c.nome.toLowerCase() === catNome.toLowerCase()
      );
      listaCategorias.push({
        nome: catCadastrada ? catCadastrada.nome : catNome,
        valor: dados.valor,
        quantidade: dados.qtd,
        percentual: totalDesp > 0 ? Math.max(1, Math.round((dados.valor / totalDesp) * 100)) : 0,
        cor: this.categoriaService.obterCor(catNome, espId)
      });
    });

    listaCategorias.sort((a, b) => b.valor - a.valor);
    this.categoriasGastos.set(listaCategorias);
    this.totalGastosCategoria.set(totalDesp);

    // 2. Gastos por Espaço & Desempenho por Espaço
    const espacosCadastrados = this.todosEspacos();
    const resumoEspacos: EspacoResumoRelatorio[] = espacosCadastrados.map((esp, idx) => {
      const movsEsp = todosItens.filter(m => m.espaco_id === esp.id);
      const recEsp = movsEsp.filter(m => m.tipo === 'receita').reduce((a, m) => a + (m.valor || 0), 0);
      const despEsp = movsEsp.filter(m => m.tipo === 'despesa').reduce((a, m) => a + (m.valor || 0), 0);
      return {
        id: esp.id,
        nome: esp.nome,
        cor: esp.cor || this.CORES_PALETA[idx % this.CORES_PALETA.length],
        tipo: esp.tipo,
        receitas: recEsp,
        despesas: despEsp,
        saldo: recEsp - despEsp,
        transacoes: movsEsp.length
      };
    });
    this.resumoPorEspaco.set(resumoEspacos);

    const totalDespTodosEspacos = resumoEspacos.reduce((acc, e) => acc + e.despesas, 0);
    const listaEspacosDist: ItemDistribuicaoRelatorio[] = resumoEspacos
      .filter(e => e.despesas > 0)
      .sort((a, b) => b.despesas - a.despesas)
      .map(e => ({
        nome: e.nome,
        valor: e.despesas,
        quantidade: e.transacoes,
        percentual: totalDespTodosEspacos > 0 ? Math.max(1, Math.round((e.despesas / totalDespTodosEspacos) * 100)) : 0,
        cor: e.cor
      }));
    this.espacosGastos.set(listaEspacosDist);

    // 3. Gráfico de Barras Evolução Receitas x Despesas
    this.dadosSemanas.set(this.gerarDadosGrafico(itens, this.periodoAplicadoInicio(), this.periodoAplicadoFim()));

    // 4. Maiores Movimentações do Período (Top 5)
    const topMovs = [...itens]
      .sort((a, b) => (b.valor || 0) - (a.valor || 0))
      .slice(0, 5);
    this.maioresMovimentacoes.set(topMovs);
  }

  private gerarDadosGrafico(itens: MovimentacaoItem[], dtInicioStr: string, dtFimStr: string): SemanaChartData[] {
    const dtInicio = new Date((dtInicioStr || '2026-10-01') + 'T00:00:00');
    const dtFim = new Date((dtFimStr || '2026-10-31') + 'T23:59:59');
    const diffDias = this.calcularDiasPeriodo(dtInicioStr, dtFimStr);

    let numBlocos = 4;
    if (diffDias <= 7) {
      numBlocos = Math.max(1, diffDias);
    } else if (diffDias > 60) {
      numBlocos = 6;
    }

    const blocos: { rotulo: string; subRotulo: string; inicio: number; fim: number; rec: number; desp: number }[] = [];
    const diasPorBloco = Math.ceil(diffDias / numBlocos);

    for (let i = 0; i < numBlocos; i++) {
      const bInicio = new Date(dtInicio.getTime() + i * diasPorBloco * 86400000);
      let bFim = new Date(dtInicio.getTime() + (i + 1) * diasPorBloco * 86400000 - 1);
      if (bFim > dtFim || i === numBlocos - 1) {
        bFim = dtFim;
      }

      const d1 = bInicio.getDate().toString().padStart(2, '0');
      const m1 = (bInicio.getMonth() + 1).toString().padStart(2, '0');
      const d2 = bFim.getDate().toString().padStart(2, '0');
      const m2 = (bFim.getMonth() + 1).toString().padStart(2, '0');

      let rotulo = '';
      let subRotulo = `${d1}/${m1} - ${d2}/${m2}`;

      if (diffDias <= 7) {
        rotulo = `${d1}/${m1}`;
        subRotulo = bInicio.toLocaleDateString('pt-BR', { weekday: 'short' });
      } else if (diffDias <= 35) {
        rotulo = `Sem ${i + 1}`;
      } else {
        rotulo = `${d1}/${m1}`;
      }

      blocos.push({
        rotulo,
        subRotulo,
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
          bloco.rec += m.valor || 0;
        } else {
          bloco.desp += m.valor || 0;
        }
      }
    });

    let maiorValor = 0;
    blocos.forEach(b => {
      if (b.rec > maiorValor) maiorValor = b.rec;
      if (b.desp > maiorValor) maiorValor = b.desp;
    });

    return blocos.map(b => {
      const alturaRec =
        maiorValor > 0 && b.rec > 0 ? Math.max(10, Math.round((b.rec / maiorValor) * 100)) : 0;
      const alturaDesp =
        maiorValor > 0 && b.desp > 0 ? Math.max(10, Math.round((b.desp / maiorValor) * 100)) : 0;

      return {
        rotulo: b.rotulo,
        subRotulo: b.subRotulo,
        receitaValor: b.rec,
        despesaValor: b.desp,
        alturaReceita: alturaRec,
        alturaDespesa: alturaDesp,
        barras: [
          {
            valor: alturaRec,
            valorReal: b.rec,
            cor: '#22C55E',
            legenda: `Receitas: ${this.formatarMoeda(b.rec)}`,
            tipo: 'receita'
          },
          {
            valor: alturaDesp,
            valorReal: b.desp,
            cor: '#EF4444',
            legenda: `Despesas: ${this.formatarMoeda(b.desp)}`,
            tipo: 'despesa'
          }
        ]
      };
    });
  }

  exportarRelatorioCsv(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const filtroEspaco = this.espacoFiltro();
    const todos = this.itensCarregados();
    const itens =
      !filtroEspaco || filtroEspaco === 'todos'
        ? todos
        : todos.filter(m => m.espaco_id === Number(filtroEspaco));

    if (itens.length === 0) return;

    const resumoLinhas = [
      ['Relatorio Financeiro - CoupleGraph'],
      ['Periodo', `${this.formatarDataBr(this.periodoAplicadoInicio())} a ${this.formatarDataBr(this.periodoAplicadoFim())}`],
      ['Espaco filtrado', `"${this.nomeEspacoFiltrado().replace(/"/g, '""')}"`],
      ['Total de Receitas', this.totalReceitasNum().toFixed(2).replace('.', ',')],
      ['Total de Despesas', this.totalDespesasNum().toFixed(2).replace('.', ',')],
      ['Saldo do Periodo', this.saldoNum().toFixed(2).replace('.', ',')],
      ['Taxa de Economia (%)', `${this.taxaEconomia()}%`],
      []
    ];

    const cabecalho = ['Data', 'Tipo', 'Descricao', 'Categoria', 'Espaco', 'Valor'];
    const linhas = itens.map(m => [
      this.formatarDataBr((m.data || '').substring(0, 10)),
      m.tipo === 'receita' ? 'Receita' : 'Despesa',
      `"${(m.descricao || '').replace(/"/g, '""')}"`,
      `"${(m.categoria || '').replace(/"/g, '""')}"`,
      `"${(m.espaco_nome || this.obterNomeEspaco(m.espaco_id)).replace(/"/g, '""')}"`,
      (m.valor || 0).toFixed(2).replace('.', ',')
    ]);

    const todasLinhas = [
      ...resumoLinhas.map(r => r.join(';')),
      cabecalho.join(';'),
      ...(linhas.length > 0 ? linhas.map(l => l.join(';')) : ['Sem movimentacoes registradas no periodo;;;;;0,00'])
    ];

    const csv = '\uFEFF' + todasLinhas.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-couplegraph-${this.periodoAplicadoInicio()}-a-${this.periodoAplicadoFim()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  irParaMovimentacoes(): void {
    this.router.navigate(['/movimentacoes']);
  }

  obterNomeEspaco(espacoId: number): string {
    const esp = this.todosEspacos().find(e => e.id === espacoId);
    return esp ? esp.nome : `Espaço #${espacoId}`;
  }

  obterCorEspaco(espacoId: number): string {
    const esp = this.todosEspacos().find(e => e.id === espacoId);
    return esp ? esp.cor : '#22C55E';
  }

  formatarDataCurta(dataStr: string): string {
    if (!dataStr) return '-';
    try {
      const d = new Date(dataStr);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    } catch {
      return dataStr;
    }
  }

  private calcularDiasPeriodo(dtInicioStr: string, dtFimStr: string): number {
    const dtInicio = new Date((dtInicioStr || '2026-10-01') + 'T00:00:00');
    const dtFim = new Date((dtFimStr || '2026-10-31') + 'T23:59:59');
    const diffMs = dtFim.getTime() - dtInicio.getTime();
    return Math.max(1, Math.ceil(diffMs / 86400000));
  }

  private lerMetaStorage(): Record<number, any> {
    if (!isPlatformBrowser(this.platformId)) return {};
    try {
      const raw = localStorage.getItem(STORAGE_META_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
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
    const espId = this.espacoFiltro() !== 'todos' ? Number(this.espacoFiltro()) : undefined;
    return this.categoriaService.obterCor(nome, espId);
  }

  formatarMoeda(valor: number): string {
    return this.themeService.formatarMoeda(valor);
  }

  // =========================================================
  // MÉTODOS DE DEFINIÇÃO DE TETO DE DESPESA / ORÇAMENTO
  // =========================================================

  abrirDefinirTetoCategoria(espacoId: number, item: ItemPlanejadoRealizado, espacoNome: string): void {
    this.categoriaEdicaoTeto.set({
      espacoId,
      espacoNome,
      categoriaNome: item.nome,
      cor: item.cor,
      gastoAtual: item.realizado,
      limiteAtual: item.planejado
    });

    const valorBase = item.planejado > 0
      ? item.planejado
      : (item.realizado > 0 ? Math.ceil((item.realizado * 1.15) / 50) * 50 : 500);

    this.novoLimiteValor.set(valorBase);

    const gasto = item.realizado;
    if (gasto > 0) {
      const s1 = Math.ceil(gasto / 100) * 100;
      const s2 = s1 + (s1 < 1000 ? 150 : 300);
      const s3 = s2 + (s1 < 1000 ? 200 : 500);
      this.sugestoesTeto.set([s1, s2, s3]);
    } else {
      this.sugestoesTeto.set([300, 500, 1000]);
    }

    this.erroModalOrcamento.set('');
    this.modalDefinirTetoAberto.set(true);
  }

  definirSugestao(valor: number): void {
    this.novoLimiteValor.set(valor);
  }

  fecharModalDefinirTeto(): void {
    this.modalDefinirTetoAberto.set(false);
    this.categoriaEdicaoTeto.set(null);
  }

  salvarTetoCategoria(): void {
    const info = this.categoriaEdicaoTeto();
    if (!info) return;

    const valor = Number(this.novoLimiteValor());
    if (isNaN(valor) || valor < 0) {
      this.erroModalOrcamento.set('Informe um valor de teto válido.');
      return;
    }

    this.salvandoOrcamento.set(true);
    this.erroModalOrcamento.set('');

    const orcAtual = this.espacoService.orcamentosPorEspaco().get(info.espacoId);
    let cats: { id?: number; nome: string; limite: number; cor?: string }[] = [];

    if (orcAtual && orcAtual.categorias) {
      cats = orcAtual.categorias.map(c => ({
        id: c.id,
        nome: c.nome,
        limite: c.nome.toLowerCase().trim() === info.categoriaNome.toLowerCase().trim() ? valor : c.limite,
        cor: c.cor
      }));
    }

    const jaExiste = cats.some(c => c.nome.toLowerCase().trim() === info.categoriaNome.toLowerCase().trim());
    if (!jaExiste) {
      cats.push({
        nome: info.categoriaNome,
        limite: valor,
        cor: info.cor
      });
    }

    const tetoGeral = orcAtual && orcAtual.teto_geral !== null ? orcAtual.teto_geral : null;

    this.espacoService.salvarOrcamentoEspaco(info.espacoId, {
      teto_geral: tetoGeral,
      categorias: cats
    }).subscribe({
      next: () => {
        this.salvandoOrcamento.set(false);
        this.fecharModalDefinirTeto();
        this.mostrarToast(`Teto para ${info.categoriaNome} atualizado para ${this.formatarMoeda(valor)} com sucesso!`);
        this.espacoService.carregarOrcamentosDeEspacos([info.espacoId]);
        this.processarDados(this.itensCarregados());
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.salvandoOrcamento.set(false);
        const msg = err?.error?.detail || 'Erro ao salvar teto. Verifique suas permissões.';
        this.erroModalOrcamento.set(msg);
      }
    });
  }

  mostrarToast(msg: string): void {
    this.toastMensagem.set(msg);
    setTimeout(() => {
      this.toastMensagem.set('');
    }, 4000);
  }

  abrirOrcamentoCompleto(espacoId: number, espacoNome: string): void {
    this.fecharModalDefinirTeto();
    this.espacoIdOrcamentoCompleto.set(espacoId);
    this.espacoNomeOrcamentoCompleto.set(espacoNome);
    this.erroModalOrcamento.set('');

    const orcAtual = this.espacoService.orcamentosPorEspaco().get(espacoId);
    if (orcAtual) {
      this.tetoGeralEdicao = orcAtual.teto_geral;
      this.categoriasEdicao.set(orcAtual.categorias.map(c => ({
        id: c.id,
        nome: c.nome,
        limite: c.limite,
        cor: c.cor || this.categoriaService.obterCor(c.nome, espacoId)
      })));
    } else {
      this.tetoGeralEdicao = null;
      this.categoriasEdicao.set([]);
    }

    this.modalOrcamentoCompletoAberto.set(true);
  }

  fecharModalOrcamentoCompleto(): void {
    this.modalOrcamentoCompletoAberto.set(false);
    this.espacoIdOrcamentoCompleto.set(null);
  }

  adicionarCategoriaNaEdicao(): void {
    const nome = this.novaCategoriaNome.trim();
    if (!nome) {
      this.erroModalOrcamento.set('Informe o nome da categoria.');
      return;
    }
    const lista = this.categoriasEdicao();
    if (lista.some(c => c.nome.toLowerCase() === nome.toLowerCase())) {
      this.erroModalOrcamento.set('Esta categoria já existe na lista.');
      return;
    }

    const espId = this.espacoIdOrcamentoCompleto();
    const nova = {
      nome,
      limite: this.novaCategoriaLimite !== null ? Math.max(0, this.novaCategoriaLimite) : 0,
      cor: this.categoriaService.obterCor(nome, espId || undefined)
    };
    this.categoriasEdicao.set([...lista, nova]);
    this.novaCategoriaNome = '';
    this.novaCategoriaLimite = null;
    this.erroModalOrcamento.set('');
  }

  removerCategoriaNaEdicao(identificador: number | string): void {
    this.categoriasEdicao.update(lista =>
      lista.filter(c => (c.id !== undefined ? c.id !== identificador : c.nome !== identificador))
    );
  }

  usarSomaCategoriasNoTeto(): void {
    this.tetoGeralEdicao = null;
  }

  salvarModalOrcamentoCompleto(): void {
    const espId = this.espacoIdOrcamentoCompleto();
    if (!espId) return;

    this.salvandoOrcamento.set(true);
    this.erroModalOrcamento.set('');

    const catsPayload = this.categoriasEdicao().map(c => ({
      id: c.id,
      nome: c.nome.trim(),
      limite: Number(c.limite) || 0,
      cor: c.cor
    }));

    this.espacoService.salvarOrcamentoEspaco(espId, {
      teto_geral: this.tetoGeralEdicao,
      categorias: catsPayload
    }).subscribe({
      next: () => {
        this.salvandoOrcamento.set(false);
        this.fecharModalOrcamentoCompleto();
        this.mostrarToast('Orçamento e tetos do espaço salvos com sucesso!');
        this.espacoService.carregarOrcamentosDeEspacos([espId]);
        this.processarDados(this.itensCarregados());
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.salvandoOrcamento.set(false);
        const msg = err?.error?.detail || 'Erro ao salvar orçamento do espaço.';
        this.erroModalOrcamento.set(msg);
      }
    });
  }
}
