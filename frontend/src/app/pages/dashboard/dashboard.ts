import { Component, OnInit, inject, signal, computed, effect, untracked, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SummaryCard } from '../../shared/components/summary-card/summary-card';
import { EspacoService } from '../../core/services/espaco';
import { MovimentacaoService, MovimentacaoItem } from '../../core/services/movimentacao';
import { CategoriaService } from '../../core/services/categoria';
import { ThemeService } from '../../core/services/theme';
import { Auth } from '../../core/services/auth';

export type IconeEspacoDash = 'casal' | 'casa' | 'viagem' | 'pessoal';

export interface EspacoCardDash {
  id: number;
  nome: string;
  tipo: string;
  cor: string;
  icone: IconeEspacoDash;
  saldo: number;
  receitas: number;
  despesas: number;
}

export interface ItemDistribuicao {
  nome: string;
  valor: number;
  percentual: number;
  cor: string;
}

const STORAGE_META_KEY = 'couplegraph_espacos_meta_real_v1';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, SummaryCard],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit {
  espacoService = inject(EspacoService);
  private movimentacaoService = inject(MovimentacaoService);
  private categoriaService = inject(CategoriaService);
  themeService = inject(ThemeService);
  authService = inject(Auth);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  private inicializado = false;
  private ultimoTickProcessado = -1;

  readonly CORES_PALETA = [
    '#22C55E',
    '#3B82F6',
    '#8B5CF6',
    '#F59E0B',
    '#EF4444',
    '#06B6D4',
    '#EAB308',
    '#6366F1',
    '#64748B'
  ];

  // Filtro de espaço no Dashboard ('todos' ou id do espaço)
  espacoFiltro = signal<string>('todos');
  abaDistribuicao = signal<'espaco' | 'categoria'>('categoria');

  carregando = signal<boolean>(true);
  todosEspacos = signal<EspacoCardDash[]>([]);
  todasMovimentacoes = signal<MovimentacaoItem[]>([]);

  // Movimentações filtradas pelo seletor do topo
  movimentacoesFiltradas = computed<MovimentacaoItem[]>(() => {
    const lista = this.todasMovimentacoes();
    const filtro = this.espacoFiltro();
    if (!filtro || filtro === 'todos') return lista;
    const idNum = Number(filtro);
    return lista.filter(m => m.espaco_id === idNum);
  });

  // Últimas 5 movimentações
  ultimasMovimentacoes = computed<MovimentacaoItem[]>(() => {
    return this.movimentacoesFiltradas().slice(0, 5);
  });

  // Indicadores principais calculados a partir dos dados reais
  receitasTotais = computed<number>(() => {
    return this.movimentacoesFiltradas()
      .filter(m => m.tipo === 'receita')
      .reduce((acc, m) => acc + (m.valor || 0), 0);
  });

  despesasTotais = computed<number>(() => {
    return this.movimentacoesFiltradas()
      .filter(m => m.tipo === 'despesa')
      .reduce((acc, m) => acc + (m.valor || 0), 0);
  });

  saldoTotal = computed<number>(() => {
    return this.receitasTotais() - this.despesasTotais();
  });

  taxaEconomia = computed<number>(() => {
    const rec = this.receitasTotais();
    const desp = this.despesasTotais();
    if (rec <= 0) return 0;
    return Math.max(0, Math.round(((rec - desp) / rec) * 100));
  });

  // Distribuição de gastos por Espaço (usa a Cor de Identificação de cada espaço)
  gastosPorEspaco = computed<ItemDistribuicao[]>(() => {
    const _versao = this.espacoService.versaoEspacos();
    const espacos = this.todosEspacos();
    const totalDesp = espacos.reduce((acc, e) => acc + e.despesas, 0);
    if (totalDesp <= 0) return [];

    return espacos
      .filter(e => e.despesas > 0)
      .map(e => ({
        nome: e.nome,
        valor: e.despesas,
        percentual: Math.round((e.despesas / totalDesp) * 100),
        cor: e.cor
      }))
      .sort((a, b) => b.valor - a.valor);
  });

  // Distribuição de gastos por Categoria
  gastosPorCategoria = computed<ItemDistribuicao[]>(() => {
    const despMovs = this.movimentacoesFiltradas().filter(m => m.tipo === 'despesa');
    const totalDesp = despMovs.reduce((acc, m) => acc + (m.valor || 0), 0);
    if (totalDesp <= 0) return [];

    const mapa = new Map<string, number>();
    despMovs.forEach(m => {
      const cat = (m.categoria || 'Outros').trim();
      mapa.set(cat, (mapa.get(cat) || 0) + (m.valor || 0));
    });

    const resultado: ItemDistribuicao[] = [];
    let idx = 0;
    mapa.forEach((valor, nome) => {
      resultado.push({
        nome,
        valor,
        percentual: Math.round((valor / totalDesp) * 100),
        cor: this.obterCorCategoria(nome, idx++)
      });
    });

    return resultado.sort((a, b) => b.valor - a.valor);
  });

  itensDistribuicaoAtiva = computed<ItemDistribuicao[]>(() => {
    return this.abaDistribuicao() === 'categoria'
      ? this.gastosPorCategoria()
      : this.gastosPorEspaco();
  });

  totalDistribuicaoAtiva = computed<number>(() => {
    return this.itensDistribuicaoAtiva().reduce((acc, item) => acc + item.valor, 0);
  });

  // Resumo de Orçamento
  totalPlanejadoOrcamento = computed<number>(() => this.categoriaService.totalPlanejado());
  tetoGeralManualAtivo = computed<number | null>(() => this.categoriaService.tetoGeralManual());
  percentualOrcamentoUsado = computed<number>(() => {
    const planejado = this.totalPlanejadoOrcamento();
    if (planejado <= 0) return 0;
    return Math.min(100, Math.round((this.despesasTotais() / planejado) * 100));
  });

  // Estado do Drawer Lateral de Teto de Orçamento no Início
  modalOrcamentoAberto = signal<boolean>(false);
  tetoGeralEdicao: number | null = null;
  categoriasEdicao = signal<any[]>([]);
  novaCategoriaNome = '';
  novaCategoriaLimite: number | null = null;
  erroModalOrcamento = signal<string>('');

  somaCategoriasEdicao = computed<number>(() => {
    return this.categoriasEdicao().reduce((acc, c) => acc + (Number(c.limite) || 0), 0);
  });

  // Estado do Drawer Lateral de Criar Novo Espaço / Grupo no Início
  modalNovoEspacoAberto = signal<boolean>(false);
  novoEspacoNome = '';
  novoEspacoTipo: 'compartilhado' | 'individual' = 'compartilhado';
  novoEspacoCor = '#22C55E';
  novoEspacoIcone: IconeEspacoDash = 'casal';
  novoEspacoEmailConvite = '';
  novosConvidados = signal<string[]>([]);
  erroNovoEspaco = signal<string>('');
  toastMensagem = signal<string>('');

  readonly iconesDisponiveis: { id: IconeEspacoDash; label: string }[] = [
    { id: 'casal', label: 'Grupo' },
    { id: 'casa', label: 'Casa' },
    { id: 'viagem', label: 'Viagem' },
    { id: 'pessoal', label: 'Pessoal' }
  ];

  // Estado do Drawer Lateral de Nova Movimentação no Início
  modalNovaMovimentacaoAberto = signal<boolean>(false);
  formTipo = signal<'receita' | 'despesa'>('despesa');
  formValor: number | null = null;
  formDescricao = '';
  formCategoria = '';
  formEspacoId: number | null = null;
  formData = '';
  salvandoMovimentacao = signal<boolean>(false);
  erroModalMovimentacao = signal<string>('');
  dropdownCategoriaAberto = signal<boolean>(false);
  termoBuscaCategoria = signal<string>('');

  categoriasDisponiveis = computed(() => this.categoriaService.categorias());
  categoriasFiltradas = computed(() => {
    const termo = this.termoBuscaCategoria().toLowerCase().trim();
    const todas = this.categoriasDisponiveis();
    if (!termo) return todas;
    return todas.filter(c => c.nome.toLowerCase().includes(termo));
  });

  nomeEspacoFiltrado = computed<string>(() => {
    const filtro = this.espacoFiltro();
    if (!filtro || filtro === 'todos') return 'Todos os espaços';
    const esp = this.todosEspacos().find(e => e.id === Number(filtro));
    return esp ? esp.nome : 'Todos os espaços';
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
        if (idAtivo) {
          this.espacoFiltro.set(String(idAtivo));
        }
      });
    });
  }

  ngOnInit(): void {
    this.ultimoTickProcessado = this.espacoService.selecaoEspacoTick();
    this.inicializado = true;
    this.carregarDadosDashboard();
  }

  carregarDadosDashboard(): void {
    this.carregando.set(true);
    const metaMap = this.lerMetaStorage();

    this.espacoService.listarMeusEspacos().subscribe({
      next: (espacosDados) => {
        this.movimentacaoService.listar().subscribe({
          next: (movs) => {
            const listaMovs = movs || [];
            this.todasMovimentacoes.set(listaMovs);

            const coresUsadas = new Set<string>();
            const espacosMapeados: EspacoCardDash[] = (espacosDados || []).map((item, idx) => {
              const id = item.espaco.id;
              const nome = item.espaco.nome;
              const meta = metaMap[id] || {};
              const padrao = this.inferirVisualPorNome(nome, idx);

              let corEspaco: string = meta.cor || padrao.cor;
              if (!meta.corPersonalizada && coresUsadas.has(corEspaco.toUpperCase())) {
                const alternativa = this.CORES_PALETA.find(c => !coresUsadas.has(c.toUpperCase()));
                corEspaco = alternativa || this.CORES_PALETA[idx % this.CORES_PALETA.length];
              }
              coresUsadas.add(corEspaco.toUpperCase());

              const extrasCount = Array.isArray(meta.participantesExtras) ? meta.participantesExtras.length : 0;
              const numMembros = Math.max(item.espaco.total_membros || 1, 1 + extrasCount);
              const tipoMeta = meta.tipo || (numMembros > 1 ? 'compartilhado' : 'individual');
              const tipoLabel =
                tipoMeta === 'individual'
                  ? 'Espaço individual · 1 pessoa'
                  : `Compartilhado · ${Math.max(2, numMembros)} pessoas`;

              const movsEspaco = listaMovs.filter(m => m.espaco_id === id);
              const rec = movsEspaco
                .filter(m => m.tipo === 'receita')
                .reduce((acc, m) => acc + (m.valor || 0), 0);
              const desp = movsEspaco
                .filter(m => m.tipo === 'despesa')
                .reduce((acc, m) => acc + (m.valor || 0), 0);

              return {
                id,
                nome,
                tipo: tipoLabel,
                cor: corEspaco,
                icone: meta.icone || padrao.icone,
                saldo: rec - desp,
                receitas: rec,
                despesas: desp
              };
            });

            this.todosEspacos.set(espacosMapeados);
            this.carregando.set(false);
            this.cdr.detectChanges();
          },
          error: () => {
            this.todasMovimentacoes.set([]);
            this.carregando.set(false);
            this.cdr.detectChanges();
          }
        });
      },
      error: (err) => {
        console.error('Erro ao carregar dados no dashboard:', err);
        this.todosEspacos.set([]);
        this.todasMovimentacoes.set([]);
        this.carregando.set(false);
        this.cdr.detectChanges();
      }
    });
  }

  onEspacoFiltroChange(valor: string): void {
    const strVal = String(valor);
    this.espacoFiltro.set(strVal);
    if (strVal !== 'todos') {
      const idNum = parseInt(strVal, 10);
      if (!isNaN(idNum) && idNum > 0) {
        this.ultimoTickProcessado = this.espacoService.selecaoEspacoTick() + 1;
        this.espacoService.definirEspacoAtivoId(idNum);
      }
    }
  }

  obterPrimeiroNome(): string {
    const nomeCompleto = this.authService.usuarioAtual()?.nome?.trim();
    if (!nomeCompleto) return 'bem-vindo(a)';
    return nomeCompleto.split(' ')[0];
  }

  obterCorCategoria(nome: string, fallbackIdx = 0): string {
    const cat = this.categoriaService.categorias().find(
      c => c.nome.toLowerCase() === (nome || '').toLowerCase()
    );
    if (cat) return cat.cor;
    return this.CORES_PALETA[fallbackIdx % this.CORES_PALETA.length];
  }

  formatarMoeda(valor: number): string {
    return this.themeService.formatarMoeda(valor);
  }

  formatarDataCurta(dataStr: string): string {
    if (!dataStr) return '-';
    try {
      const data = new Date(dataStr);
      return data.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short'
      });
    } catch {
      return dataStr;
    }
  }

  private inferirVisualPorNome(nome: string, idx: number): { cor: string; icone: IconeEspacoDash } {
    const n = nome.toLowerCase();
    if (n.includes('casa') || n.includes('imóvel') || n.includes('moradia')) {
      return { cor: '#3B82F6', icone: 'casa' };
    }
    if (n.includes('viagem') || n.includes('férias')) {
      return { cor: '#8B5CF6', icone: 'viagem' };
    }
    if (n.includes('pessoal') || n.includes('individual')) {
      return { cor: '#64748B', icone: 'pessoal' };
    }
    return {
      cor: this.CORES_PALETA[idx % this.CORES_PALETA.length],
      icone: 'casal'
    };
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

  // Navegações e Ações Rápidas
  abrirNovaMovimentacao(tipo: 'receita' | 'despesa' = 'despesa'): void {
    this.formTipo.set(tipo);
    this.formValor = null;
    this.formDescricao = '';
    this.formCategoria = '';
    this.termoBuscaCategoria.set('');
    this.dropdownCategoriaAberto.set(false);

    const espacos = this.todosEspacos();
    const filtroAtual = this.espacoFiltro();
    const idAtivo = this.espacoService.espacoAtivoId();
    if (filtroAtual !== 'todos' && !isNaN(parseInt(filtroAtual, 10))) {
      this.formEspacoId = parseInt(filtroAtual, 10);
    } else if (idAtivo && espacos.some(e => e.id === idAtivo)) {
      this.formEspacoId = idAtivo;
    } else {
      this.formEspacoId = espacos.length > 0 ? espacos[0].id : null;
    }

    this.formData = new Date().toISOString().substring(0, 10);
    this.erroModalMovimentacao.set('');
    this.modalNovaMovimentacaoAberto.set(true);
    this.cdr.detectChanges();
  }

  fecharModalNovaMovimentacao(): void {
    this.modalNovaMovimentacaoAberto.set(false);
    this.erroModalMovimentacao.set('');
    this.dropdownCategoriaAberto.set(false);
    this.cdr.detectChanges();
  }

  onInputCategoriaDash(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.formCategoria = val;
    this.termoBuscaCategoria.set(val);
    this.dropdownCategoriaAberto.set(true);
  }

  abrirDropdownCategoriaDash(): void {
    this.termoBuscaCategoria.set('');
    this.dropdownCategoriaAberto.set(true);
  }

  fecharDropdownCategoriaDash(): void {
    setTimeout(() => {
      this.dropdownCategoriaAberto.set(false);
      this.cdr.detectChanges();
    }, 180);
  }

  toggleDropdownCategoriaDash(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const novo = !this.dropdownCategoriaAberto();
    if (novo) {
      this.termoBuscaCategoria.set('');
    }
    this.dropdownCategoriaAberto.set(novo);
  }

  selecionarCategoriaDash(nome: string): void {
    this.formCategoria = nome;
    this.termoBuscaCategoria.set(nome);
    this.dropdownCategoriaAberto.set(false);
    this.cdr.detectChanges();
  }

  categoriaJaExisteDash(nome: string): boolean {
    const n = (nome || '').trim().toLowerCase();
    if (!n) return false;
    return this.categoriasDisponiveis().some(c => c.nome.toLowerCase() === n);
  }

  salvarNovaMovimentacaoDash(): void {
    if (!this.formValor || this.formValor <= 0) {
      this.erroModalMovimentacao.set('Informe um valor válido maior que zero.');
      this.cdr.detectChanges();
      return;
    }

    if (!this.formDescricao.trim()) {
      this.erroModalMovimentacao.set('Informe a descrição da movimentação.');
      this.cdr.detectChanges();
      return;
    }

    if (!this.formEspacoId) {
      this.erroModalMovimentacao.set('Selecione o espaço para esta movimentação.');
      this.cdr.detectChanges();
      return;
    }

    const categoriaInformada = (this.formCategoria || '').trim();
    if (!categoriaInformada) {
      this.erroModalMovimentacao.set('Informe ou selecione uma categoria.');
      this.cdr.detectChanges();
      return;
    }

    const existente = this.categoriasDisponiveis().find(
      c => c.nome.toLowerCase() === categoriaInformada.toLowerCase()
    );
    let nomeFinalCategoria = categoriaInformada;
    if (existente) {
      nomeFinalCategoria = existente.nome;
    } else {
      this.categoriaService.adicionarCategoria(categoriaInformada, 0);
    }

    this.salvandoMovimentacao.set(true);
    this.erroModalMovimentacao.set('');

    const dados = {
      espaco_id: Number(this.formEspacoId),
      tipo: this.formTipo(),
      descricao: this.formDescricao.trim(),
      valor: Number(this.formValor),
      categoria: nomeFinalCategoria,
      data: this.formData ? new Date(this.formData).toISOString() : new Date().toISOString()
    };

    this.movimentacaoService.criar(dados).subscribe({
      next: () => {
        this.salvandoMovimentacao.set(false);
        this.fecharModalNovaMovimentacao();
        this.carregarDadosDashboard();

        if (dados.tipo === 'despesa') {
          const cat = this.categoriasDisponiveis().find(
            c => c.nome.toLowerCase() === dados.categoria.toLowerCase()
          );
          if (cat) {
            this.categoriaService.atualizarCategoria(cat.id ?? cat.nome, {
              gasto: (cat.gasto || 0) + dados.valor
            });
          }
        }

        this.exibirToast('Movimentação registrada com sucesso!');
      },
      error: (err) => {
        this.salvandoMovimentacao.set(false);
        this.erroModalMovimentacao.set(err?.error?.detail || 'Erro ao registrar movimentação.');
        this.cdr.detectChanges();
      }
    });
  }

  verTodasMovimentacoes(): void {
    const esp = this.espacoFiltro();
    this.router.navigate(['/movimentacoes'], {
      queryParams: { espaco: esp }
    });
  }

  abrirMovimentacaoEspecifica(mov: MovimentacaoItem): void {
    if (mov && mov.espaco_id) {
      this.espacoService.definirEspacoAtivoId(mov.espaco_id);
      this.router.navigate(['/movimentacoes'], {
        queryParams: { espaco: mov.espaco_id }
      });
      return;
    }
    this.verTodasMovimentacoes();
  }

  acessarEspaco(espaco: EspacoCardDash): void {
    this.espacoService.definirEspacoAtivoId(espaco.id);
    this.router.navigate(['/movimentacoes'], {
      queryParams: { espaco: espaco.id }
    });
  }

  irParaEspacos(): void {
    this.router.navigate(['/espacos']);
  }

  irParaFinancas(): void {
    const esp = this.espacoFiltro();
    this.router.navigate(['/financas'], {
      queryParams: esp !== 'todos' ? { espaco: esp, ajustar: '1' } : { ajustar: '1' }
    });
  }

  abrirModalOrcamento(): void {
    const clone = this.categoriaService.categorias().map(c => ({ ...c }));
    this.categoriasEdicao.set(clone);
    this.tetoGeralEdicao = this.categoriaService.tetoGeralManual();
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

  usarSomaCategoriasNoTeto(): void {
    this.tetoGeralEdicao = null;
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
    this.categoriasEdicao.update(lista => [
      ...lista,
      {
        id: Date.now().toString(),
        nome,
        limite,
        gasto: 0,
        cor: novaCor
      }
    ]);
    this.novaCategoriaNome = '';
    this.novaCategoriaLimite = null;
    this.cdr.detectChanges();
  }

  removerCategoriaNaEdicao(idOuNome: string): void {
    this.categoriasEdicao.update(lista => lista.filter(c => (c.id || c.nome) !== idOuNome));
    this.cdr.detectChanges();
  }

  salvarModalOrcamento(): void {
    this.categoriaService.salvarTodas(this.categoriasEdicao(), this.tetoGeralEdicao);
    this.fecharModalOrcamento();
  }

  // --- CRIAR NOVO ESPAÇO / GRUPO DIRETO PELO INÍCIO ---
  abrirModalNovoEspaco(): void {
    this.novoEspacoNome = '';
    this.novoEspacoTipo = 'compartilhado';
    const coresEmUso = new Set(this.todosEspacos().map(e => (e.cor || '').toUpperCase()));
    const corLivre = this.CORES_PALETA.find(c => !coresEmUso.has(c.toUpperCase()));
    this.novoEspacoCor = corLivre || this.CORES_PALETA[this.todosEspacos().length % this.CORES_PALETA.length];
    this.novoEspacoIcone = 'casal';
    this.novoEspacoEmailConvite = '';
    this.novosConvidados.set([]);
    this.erroNovoEspaco.set('');
    this.modalNovoEspacoAberto.set(true);
    this.cdr.detectChanges();
  }

  fecharModalNovoEspaco(): void {
    this.modalNovoEspacoAberto.set(false);
    this.novoEspacoNome = '';
    this.erroNovoEspaco.set('');
    this.cdr.detectChanges();
  }

  selecionarTipoNovoEspaco(tipo: 'compartilhado' | 'individual'): void {
    this.novoEspacoTipo = tipo;
    if (tipo === 'individual' && this.novoEspacoIcone === 'casal') {
      this.novoEspacoIcone = 'pessoal';
    } else if (tipo === 'compartilhado' && this.novoEspacoIcone === 'pessoal') {
      this.novoEspacoIcone = 'casal';
    }
  }

  selecionarCorNovoEspaco(cor: string): void {
    this.novoEspacoCor = cor;
  }

  selecionarIconeNovoEspaco(icone: IconeEspacoDash): void {
    this.novoEspacoIcone = icone;
  }

  adicionarConvidadoLista(): void {
    const email = this.novoEspacoEmailConvite.trim();
    if (!email) return;
    if (!email.includes('@')) {
      this.erroNovoEspaco.set('Informe um e-mail válido para convidar.');
      return;
    }
    this.erroNovoEspaco.set('');
    if (!this.novosConvidados().includes(email)) {
      this.novosConvidados.update(atuais => [...atuais, email]);
    }
    if (this.novosConvidados().length > 0 && this.novoEspacoTipo === 'individual') {
      this.novoEspacoTipo = 'compartilhado';
    }
    this.novoEspacoEmailConvite = '';
  }

  removerConvidadoLista(email: string): void {
    this.novosConvidados.update(atuais => atuais.filter(e => e !== email));
  }

  salvarNovoEspaco(): void {
    const nome = this.novoEspacoNome.trim();
    if (!nome) {
      this.erroNovoEspaco.set('Informe um nome para o espaço.');
      return;
    }

    this.erroNovoEspaco.set('');

    const jaExiste = this.todosEspacos().some(
      esp => esp.nome.trim().toLowerCase() === nome.toLowerCase()
    );
    if (jaExiste) {
      this.erroNovoEspaco.set('Você já possui um espaço com esse nome.');
      this.cdr.detectChanges();
      return;
    }

    if (this.novoEspacoEmailConvite.trim() && this.novoEspacoEmailConvite.includes('@')) {
      this.adicionarConvidadoLista();
    }

    const participantesExtras: any[] = [];
    if (this.novoEspacoTipo === 'compartilhado') {
      this.novosConvidados().forEach((em, i) => {
        const nomeExtraido = em.split('@')[0];
        const formatado = nomeExtraido.charAt(0).toUpperCase() + nomeExtraido.slice(1);
        const iniciais = formatado.substring(0, 2).toUpperCase();
        participantesExtras.push({
          nome: formatado,
          email: em,
          papel: 'membro',
          iniciais,
          corAvatar: this.CORES_PALETA[(i + 2) % this.CORES_PALETA.length]
        });
      });
    }

    this.espacoService.criarEspaco({ nome }).subscribe({
      next: (novo) => {
        this.salvarMetaNoStorage(novo.id, {
          tipo: this.novoEspacoTipo,
          cor: this.novoEspacoCor,
          corPersonalizada: true,
          icone: this.novoEspacoIcone,
          participantesExtras
        });

        const numMembros = this.novoEspacoTipo === 'individual' ? 1 : Math.max(2, 1 + participantesExtras.length);
        const tipoLabel =
          this.novoEspacoTipo === 'individual'
            ? 'Espaço individual · 1 pessoa'
            : `Compartilhado · ${numMembros} pessoas`;

        const novoCard: EspacoCardDash = {
          id: novo.id,
          nome: novo.nome,
          tipo: tipoLabel,
          cor: this.novoEspacoCor,
          icone: this.novoEspacoIcone,
          saldo: 0,
          receitas: 0,
          despesas: 0
        };

        this.todosEspacos.update(lista => [...lista, novoCard]);
        this.espacoService.definirEspacoAtivoId(novo.id);
        this.fecharModalNovoEspaco();
        this.exibirToast(`Espaço "${novo.nome}" criado com sucesso!`);
        this.cdr.detectChanges();
      },
      error: (err) => {
        const msg = err.error?.detail || 'Não foi possível criar o espaço. Verifique se já existe outro com este nome.';
        this.erroNovoEspaco.set(msg);
        this.cdr.detectChanges();
      }
    });
  }

  private salvarMetaNoStorage(id: number, meta: any): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const atual = this.lerMetaStorage();
      atual[id] = meta;
      localStorage.setItem(STORAGE_META_KEY, JSON.stringify(atual));
      this.espacoService.notificarAtualizacao();
    } catch {
      // ignore
    }
  }

  exibirToast(msg: string): void {
    this.toastMensagem.set(msg);
    setTimeout(() => {
      this.toastMensagem.set('');
      this.cdr.detectChanges();
    }, 3200);
  }
}