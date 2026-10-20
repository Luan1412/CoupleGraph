import { Component, OnInit, inject, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SummaryCard } from '../../shared/components/summary-card/summary-card';
import { EspacoService, EspacoUsuarioModel } from '../../core/services/espaco';

import { CategoriaService, CategoriaItem } from '../../core/services/categoria';

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
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  // Filtros
  espacoSelecionadoId = signal<string>('todos');
  periodoSelecionado = signal<string>('09-2026');

  opcoesPeriodo = [
    { label: 'Setembro 2026', value: '09-2026' },
    { label: 'Outubro 2026', value: '10-2026' },
    { label: 'Novembro 2026', value: '11-2026' },
    { label: 'Agosto 2026', value: '08-2026' },
    { label: 'Julho 2026', value: '07-2026' }
  ];

  listaEspacos = signal<EspacoUsuarioModel[]>([]);
  carregando = signal<boolean>(true);

  // Métricas do Topo
  saldoDisponivel = signal<number>(3250);
  totalReceitas = signal<number>(5000);
  totalDespesas = signal<number>(1750);
  taxaEconomia = signal<number>(65); // 65% poupado

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
        
        if (dados && dados.length > 0) {
          const balancos: BalancoEspaco[] = dados.map(item => {
            const numMembros = item.espaco.total_membros || 1;
            const tipo = numMembros > 1 ? `Compartilhado · ${numMembros} pessoas` : 'Espaço pessoal';
            const saldo = item.espaco.saldo ?? 0;
            const despesas = item.espaco.despesas ?? 0;
            const receitas = saldo + despesas;

            return {
              id: item.espaco.id,
              nome: item.espaco.nome,
              tipo,
              saldo,
              receitas,
              despesas
            };
          });
          this.balancoEspacos.set(balancos);
        } else {
          this.balancoEspacos.set([]);
        }

        this.carregando.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erro ao carregar espaços em finanças:', err);
        this.listaEspacos.set([]);
        this.balancoEspacos.set([]);
        this.carregando.set(false);
        this.cdr.detectChanges();
      }
    });
  }

  aplicarFiltros(): void {
    const espacoId = this.espacoSelecionadoId();
    if (espacoId === 'todos') {
      this.saldoDisponivel.set(3250);
      this.totalReceitas.set(5000);
      this.totalDespesas.set(1750);
      this.taxaEconomia.set(65);
    } else {
      const idNum = parseInt(espacoId, 10);
      const esp = this.balancoEspacos().find(b => b.id === idNum);
      if (esp) {
        this.saldoDisponivel.set(esp.saldo);
        this.totalReceitas.set(esp.receitas);
        this.totalDespesas.set(esp.despesas);
        const taxa = esp.receitas > 0 ? Math.round(((esp.receitas - esp.despesas) / esp.receitas) * 100) : 0;
        this.taxaEconomia.set(Math.max(0, taxa));
      }
    }
    this.cdr.detectChanges();
  }

  calcularPorcentagem(gasto: number, limite: number): number {
    if (limite === 0) return 0;
    return Math.min(100, Math.round((gasto / limite) * 100));
  }

  formatarMoeda(valor: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(valor || 0);
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
