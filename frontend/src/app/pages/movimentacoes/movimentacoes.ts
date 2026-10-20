import { Component, OnInit, inject, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SummaryCard } from '../../shared/components/summary-card/summary-card';
import { MovimentacaoService, MovimentacaoItem, MovimentacaoResumo } from '../../core/services/movimentacao';
import { EspacoService, EspacoUsuarioModel } from '../../core/services/espaco';
import { CategoriaService } from '../../core/services/categoria';

@Component({
  selector: 'app-movimentacoes',
  standalone: true,
  imports: [CommonModule, FormsModule, SummaryCard],
  templateUrl: './movimentacoes.html',
  styleUrl: './movimentacoes.scss'
})
export class Movimentacoes implements OnInit {
  private movimentacaoService = inject(MovimentacaoService);
  private espacoService = inject(EspacoService);
  private categoriaService = inject(CategoriaService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  // Estados de dados
  carregando = signal<boolean>(true);
  movimentacoes = signal<MovimentacaoItem[]>([]);
  listaEspacos = signal<EspacoUsuarioModel[]>([]);
  resumo = signal<MovimentacaoResumo>({
    total_receitas: 0,
    total_despesas: 0,
    saldo: 0,
    total_movimentacoes: 0
  });

  // Categorias integradas
  categorias = computed(() => this.categoriaService.categorias());

  // Filtros
  tipoFiltro = signal<'todos' | 'receita' | 'despesa'>('todos');
  espacoFiltro = signal<string>('todos');
  categoriaFiltro = signal<string>('todas');
  buscaTexto = signal<string>('');
  periodoFiltro = signal<string>('todos');

  opcoesPeriodo = [
    { label: 'Todos os períodos', value: 'todos', mes: undefined, ano: undefined },
    { label: 'Outubro 2026', value: '10-2026', mes: 10, ano: 2026 },
    { label: 'Setembro 2026', value: '09-2026', mes: 9, ano: 2026 },
    { label: 'Novembro 2026', value: '11-2026', mes: 11, ano: 2026 },
    { label: 'Dezembro 2026', value: '12-2026', mes: 12, ano: 2026 },
    { label: 'Agosto 2026', value: '08-2026', mes: 8, ano: 2026 },
    { label: 'Julho 2026', value: '07-2026', mes: 7, ano: 2026 }
  ];

  // Estado do Modal de Criação
  modalAberto = signal<boolean>(false);
  salvando = signal<boolean>(false);
  erroModal = signal<string>('');

  formTipo = signal<'receita' | 'despesa'>('despesa');
  formValor: number | null = null;
  formDescricao = '';
  formCategoria = '';
  formEspacoId: number | null = null;
  formData = '';
  dropdownCategoriaAberto = signal<boolean>(false);
  termoBuscaCategoria = signal<string>('');

  // Estado do Modal de Edição
  modalEdicaoAberto = signal<boolean>(false);
  movimentacaoEmEdicao = signal<MovimentacaoItem | null>(null);
  salvandoEdicao = signal<boolean>(false);
  erroModalEdicao = signal<string>('');

  formEdicaoTipo = signal<'receita' | 'despesa'>('despesa');
  formEdicaoValor: number | null = null;
  formEdicaoDescricao = '';
  formEdicaoCategoria = '';
  formEdicaoEspacoId: number | null = null;
  formEdicaoData = '';
  dropdownEdicaoCategoriaAberto = signal<boolean>(false);
  termoBuscaEdicaoCategoria = signal<string>('');

  // Estado do Modal de Confirmação de Exclusão
  modalConfirmarExclusaoAberto = signal<boolean>(false);
  movimentacaoParaExcluir = signal<MovimentacaoItem | null>(null);
  excluindo = signal<boolean>(false);

  // Mensagem de Sucesso (Toast)
  mensagemSucesso = signal<string>('');

  // Retorna todas as categorias ou filtra pelo que o usuário digita (Criação)
  categoriasFiltradas = computed(() => {
    const lista = this.categorias();
    const termo = this.termoBuscaCategoria().trim().toLowerCase();
    if (!termo) {
      return lista; // Exibe todas as categorias!
    }
    return lista.filter(c => c.nome.toLowerCase().includes(termo));
  });

  // Retorna todas as categorias ou filtra pelo que o usuário digita (Edição)
  categoriasEdicaoFiltradas = computed(() => {
    const lista = this.categorias();
    const termo = this.termoBuscaEdicaoCategoria().trim().toLowerCase();
    if (!termo) {
      return lista;
    }
    return lista.filter(c => c.nome.toLowerCase().includes(termo));
  });

  // Busca categoria existente ignorando maiúsculas e minúsculas (ex: 'carro' vs 'Carro')
  obterCategoriaExistente(nome: string): any {
    if (!nome) return undefined;
    const norm = nome.trim().toLowerCase();
    return this.categorias().find(c => c.nome.trim().toLowerCase() === norm);
  }

  categoriaJaExiste(nome: string): boolean {
    return !!this.obterCategoriaExistente(nome);
  }

  onInputCategoria(event: any): void {
    const val = event?.target?.value ?? '';
    this.formCategoria = val;
    this.termoBuscaCategoria.set(val);
    this.dropdownCategoriaAberto.set(true);
  }

  abrirDropdownCategoria(): void {
    const exata = this.obterCategoriaExistente(this.formCategoria);
    if (exata) {
      this.termoBuscaCategoria.set('');
    } else {
      this.termoBuscaCategoria.set(this.formCategoria.trim());
    }
    this.dropdownCategoriaAberto.set(true);
  }

  fecharDropdownCategoria(): void {
    setTimeout(() => {
      this.dropdownCategoriaAberto.set(false);
      this.cdr.detectChanges();
    }, 200);
  }

  toggleDropdownCategoria(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.dropdownCategoriaAberto()) {
      this.termoBuscaCategoria.set('');
      this.dropdownCategoriaAberto.set(true);
    } else {
      this.dropdownCategoriaAberto.set(false);
    }
  }

