import { Component } from '@angular/core';
import { SummaryCard } from '../../shared/components/summary-card/summary-card';
import { CategoryExpenses } from '../../shared/components/category-expenses/category-expenses';
import { SpacesWidget } from '../../shared/components/spaces-widget/spaces-widget';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [SummaryCard, CategoryExpenses, SpacesWidget],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard {

  totalGastos: number = 2400;
  
  gastosCategorias: any[] = [
    { nome: 'Casa', valor: 1200, cor: '#22c55e' },
    { nome: 'Alimentação', valor: 650, cor: '#3b82f6' },
    { nome: 'Lazer', valor: 300, cor: '#8b5cf6' },
    { nome: 'Transporte', valor: 250, cor: '#f97316' }
  ];

  meusEspacos: any[] = [
    {
      nome: 'Minhas finanças',
      tipo: 'Espaço pessoal',
      saldo: '3.250',
      despesas: null,
      mostrarAcessar: true
    },
    {
      nome: 'Luan & Késia',
      tipo: 'Compartilhado · 2 pessoas',
      saldo: '3.250',
      despesas: '1.750',
      mostrarAcessar: true
    }
  ];
  
}