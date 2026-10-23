import { Component, signal, inject, OnInit, ChangeDetectorRef, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SummaryCard } from '../../shared/components/summary-card/summary-card';
import { EspacoService, EspacoUsuarioModel, OrcamentoEspacoModel } from '../../core/services/espaco';
import { CategoriaService, CategoriaItem } from '../../core/services/categoria';
import { MovimentacaoService, MovimentacaoItem } from '../../core/services/movimentacao';
import { ThemeService } from '../../core/services/theme';
import { Auth } from '../../core/services/auth';

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
  private authService = inject(Auth);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private inicializado = false;
  private ultimoTickProcessado = -1;

  // Filtros
  espacoSelecionadoId = signal<string>(
    this.espacoService.espacoAtivoId() ? String(this.espacoService.espacoAtivoId()) : 'todos'
  );
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

  // Escopo de Orçamento: 'grupo' (quando em espaço compartilhado) ou 'pessoal' (próprio do usuário)
  abaOrcamento = signal<'grupo' | 'pessoal'>('grupo');
  orcamentoGrupo = signal<OrcamentoEspacoModel | null>(null);
  carregandoOrcamentoGrupo = signal<boolean>(false);
  gastosPorCategoriaMap = signal<Map<string, number>>(new Map());
  toastMensagem = signal<string>('');

  // Identificação do Espaço Selecionado e Permissões
  espacoSelecionadoObj = computed(() => {
    const idStr = this.espacoSelecionadoId();
    if (idStr === 'todos') return null;
    const idNum = parseInt(idStr, 10);
    return this.listaEspacos().find(item => item.espaco.id === idNum) || null;
  });

  ehEspacoCompartilhado = computed(() => {
    const esp = this.espacoSelecionadoObj();
    if (!esp) return false;
    const total = esp.espaco.total_membros || esp.espaco.membros_detalhes?.length || 1;
    return total > 1;
  });

  ehAdminDoEspacoFiltrado = computed(() => {
    const esp = this.espacoSelecionadoObj();
    if (!esp) return false;
    const meuEmail = (this.authService.usuarioAtual()?.email || '').toLowerCase().trim();
    const meuId = this.authService.usuarioAtual()?.id;

    if (esp.papel === 'admin' || esp.papel === 'administrador') return true;
    if (meuId && esp.espaco.criado_por === meuId) return true;

    const detalhe = esp.espaco.membros_detalhes?.find(m =>
      (meuId && m.usuario_id && m.usuario_id === meuId) ||
      (meuEmail && m.email && m.email.toLowerCase().trim() === meuEmail)
    );
    return detalhe ? (detalhe.papel === 'admin' || detalhe.papel === 'administrador') : (esp.papel === 'admin');
  });

  // Orçamentos por Categoria (adaptado reativamente para Grupo vs Pessoal)
  orcamentos = computed<CategoriaItem[]>(() => {
    const gastosMap = this.gastosPorCategoriaMap();
    if (this.ehEspacoCompartilhado() && this.abaOrcamento() === 'grupo') {
      const grupo = this.orcamentoGrupo();
      if (!grupo || !grupo.categorias || grupo.categorias.length === 0) {
        const distinctCats = Array.from(gastosMap.keys());
        if (distinctCats.length > 0) {
          const espId = Number(this.espacoSelecionadoId());
          return distinctCats.map(catNome => {
            const nomeFormatado = catNome.charAt(0).toUpperCase() + catNome.slice(1);
            return {
              id: 'esp-' + catNome,
              nome: nomeFormatado,
              limite: 0,
              gasto: gastosMap.get(catNome) || 0,
              cor: this.categoriaService.obterCor(catNome, espId)
            };
          });
        }
        return [];
      }
      return grupo.categorias.map(c => {
        const gasto = gastosMap.get(c.nome.toLowerCase().trim()) || 0;
        return {
          id: String(c.id || c.nome),
          nome: c.nome,
          limite: c.limite,
          gasto,
          cor: c.cor || this.categoriaService.obterCor(c.nome, grupo.espaco_id)
        };
      });
    }

    // Modo Pessoal
    return this.categoriaService.categorias().map(c => ({
      ...c,
      cor: c.cor || this.categoriaService.obterCor(c.nome),
      gasto: gastosMap.get(c.nome.toLowerCase().trim()) || 0
    }));
  });

  // Total do Orçamento Planejado vs Gasto
  totalPlanejado = computed(() => {
    if (this.ehEspacoCompartilhado() && this.abaOrcamento() === 'grupo') {
      const grupo = this.orcamentoGrupo();
      if (grupo && grupo.teto_geral !== null && grupo.teto_geral > 0) {
        return grupo.teto_geral;
      }
      return this.orcamentos().reduce((acc, c) => acc + (c.limite || 0), 0);
    }
    return this.categoriaService.totalPlanejado();
  });

  totalGastoOrcamento = computed(() => {
    return this.orcamentos().reduce((acc, c) => acc + (c.gasto || 0), 0);
  });

  percentualGeralOrcamento = computed(() => {
    const total = this.totalPlanejado();
    if (total === 0) return 0;
    return Math.min(100, Math.round((this.totalGastoOrcamento() / total) * 100));
  });

  // Categorias em Alerta (>= 80% do limite planejado)
  categoriasEmAlerta = computed(() => {
    return this.orcamentos().filter(item => item.limite > 0 && (item.gasto / item.limite) >= 0.8);
  });

  qtdCategoriasEmAlerta = computed(() => this.categoriasEmAlerta().length);

  ehLimiteExcedido(gasto: number, limite: number): boolean {
    return limite > 0 && gasto >= limite;
  }

  ehAlerta80(gasto: number, limite: number): boolean {
    if (limite <= 0) return false;
    const razao = gasto / limite;
    return razao >= 0.8 && razao < 1;
  }

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
  tetoGeralEdicao: number | null = null;
  novaCategoriaNome = '';
  novaCategoriaLimite: number | null = null;
  erroModalOrcamento = signal<string>('');

  somaCategoriasEdicao = computed(() => {
    return this.categoriasEdicao().reduce((acc, c) => acc + (Number(c.limite) || 0), 0);
  });

  constructor() {
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

      untracked(() => {
        const novoFiltro = idAtivo ? String(idAtivo) : 'todos';
        if (this.espacoSelecionadoId() !== novoFiltro) {
          this.espacoSelecionadoId.set(novoFiltro);
          this.aplicarFiltros();
        }
      });
    });
  }

  ngOnInit(): void {
    const espacoQuery = this.route.snapshot.queryParamMap.get('espaco');
    if (espacoQuery) {
      const idNum = parseInt(espacoQuery, 10);
      if (!isNaN(idNum) && idNum > 0) {
        this.espacoService.definirEspacoAtivoId(idNum);
        this.espacoSelecionadoId.set(String(idNum));
      }
    } else {
      const idAtivo = this.espacoService.espacoAtivoId();
      if (idAtivo) {
        this.espacoSelecionadoId.set(String(idAtivo));
      }
    }

    this.ultimoTickProcessado = this.espacoService.selecaoEspacoTick();
    this.inicializado = true;
    this.carregarDados();

    if (this.route.snapshot.queryParamMap.get('ajustar') === '1') {
      setTimeout(() => this.abrirModalOrcamento(), 150);
    }
  }

  carregarDados(): void {
    this.carregando.set(true);
    this.espacoService.listarMeusEspacos().subscribe({
      next: (dados) => {
        const lista = dados || [];
        this.listaEspacos.set(lista);
        if (lista.length > 0) {
          const filtroAtual = this.espacoSelecionadoId();
          if (filtroAtual !== 'todos') {
            const idFiltro = parseInt(filtroAtual, 10);
            const existe = lista.some(e => e.espaco.id === idFiltro);
            if (!existe) {
              const primeiroId = lista[0].espaco.id;
              this.ultimoTickProcessado = this.espacoService.selecaoEspacoTick() + 1;
              this.espacoService.definirEspacoAtivoId(primeiroId);
              this.espacoSelecionadoId.set(String(primeiroId));
            }
          }
        }
        const idAtual = Number(this.espacoSelecionadoId());
        if (idAtual > 0) {
          this.carregarOrcamentoGrupo(idAtual);
        }
        this.aplicarPreset('mes_atual');
      },
      error: (err) => {
        console.error('Erro ao carregar espaços em finanças:', err);
        this.listaEspacos.set([]);
        this.aplicarPreset('mes_atual');
      }
    });
  }

  onEspacoChange(valor: string): void {
    const strVal = String(valor);
    this.espacoSelecionadoId.set(strVal);
    if (strVal !== 'todos') {
      const idNum = parseInt(strVal, 10);
      if (!isNaN(idNum) && idNum > 0) {
        this.ultimoTickProcessado = this.espacoService.selecaoEspacoTick() + 1;
        this.espacoService.definirEspacoAtivoId(idNum);
        this.carregarOrcamentoGrupo(idNum);
      }
    } else {
      this.ultimoTickProcessado = this.espacoService.selecaoEspacoTick() + 1;
      this.espacoService.definirEspacoAtivoId(null);
      this.orcamentoGrupo.set(null);
      this.abaOrcamento.set('pessoal');
    }
    this.aplicarFiltros();
  }

  carregarOrcamentoGrupo(espacoId: number): void {
    const esp = this.listaEspacos().find(item => item.espaco.id === espacoId);
    const numMembros = esp?.espaco.total_membros || esp?.espaco.membros_detalhes?.length || 1;
    const ehCompartilhado = numMembros > 1;

    if (!ehCompartilhado) {
      this.orcamentoGrupo.set(null);
      this.abaOrcamento.set('pessoal');
      return;
    }

    this.carregandoOrcamentoGrupo.set(true);
    this.espacoService.obterOrcamentoEspaco(espacoId).subscribe({
      next: (dados) => {
        this.orcamentoGrupo.set(dados);
        if (dados?.categorias) {
          this.categoriaService.armazenarCoresEspaco(espacoId, dados.categorias);
        }
        this.abaOrcamento.set('grupo');
        this.carregandoOrcamentoGrupo.set(false);
        this.cdr.detectChanges();
      },
      error: () => {
        this.orcamentoGrupo.set(null);
        this.abaOrcamento.set('pessoal');
        this.carregandoOrcamentoGrupo.set(false);
        this.cdr.detectChanges();
      }
    });
  }

  selecionarAbaOrcamento(aba: 'grupo' | 'pessoal'): void {
    this.abaOrcamento.set(aba);
    this.cdr.detectChanges();
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

  private requisicaoFinId = 0;

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

    const reqId = ++this.requisicaoFinId;
    this.erroData.set('');
    this.periodoAplicadoInicio.set(inicio);
    this.periodoAplicadoFim.set(fim);
    this.carregandoFiltro.set(true);

    const espacoId = this.espacoSelecionadoId();
    const idEspNum = Number(espacoId);
    const espacoParam = (!espacoId || espacoId === 'todos' || isNaN(idEspNum) || idEspNum <= 0)
      ? undefined
      : idEspNum;

    const filtros = {
      espaco_id: espacoParam,
      data_inicio: inicio,
      data_fim: fim
    };

    this.movimentacaoService.listar(filtros).subscribe({
      next: (itens) => {
        if (reqId !== this.requisicaoFinId) return;
        this.processarMovimentacoes(itens || []);
        this.carregandoFiltro.set(false);
        this.carregando.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        if (reqId !== this.requisicaoFinId) return;
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

    // Atualiza mapa de gastos reais de cada categoria
    const gastosPorCat = new Map<string, number>();
    itens.filter(m => m.tipo === 'despesa').forEach(m => {
      const cat = (m.categoria || 'Outros').toLowerCase().trim();
      gastosPorCat.set(cat, (gastosPorCat.get(cat) || 0) + (m.valor || 0));
    });
    this.gastosPorCategoriaMap.set(gastosPorCat);

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

    const filtroId = this.espacoSelecionadoId();
    const espacosFiltrados =
      filtroId === 'todos'
        ? espacos
        : espacos.filter(item => item.espaco.id === parseInt(filtroId, 10));

    const balancos: BalancoEspaco[] = espacosFiltrados.map(item => {
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
    if (this.ehEspacoCompartilhado() && this.abaOrcamento() === 'grupo') {
      if (!this.ehAdminDoEspacoFiltrado()) {
        this.exibirToast('Apenas administradores podem ajustar o orçamento deste grupo.');
        return;
      }
      const grupo = this.orcamentoGrupo();
      const clone = (grupo?.categorias || []).map(c => ({
        id: String(c.id || c.nome),
        nome: c.nome,
        limite: c.limite,
        gasto: 0,
        cor: c.cor || this.categoriaService.obterCor(c.nome, grupo?.espaco_id)
      }));

      // Se o grupo ainda não tem categorias, oferece categorias padrão sugeridas
      if (clone.length === 0) {
        const espId = Number(this.espacoSelecionadoId());
        const sugeridasMap = new Map<string, CategoriaItem>();

        const padraoNomes = ['Mercado', 'Alimentação', 'Moradia', 'Transporte', 'Lazer', 'Saúde', 'Outros'];
        padraoNomes.forEach((nome, idx) => {
          sugeridasMap.set(nome.toLowerCase().trim(), {
            id: String(idx + 1),
            nome,
            limite: 0,
            gasto: 0,
            cor: this.categoriaService.obterCor(nome, espId)
          });
        });

        const gastosMap = this.gastosPorCategoriaMap();
        gastosMap.forEach((_, catNome) => {
          const chave = catNome.toLowerCase().trim();
          if (!sugeridasMap.has(chave)) {
            const formatado = catNome.charAt(0).toUpperCase() + catNome.slice(1);
            sugeridasMap.set(chave, {
              id: 'sug-' + chave,
              nome: formatado,
              limite: 0,
              gasto: 0,
              cor: this.categoriaService.obterCor(catNome, espId)
            });
          }
        });

        this.categoriasEdicao.set(Array.from(sugeridasMap.values()));
      } else {
        this.categoriasEdicao.set(clone);
      }
      this.tetoGeralEdicao = grupo?.teto_geral ?? null;
    } else {
      const clone = this.categoriaService.categorias().map(c => ({ ...c }));
      this.categoriasEdicao.set(clone);
      this.tetoGeralEdicao = this.categoriaService.tetoGeralManual();
    }

    this.novaCategoriaNome = '';
    this.novaCategoriaLimite = null;
    this.erroModalOrcamento.set('');
    this.modalOrcamentoAberto.set(true);
    this.cdr.detectChanges();
  }

  usarSomaCategoriasNoTeto(): void {
    this.tetoGeralEdicao = null;
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
    const espId = this.ehEspacoCompartilhado() && this.abaOrcamento() === 'grupo' ? Number(this.espacoSelecionadoId()) : undefined;
    const novaCor = this.categoriaService.obterCor(nome, espId);
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
    if (this.ehEspacoCompartilhado() && this.abaOrcamento() === 'grupo') {
      const espId = Number(this.espacoSelecionadoId());
      if (!espId || isNaN(espId)) return;

      const payload = {
        teto_geral: this.tetoGeralEdicao,
        categorias: this.categoriasEdicao().map(c => ({
          nome: c.nome,
          limite: Number(c.limite) || 0,
          cor: c.cor
        }))
      };

      this.espacoService.salvarOrcamentoEspaco(espId, payload).subscribe({
        next: (atualizado) => {
          this.orcamentoGrupo.set(atualizado);
          if (atualizado?.categorias) {
            this.categoriaService.armazenarCoresEspaco(espId, atualizado.categorias);
          }
          this.fecharModalOrcamento();
          this.exibirToast('Orçamento do grupo salvo com sucesso!');
          this.cdr.detectChanges();
        },
        error: (err) => {
          const msg = err.error?.detail || 'Erro ao salvar o orçamento do grupo.';
          this.erroModalOrcamento.set(msg);
          this.cdr.detectChanges();
        }
      });
    } else {
      this.categoriaService.salvarTodas(this.categoriasEdicao(), this.tetoGeralEdicao);
      this.fecharModalOrcamento();
      this.exibirToast('Orçamento pessoal salvo com sucesso!');
    }
  }

  exibirToast(mensagem: string): void {
    this.toastMensagem.set(mensagem);
    setTimeout(() => {
      this.toastMensagem.set('');
      this.cdr.detectChanges();
    }, 3500);
    this.cdr.detectChanges();
  }

  irParaEspacos(): void {
    this.router.navigate(['/espacos']);
  }

  irParaMovimentacoes(): void {
    const espId = this.espacoSelecionadoId();
    this.router.navigate(['/movimentacoes'], {
      queryParams: espId !== 'todos' ? { espaco: espId, nova: '1' } : { nova: '1' }
    });
  }
}
