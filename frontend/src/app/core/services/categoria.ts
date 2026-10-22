import { Injectable, signal, computed } from '@angular/core';

export interface CategoriaItem {
  id?: string;
  nome: string;
  limite: number;
  gasto: number;
  cor: string;
}

const STORAGE_KEY = 'cg_categorias_orcamento';
const STORAGE_TETO_GERAL_KEY = 'cg_teto_geral_orcamento';

const CATEGORIAS_PADRAO: CategoriaItem[] = [
  { id: '1', nome: 'Alimentação', limite: 1000, gasto: 650, cor: '#3b82f6' },
  { id: '2', nome: 'Moradia / Casa', limite: 1500, gasto: 1200, cor: '#22c55e' },
  { id: '3', nome: 'Lazer', limite: 500, gasto: 300, cor: '#8b5cf6' },
  { id: '4', nome: 'Transporte', limite: 400, gasto: 250, cor: '#f97316' }
];

const PALETA_CORES = [
  '#3b82f6', // Azul
  '#22c55e', // Verde
  '#8b5cf6', // Roxo
  '#f97316', // Laranja
  '#ec4899', // Rosa
  '#06b6d4', // Ciano
  '#eab308', // Amarelo
  '#6366f1', // Índigo
  '#14b8a6', // Teal
  '#f43f5e'  // Vermelho rosado
];

@Injectable({
  providedIn: 'root'
})
export class CategoriaService {
  private _categorias = signal<CategoriaItem[]>(this.carregarInicial());
  private _tetoGeralManual = signal<number | null>(this.carregarTetoGeralInicial());

  // Signal público somente leitura para reatividade total
  readonly categorias = this._categorias.asReadonly();
  readonly tetoGeralManual = this._tetoGeralManual.asReadonly();

  // Soma dos limites individuais das categorias
  readonly somaLimitesCategorias = computed(() => {
    return this._categorias().reduce((acc, cat) => acc + (cat.limite || 0), 0);
  });

  // Total planejado efetivo: usa o Teto Geral Manual se estiver definido (> 0), senão a soma das categorias
  readonly totalPlanejado = computed(() => {
    const manual = this._tetoGeralManual();
    if (manual !== null && manual > 0) {
      return manual;
    }
    return this.somaLimitesCategorias();
  });

  // Total gasto em todas as categorias
  readonly totalGasto = computed(() => {
    return this._categorias().reduce((acc, cat) => acc + (cat.gasto || 0), 0);
  });

  private carregarInicial(): CategoriaItem[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const salvo = localStorage.getItem(STORAGE_KEY);
        if (salvo) {
          const parsed = JSON.parse(salvo);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar categorias do localStorage:', e);
    }
    return CATEGORIAS_PADRAO;
  }

  private carregarTetoGeralInicial(): number | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const salvo = localStorage.getItem(STORAGE_TETO_GERAL_KEY);
        if (salvo !== null && salvo !== '') {
          const num = Number(salvo);
          if (!isNaN(num) && num > 0) {
            return num;
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar teto geral do localStorage:', e);
    }
    return null;
  }

  private persistir(lista: CategoriaItem[]): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
      }
    } catch (e) {
      console.warn('Erro ao salvar categorias no localStorage:', e);
    }
  }

  definirTetoGeral(valor: number | null): void {
    const valLimpo = valor !== null && !isNaN(Number(valor)) && Number(valor) > 0 ? Number(valor) : null;
    this._tetoGeralManual.set(valLimpo);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (valLimpo !== null) {
          localStorage.setItem(STORAGE_TETO_GERAL_KEY, String(valLimpo));
        } else {
          localStorage.removeItem(STORAGE_TETO_GERAL_KEY);
        }
      }
    } catch (e) {
      console.warn('Erro ao salvar teto geral no localStorage:', e);
    }
  }

  salvarTodas(lista: CategoriaItem[], tetoGeral?: number | null): void {
    this._categorias.set([...lista]);
    this.persistir(lista);
    if (tetoGeral !== undefined) {
      this.definirTetoGeral(tetoGeral);
    }
  }

  adicionarCategoria(nome: string, limite: number, gasto: number = 0): boolean {
    const nomeNormalizado = nome.trim();
    if (!nomeNormalizado) return false;

    const lista = this._categorias();
    const jaExiste = lista.some(c => c.nome.toLowerCase() === nomeNormalizado.toLowerCase());
    if (jaExiste) return false;

    const proximaCor = PALETA_CORES[lista.length % PALETA_CORES.length];
    const nova: CategoriaItem = {
      id: Date.now().toString(),
      nome: nomeNormalizado,
      limite: Math.max(0, limite),
      gasto: Math.max(0, gasto),
      cor: proximaCor
    };

    const atualizada = [...lista, nova];
    this._categorias.set(atualizada);
    this.persistir(atualizada);
    return true;
  }

  atualizarCategoria(nomeOuId: string, dados: Partial<CategoriaItem>): void {
    const lista = this._categorias().map(cat => {
      if (cat.id === nomeOuId || cat.nome === nomeOuId) {
        return { ...cat, ...dados };
      }
      return cat;
    });
    this._categorias.set(lista);
    this.persistir(lista);
  }

  removerCategoria(nomeOuId: string): void {
    const lista = this._categorias().filter(cat => cat.id !== nomeOuId && cat.nome !== nomeOuId);
    this._categorias.set(lista);
    this.persistir(lista);
  }

  obterProximaCor(): string {
    const len = this._categorias().length;
    return PALETA_CORES[len % PALETA_CORES.length];
  }
}
