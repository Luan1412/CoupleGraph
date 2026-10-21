import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type TemaTipo = 'claro' | 'escuro';

const STORAGE_KEY_TEMA = 'couplegraph_theme';
const STORAGE_KEY_PREFS = 'couplegraph_preferences';

export interface PreferenciasUsuario {
  moedaPadrao: 'BRL' | 'USD' | 'EUR';
  alertaOrcamento: boolean;
  resumoSemanal: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private platformId = inject(PLATFORM_ID);

  // Sinais reativos
  readonly temaAtual = signal<TemaTipo>('claro');
  readonly moedaPadrao = signal<'BRL' | 'USD' | 'EUR'>('BRL');
  readonly alertaOrcamento = signal<boolean>(true);
  readonly resumoSemanal = signal<boolean>(true);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.carregarPreferencias();
    }
  }

  private carregarPreferencias(): void {
    try {
      // 1. Tema
      const temaSalvo = localStorage.getItem(STORAGE_KEY_TEMA) as TemaTipo | null;
      if (temaSalvo === 'claro' || temaSalvo === 'escuro') {
        this.temaAtual.set(temaSalvo);
      } else {
        const prefereEscuro = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.temaAtual.set(prefereEscuro ? 'escuro' : 'claro');
      }
      this.aplicarTemaNoDom(this.temaAtual());

      // 2. Demais preferências salvas
      const prefsSalvas = localStorage.getItem(STORAGE_KEY_PREFS);
      if (prefsSalvas) {
        const parsed = JSON.parse(prefsSalvas);
        if (parsed.moedaPadrao) {
          this.moedaPadrao.set(parsed.moedaPadrao);
        }
        if (typeof parsed.alertaOrcamento === 'boolean') {
          this.alertaOrcamento.set(parsed.alertaOrcamento);
        }
        if (typeof parsed.resumoSemanal === 'boolean') {
          this.resumoSemanal.set(parsed.resumoSemanal);
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar preferências do localStorage', e);
    }
  }

  definirTema(tema: TemaTipo): void {
    this.temaAtual.set(tema);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(STORAGE_KEY_TEMA, tema);
      this.aplicarTemaNoDom(tema);
    }
  }

  alternarTema(): void {
    const proximo: TemaTipo = this.temaAtual() === 'claro' ? 'escuro' : 'claro';
    this.definirTema(proximo);
  }

  private aplicarTemaNoDom(tema: TemaTipo): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const body = document.body;
    const doc = document.documentElement;

    if (tema === 'escuro') {
      body.classList.add('dark-theme');
      doc.classList.add('dark-theme');
      doc.setAttribute('data-theme', 'dark');
    } else {
      body.classList.remove('dark-theme');
      doc.classList.remove('dark-theme');
      doc.setAttribute('data-theme', 'light');
    }
  }

  salvarMoeda(moeda: 'BRL' | 'USD' | 'EUR'): void {
    this.moedaPadrao.set(moeda);
    this.persistirPreferencias();
  }

  obterSimbolo(): string {
    switch (this.moedaPadrao()) {
      case 'USD':
        return '$';
      case 'EUR':
        return '€';
      case 'BRL':
      default:
        return 'R$';
    }
  }

  formatarMoeda(valor: number | string | null | undefined): string {
    const v = Number(valor) || 0;
    switch (this.moedaPadrao()) {
      case 'USD':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(v);
      case 'EUR':
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'EUR',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(v);
      case 'BRL':
      default:
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(v);
    }
  }

  formatarValor(valor: number | string | null | undefined, minDecimals = 0, maxDecimals = 2): string {
    const v = Number(valor) || 0;
    const locale = this.moedaPadrao() === 'USD' ? 'en-US' : 'pt-BR';
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals
    }).format(v);
  }

  salvarAlertaOrcamento(ativo: boolean): void {
    this.alertaOrcamento.set(ativo);
    this.persistirPreferencias();
  }

  salvarResumoSemanal(ativo: boolean): void {
    this.resumoSemanal.set(ativo);
    this.persistirPreferencias();
  }

  private persistirPreferencias(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const dados = {
        moedaPadrao: this.moedaPadrao(),
        alertaOrcamento: this.alertaOrcamento(),
        resumoSemanal: this.resumoSemanal()
      };
      localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(dados));
    } catch (e) {
      console.warn('Erro ao persistir preferências', e);
    }
  }
}
