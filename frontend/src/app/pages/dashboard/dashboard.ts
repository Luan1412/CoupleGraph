import { Component, OnInit, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SummaryCard } from '../../shared/components/summary-card/summary-card';
import { CategoryExpenses } from '../../shared/components/category-expenses/category-expenses';
import { SpacesWidget } from '../../shared/components/spaces-widget/spaces-widget';
import { EspacoService } from '../../core/services/espaco';
import { ThemeService } from '../../core/services/theme';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, SummaryCard, CategoryExpenses, SpacesWidget],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit {
  private espacoService = inject(EspacoService);
  themeService = inject(ThemeService);
  private cdr = inject(ChangeDetectorRef);

  saldoTotal = signal<number>(0);
  receitasTotais = signal<number>(0);
  despesasTotais = signal<number>(0);

  readonly CORES_PALETA = [
    '#22c55e', // Verde
    '#3b82f6', // Azul
    '#8b5cf6', // Roxo
    '#f97316', // Laranja
    '#ec4899', // Rosa
    '#06b6d4', // Ciano
    '#eab308'  // Amarelo
  ];

  meusEspacos = signal<any[]>([]);
  gastosPorEspaco = signal<any[]>([]);
  totalGastosEspacos = signal<number>(0);
  carregandoEspacos = signal<boolean>(true);

  ngOnInit(): void {
    this.carregarEspacos();
  }

  carregarEspacos(): void {
    this.carregandoEspacos.set(true);
    this.espacoService.listarMeusEspacos().subscribe({
      next: (dados) => {
        if (dados && dados.length > 0) {
          let somaGastos = 0;
          let somaSaldo = 0;
          const itensGastos: any[] = [];

          const mapeados = dados.map((item, index) => {
            const numMembros = item.espaco.total_membros || 1;
            const tipo = numMembros > 1 ? `Compartilhado · ${numMembros} pessoas` : 'Espaço pessoal';
            const saldoVal = item.espaco.saldo ?? 0;
            const despesasVal = item.espaco.despesas ?? 0;

            somaGastos += despesasVal;
            somaSaldo += saldoVal;

            if (despesasVal > 0) {
              itensGastos.push({
                nome: item.espaco.nome,
                valor: despesasVal,
                cor: this.CORES_PALETA[index % this.CORES_PALETA.length]
              });
            }

            return {
              id: item.espaco.id,
              nome: item.espaco.nome,
              tipo: tipo,
              saldo: saldoVal,
              despesas: despesasVal > 0 ? despesasVal : null,
              mostrarAcessar: true
            };
          });

          this.meusEspacos.set(mapeados);
          this.totalGastosEspacos.set(somaGastos);
          this.gastosPorEspaco.set(itensGastos);
          this.saldoTotal.set(somaSaldo);
          this.despesasTotais.set(somaGastos);
          this.receitasTotais.set(Math.max(0, somaSaldo + somaGastos));
        } else {
          this.meusEspacos.set([]);
          this.totalGastosEspacos.set(0);
          this.gastosPorEspaco.set([]);
          this.saldoTotal.set(0);
          this.despesasTotais.set(0);
          this.receitasTotais.set(0);
        }
        this.carregandoEspacos.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erro ao carregar espaços no dashboard:', err);
        this.meusEspacos.set([]);
        this.totalGastosEspacos.set(0);
        this.gastosPorEspaco.set([]);
        this.carregandoEspacos.set(false);
        this.cdr.detectChanges();
      }
    });
  }
}