  selecionarCategoria(nome: string): void {
    this.formCategoria = nome;
    this.termoBuscaCategoria.set('');
    this.dropdownCategoriaAberto.set(false);
    this.cdr.detectChanges();
  }

  // Combobox Edição
  onInputEdicaoCategoria(event: any): void {
    const val = event?.target?.value ?? '';
    this.formEdicaoCategoria = val;
    this.termoBuscaEdicaoCategoria.set(val);
    this.dropdownEdicaoCategoriaAberto.set(true);
  }

  abrirDropdownEdicaoCategoria(): void {
    const exata = this.obterCategoriaExistente(this.formEdicaoCategoria);
    if (exata) {
      this.termoBuscaEdicaoCategoria.set('');
    } else {
      this.termoBuscaEdicaoCategoria.set(this.formEdicaoCategoria.trim());
    }
    this.dropdownEdicaoCategoriaAberto.set(true);
  }

  fecharDropdownEdicaoCategoria(): void {
    setTimeout(() => {
      this.dropdownEdicaoCategoriaAberto.set(false);
      this.cdr.detectChanges();
    }, 200);
  }

  toggleDropdownEdicaoCategoria(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.dropdownEdicaoCategoriaAberto()) {
      this.termoBuscaEdicaoCategoria.set('');
      this.dropdownEdicaoCategoriaAberto.set(true);
    } else {
      this.dropdownEdicaoCategoriaAberto.set(false);
    }
  }

  selecionarEdicaoCategoria(nome: string): void {
    this.formEdicaoCategoria = nome;
    this.termoBuscaEdicaoCategoria.set('');
    this.dropdownEdicaoCategoriaAberto.set(false);
    this.cdr.detectChanges();
  }

  exibirToastSucesso(msg: string): void {
    this.mensagemSucesso.set(msg);
    setTimeout(() => {
      this.mensagemSucesso.set('');
      this.cdr.detectChanges();
    }, 3800);
  }

  ngOnInit(): void {
    this.carregarEspacos();
    this.carregarMovimentacoes();
  }

  carregarEspacos(): void {
    this.espacoService.listarMeusEspacos().subscribe({
      next: (dados) => {
        this.listaEspacos.set(dados || []);
        if (dados && dados.length > 0 && !this.formEspacoId) {
          this.formEspacoId = dados[0].espaco.id;
        }
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Erro ao carregar espaços:', err)
    });
  }

  carregarMovimentacoes(): void {
    this.carregando.set(true);

    const periodoAtual = this.opcoesPeriodo.find(p => p.value === this.periodoFiltro());
    const mes = periodoAtual?.mes;
    const ano = periodoAtual?.ano;

    const tipoAtual = this.tipoFiltro();
    const tipoParam: 'receita' | 'despesa' | undefined = tipoAtual === 'todos' ? undefined : tipoAtual;

    const filtros = {
      tipo: tipoParam,
      espaco_id: this.espacoFiltro() === 'todos' ? undefined : parseInt(this.espacoFiltro(), 10),
      categoria: this.categoriaFiltro() === 'todas' ? undefined : this.categoriaFiltro(),
      busca: this.buscaTexto(),
      mes,
      ano
    };

    // Busca movimentações e resumo simultaneamente
    this.movimentacaoService.listar(filtros).subscribe({
      next: (itens) => {
        this.movimentacoes.set(itens);
        this.calcularResumoLocal(itens);
        this.carregando.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erro ao listar movimentações:', err);
        // Fallback para mock elegante se a tabela estiver inicialmente sem registros
        this.movimentacoes.set([]);
        this.calcularResumoLocal([]);
        this.carregando.set(false);
        this.cdr.detectChanges();
      }
    });
  }

  calcularResumoLocal(itens: MovimentacaoItem[]): void {
    const rec = itens
      .filter(m => m.tipo === 'receita')
      .reduce((acc, m) => acc + (m.valor || 0), 0);

    const desp = itens
      .filter(m => m.tipo === 'despesa')
      .reduce((acc, m) => acc + (m.valor || 0), 0);

    this.resumo.set({
      total_receitas: rec,
      total_despesas: desp,
      saldo: rec - desp,
      total_movimentacoes: itens.length
    });
  }

  aplicarFiltroTipo(tipo: 'todos' | 'receita' | 'despesa'): void {
    this.tipoFiltro.set(tipo);
    this.carregarMovimentacoes();
  }

  onFiltroChange(): void {
    this.carregarMovimentacoes();
  }

  limparFiltros(): void {
    this.tipoFiltro.set('todos');
    this.espacoFiltro.set('todos');
    this.categoriaFiltro.set('todas');
    this.buscaTexto.set('');
    this.periodoFiltro.set('todos');
    this.carregarMovimentacoes();
  }

  // Modal de Criação
  abrirModal(tipo: 'receita' | 'despesa' = 'despesa'): void {
    this.formTipo.set(tipo);
    this.formValor = null;
    this.formDescricao = '';
    
    // Inicia vazio para o usuário escolher da lista completa ou digitar
    this.formCategoria = '';
    this.termoBuscaCategoria.set('');
    this.dropdownCategoriaAberto.set(false);

    // Espaço default
    const espacos = this.listaEspacos();
    this.formEspacoId = espacos.length > 0 ? espacos[0].espaco.id : null;

    // Data de hoje no formato YYYY-MM-DD
    const hoje = new Date().toISOString().substring(0, 10);
    this.formData = hoje;

    this.erroModal.set('');
    this.modalAberto.set(true);
    this.cdr.detectChanges();
  }

  fecharModal(): void {
    this.modalAberto.set(false);
    this.erroModal.set('');
    this.cdr.detectChanges();
  }

  salvarMovimentacao(): void {
    if (!this.formValor || this.formValor <= 0) {
      this.erroModal.set('Informe um valor válido maior que zero.');
      this.cdr.detectChanges();
      return;
    }

    if (!this.formDescricao.trim()) {
      this.erroModal.set('Informe a descrição da movimentação.');
      this.cdr.detectChanges();
      return;
    }

    if (!this.formEspacoId) {
      this.erroModal.set('Selecione o espaço para esta movimentação.');
      this.cdr.detectChanges();
      return;
    }

    const categoriaInformada = (this.formCategoria || '').trim();
    if (!categoriaInformada) {
      this.erroModal.set('Informe ou selecione uma categoria.');
      this.cdr.detectChanges();
      return;
    }

    // Validação estrita case-insensitive: se já existe "carro", não duplica com "Carro"
    const existente = this.obterCategoriaExistente(categoriaInformada);
    let nomeFinalCategoria = categoriaInformada;

    if (existente) {
      // Reutiliza o nome exato já cadastrado
      nomeFinalCategoria = existente.nome;
    } else {
      // Cria a nova categoria no serviço global compartilhado
      this.categoriaService.adicionarCategoria(categoriaInformada, 0);
      nomeFinalCategoria = categoriaInformada;
    }

    this.salvando.set(true);
    this.erroModal.set('');

    const dados = {
      espaco_id: this.formEspacoId,
      tipo: this.formTipo(),
      descricao: this.formDescricao.trim(),
      valor: this.formValor,
      categoria: nomeFinalCategoria,
      data: this.formData ? new Date(this.formData).toISOString() : new Date().toISOString()
    };

    this.movimentacaoService.criar(dados).subscribe({
      next: () => {
        this.salvando.set(false);
        this.fecharModal();
        this.carregarMovimentacoes();

        // Se for despesa, atualiza o gasto da categoria no CategoriaService compartilhado
        if (dados.tipo === 'despesa') {
          const cat = this.obterCategoriaExistente(dados.categoria);
          if (cat) {
            this.categoriaService.atualizarCategoria(cat.id ?? cat.nome, {
              gasto: (cat.gasto || 0) + dados.valor
            });
          }
        }
      },
      error: (err) => {
        console.error('Erro ao salvar movimentação:', err);
        this.erroModal.set(err?.error?.detail || 'Erro ao registrar movimentação.');
        this.salvando.set(false);
        this.cdr.detectChanges();
      }
    });
  }

  // Modal de Edição
  abrirModalEdicao(mov: MovimentacaoItem): void {
    this.movimentacaoEmEdicao.set(mov);
    this.formEdicaoTipo.set(mov.tipo);
    this.formEdicaoValor = mov.valor;
    this.formEdicaoDescricao = mov.descricao;
    this.formEdicaoCategoria = mov.categoria;
    this.formEdicaoEspacoId = mov.espaco_id;
    this.formEdicaoData = mov.data ? mov.data.substring(0, 10) : '';
    this.termoBuscaEdicaoCategoria.set('');
    this.dropdownEdicaoCategoriaAberto.set(false);
    this.erroModalEdicao.set('');
    this.modalEdicaoAberto.set(true);
    this.cdr.detectChanges();
  }

  fecharModalEdicao(): void {
    this.modalEdicaoAberto.set(false);
    this.movimentacaoEmEdicao.set(null);
    this.erroModalEdicao.set('');
    this.cdr.detectChanges();
  }

  salvarEdicao(): void {
    const mov = this.movimentacaoEmEdicao();
    if (!mov) return;

    if (!this.formEdicaoValor || this.formEdicaoValor <= 0) {
      this.erroModalEdicao.set('Informe um valor válido maior que zero.');
      this.cdr.detectChanges();
      return;
    }

    if (!this.formEdicaoDescricao.trim()) {
      this.erroModalEdicao.set('Informe a descrição da movimentação.');
      this.cdr.detectChanges();
      return;
    }

    if (!this.formEdicaoEspacoId) {
      this.erroModalEdicao.set('Selecione o espaço para esta movimentação.');
      this.cdr.detectChanges();
      return;
    }

    const categoriaInformada = (this.formEdicaoCategoria || '').trim();
    if (!categoriaInformada) {
      this.erroModalEdicao.set('Informe ou selecione uma categoria.');
      this.cdr.detectChanges();
      return;
    }

    // Validação estrita case-insensitive: se já existe "carro", não duplica com "Carro"
    const existente = this.obterCategoriaExistente(categoriaInformada);
    let nomeFinalCategoria = categoriaInformada;

    if (existente) {
      nomeFinalCategoria = existente.nome;
    } else {
      this.categoriaService.adicionarCategoria(categoriaInformada, 0);
      nomeFinalCategoria = categoriaInformada;
    }

    this.salvandoEdicao.set(true);
    this.erroModalEdicao.set('');

    const dadosAtualizados = {
      espaco_id: this.formEdicaoEspacoId,
      tipo: this.formEdicaoTipo(),
      descricao: this.formEdicaoDescricao.trim(),
      valor: this.formEdicaoValor,
      categoria: nomeFinalCategoria,
      data: this.formEdicaoData ? new Date(this.formEdicaoData).toISOString() : new Date().toISOString()
    };

    this.movimentacaoService.atualizar(mov.id, dadosAtualizados).subscribe({
      next: () => {
        this.salvandoEdicao.set(false);
        this.fecharModalEdicao();
        this.carregarMovimentacoes();
        this.exibirToastSucesso('Movimentação atualizada com sucesso!');
      },
      error: (err) => {
        console.error('Erro ao atualizar movimentação:', err);
        this.erroModalEdicao.set(err?.error?.detail || 'Erro ao atualizar movimentação.');
        this.salvandoEdicao.set(false);
        this.cdr.detectChanges();
      }
    });
  }

  // Modal de Confirmação de Exclusão (Substitui confirm() do navegador)
  iniciarExclusao(mov: MovimentacaoItem): void {
    // Se estava com modal de edição aberto, fecha-o
    this.modalEdicaoAberto.set(false);
    this.movimentacaoParaExcluir.set(mov);
    this.modalConfirmarExclusaoAberto.set(true);
    this.cdr.detectChanges();
  }

  fecharModalExclusao(): void {
    this.modalConfirmarExclusaoAberto.set(false);
    this.movimentacaoParaExcluir.set(null);
    this.cdr.detectChanges();
  }

  confirmarExclusao(): void {
    const mov = this.movimentacaoParaExcluir();
    if (!mov) return;

    this.excluindo.set(true);
    this.movimentacaoService.excluir(mov.id).subscribe({
      next: () => {
        this.excluindo.set(false);
        this.fecharModalExclusao();
        this.carregarMovimentacoes();
        this.exibirToastSucesso('Movimentação excluída com sucesso!');
      },
      error: (err) => {
        console.error('Erro ao excluir movimentação:', err);
        this.excluindo.set(false);
        alert(err?.error?.detail || 'Não foi possível excluir a movimentação.');
        this.cdr.detectChanges();
      }
    });
  }

  // Utilitários
  obterCorCategoria(nome: string): string {
    const cat = this.categorias().find(c => c.nome.toLowerCase() === nome.toLowerCase());
    return cat ? cat.cor : '#64748b';
  }

  formatarMoeda(valor: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(valor || 0);
  }

  formatarData(dataStr: string): string {
    if (!dataStr) return '-';
    try {
      const data = new Date(dataStr);
      return data.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dataStr;
    }
  }

  irParaFinancas(): void {
    this.router.navigate(['/financas']);
  }

  irParaEspacos(): void {
    this.router.navigate(['/espacos']);
  }
}
