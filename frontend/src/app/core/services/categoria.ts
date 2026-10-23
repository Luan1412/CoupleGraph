import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { Auth } from './auth';

export interface CategoriaItem {
  id?: string;
  nome: string;
  limite: number;
  gasto: number;
  cor: string;
}

const STORAGE_KEY_PREFIX = 'cg_categorias_orcamento_user_v2_';
const STORAGE_TETO_GERAL_PREFIX = 'cg_teto_geral_orcamento_user_v2_';
const STORAGE_CORES_ESPACOS = 'cg_cores_espacos_orcamento_v1';

export const PALETA_CORES = [
  '#3b82f6', // Azul Royal
  '#22c55e', // Verde Esmeralda
  '#8b5cf6', // Roxo Violeta
  '#f97316', // Laranja Solar
  '#ec4899', // Rosa Pink
  '#06b6d4', // Ciano Turquesa
  '#eab308', // Amarelo Dourado
  '#6366f1', // Índigo
  '#14b8a6', // Teal
  '#f43f5e', // Vermelho Rosado
  '#10b981', // Verde Menta
  '#a855f7', // Púrpura
  '#0284c7', // Azul Céu
  '#d97706', // Âmbar Quente
  '#e11d48', // Carmesim
  '#84cc16'  // Verde Limão
];

export function normalizarNomeCategoria(txt: string): string {
  if (!txt) return '';
  return txt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export const DICIONARIO_CORES_SEMANTICAS: Record<string, string> = {
  // Mercado e compras essenciais
  'mercado': '#f97316',
  'supermercado': '#f97316',
  'feira': '#f97316',
  'hortifruti': '#f97316',
  'acougue': '#ea580c',
  'padaria': '#f97316',

  // Alimentação & Restaurantes
  'alimentacao': '#ea580c',
  'restaurante': '#ea580c',
  'comida': '#ea580c',
  'lanche': '#ea580c',
  'delivery': '#ea580c',
  'refeicao': '#ea580c',
  'cafe': '#ea580c',

  // Moradia & Casa
  'moradia': '#3b82f6',
  'casa': '#3b82f6',
  'aluguel': '#3b82f6',
  'condominio': '#3b82f6',
  'habitacao': '#3b82f6',
  'iptu': '#3b82f6',
  'reforma': '#3b82f6',
  'moveis': '#3b82f6',

  // Contas & Utilidades
  'contas': '#06b6d4',
  'agua': '#06b6d4',
  'luz': '#06b6d4',
  'energia': '#06b6d4',
  'gas': '#06b6d4',
  'internet': '#06b6d4',
  'telefone': '#06b6d4',
  'celular': '#06b6d4',

  // Transporte & Veículo
  'transporte': '#f59e0b',
  'combustivel': '#f59e0b',
  'gasolina': '#f59e0b',
  'alcool': '#f59e0b',
  'uber': '#f59e0b',
  '99': '#f59e0b',
  'taxi': '#f59e0b',
  'onibus': '#f59e0b',
  'metro': '#f59e0b',
  'carro': '#f59e0b',
  'moto': '#f59e0b',
  'ipva': '#f59e0b',
  'estacionamento': '#f59e0b',
  'pedagio': '#f59e0b',
  'manutencao': '#f59e0b',

  // Saúde & Bem-estar
  'saude': '#ef4444',
  'farmacia': '#ef4444',
  'remedio': '#ef4444',
  'remedios': '#ef4444',
  'medico': '#ef4444',
  'hospital': '#ef4444',
  'dentista': '#ef4444',
  'exame': '#ef4444',
  'exames': '#ef4444',
  'consulta': '#ef4444',
  'plano de saude': '#ef4444',

  // Lazer & Diversão
  'lazer': '#8b5cf6',
  'viagem': '#8b5cf6',
  'viagens': '#8b5cf6',
  'passeio': '#8b5cf6',
  'cinema': '#8b5cf6',
  'jogos': '#8b5cf6',
  'games': '#8b5cf6',
  'shows': '#8b5cf6',
  'show': '#8b5cf6',
  'bar': '#8b5cf6',
  'bares': '#8b5cf6',
  'balada': '#8b5cf6',
  'festa': '#8b5cf6',
  'entretenimento': '#8b5cf6',

  // Educação & Conhecimento
  'educacao': '#6366f1',
  'curso': '#6366f1',
  'cursos': '#6366f1',
  'faculdade': '#6366f1',
  'escola': '#6366f1',
  'livro': '#6366f1',
  'livros': '#6366f1',
  'estudos': '#6366f1',

  // Pets
  'pet': '#ec4899',
  'pets': '#ec4899',
  'veterinario': '#ec4899',
  'racao': '#ec4899',
  'cachorro': '#ec4899',
  'gato': '#ec4899',
  'animais': '#ec4899',

  // Ganhos & Receitas
  'salario': '#22c55e',
  'renda': '#22c55e',
  'investimento': '#22c55e',
  'investimentos': '#22c55e',
  'rendimentos': '#22c55e',
  'dividendos': '#22c55e',
  'freelance': '#22c55e',
  'bonus': '#22c55e',

  // Compras & Vestuário
  'compras': '#14b8a6',
  'vestuario': '#14b8a6',
  'roupas': '#14b8a6',
  'roupa': '#14b8a6',
  'calcados': '#14b8a6',
  'shopping': '#14b8a6',

  // Assinaturas & Streaming
  'assinaturas': '#a855f7',
  'streaming': '#a855f7',
  'netflix': '#a855f7',
  'spotify': '#a855f7',
  'prime': '#a855f7',
  'youtube': '#a855f7',

  // Academia & Fitness
  'academia': '#10b981',
  'fitness': '#10b981',
  'esporte': '#10b981',
  'treino': '#10b981',

  // Outros
  'outros': '#64748b',
  'geral': '#64748b',
  'diversos': '#64748b'
};

export function hashStringParaCor(str: string): string {
  if (!str || !str.trim()) return '#64748b';
  const normalizado = normalizarNomeCategoria(str);
  let hash = 0;
  for (let i = 0; i < normalizado.length; i++) {
    hash = normalizado.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETA_CORES[Math.abs(hash) % PALETA_CORES.length];
}

@Injectable({
  providedIn: 'root'
})
export class CategoriaService {
  private authService = inject(Auth);

  private _categorias = signal<CategoriaItem[]>(this.carregarInicial());
  private _tetoGeralManual = signal<number | null>(this.carregarTetoGeralInicial());
  private _coresEspacos = signal<Record<number, Record<string, string>>>(this.carregarCoresEspacosIniciais());

  // Signal público somente leitura para reatividade total
  readonly categorias = this._categorias.asReadonly();
  readonly tetoGeralManual = this._tetoGeralManual.asReadonly();
  readonly coresEspacos = this._coresEspacos.asReadonly();

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

  constructor() {
    effect(() => {
      // Recarrega as categorias do usuário sempre que o usuário logado mudar
      const _user = this.authService.usuarioAtual();
      this._categorias.set(this.carregarInicial());
      this._tetoGeralManual.set(this.carregarTetoGeralInicial());
      this._coresEspacos.set(this.carregarCoresEspacosIniciais());
    });
  }

  private obterIdUsuarioAtivo(): string {
    const idPerfil = this.authService.usuarioAtual()?.id;
    if (idPerfil) return String(idPerfil);

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const token = localStorage.getItem('access_token');
        if (token) {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            if (payload?.sub) {
              return String(payload.sub);
            }
          }
        }
      }
    } catch {
      // ignore
    }
    return 'anon';
  }

  private obterStorageKeyCategorias(): string {
    return `${STORAGE_KEY_PREFIX}${this.obterIdUsuarioAtivo()}`;
  }

  private obterStorageKeyTetoGeral(): string {
    return `${STORAGE_TETO_GERAL_PREFIX}${this.obterIdUsuarioAtivo()}`;
  }

  private carregarInicial(): CategoriaItem[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const salvo = localStorage.getItem(this.obterStorageKeyCategorias());
        if (salvo !== null) {
          const parsed = JSON.parse(salvo);
          if (Array.isArray(parsed)) {
            // Garante que cada item tenha uma cor consistente
            return parsed.map(c => ({
              ...c,
              cor: c.cor || this.obterCor(c.nome)
            }));
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar categorias do localStorage:', e);
    }
    return [];
  }

  private carregarTetoGeralInicial(): number | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const salvo = localStorage.getItem(this.obterStorageKeyTetoGeral());
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

  private carregarCoresEspacosIniciais(): Record<number, Record<string, string>> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const salvo = localStorage.getItem(STORAGE_CORES_ESPACOS);
        if (salvo) {
          const parsed = JSON.parse(salvo);
          if (parsed && typeof parsed === 'object') {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar cores de espaços:', e);
    }
    return {};
  }

  private persistir(lista: CategoriaItem[]): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.obterStorageKeyCategorias(), JSON.stringify(lista));
      }
    } catch (e) {
      console.warn('Erro ao salvar categorias no localStorage:', e);
    }
  }

  private persistirCoresEspacos(dados: Record<number, Record<string, string>>): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_CORES_ESPACOS, JSON.stringify(dados));
      }
    } catch (e) {
      console.warn('Erro ao persistir cores de espaços:', e);
    }
  }

  /**
   * Armazena e sincroniza as cores das categorias de um grupo/espaço compartilhado.
   */
  armazenarCoresEspaco(espacoId: number, categorias: { nome: string; cor?: string }[]): void {
    if (!espacoId || !categorias || !Array.isArray(categorias)) return;

    const mapaGeral = { ...this._coresEspacos() };
    const mapaEspaco = { ...(mapaGeral[espacoId] || {}) };

    categorias.forEach(cat => {
      if (cat.nome) {
        const norm = normalizarNomeCategoria(cat.nome);
        const corFinal = cat.cor && cat.cor.trim() ? cat.cor.trim() : this.obterCor(cat.nome);
        mapaEspaco[norm] = corFinal;
      }
    });

    mapaGeral[espacoId] = mapaEspaco;
    this._coresEspacos.set(mapaGeral);
    this.persistirCoresEspacos(mapaGeral);
  }

  /**
   * Retorna a cor exata de uma categoria para qualquer usuário e em qualquer tela.
   * Ordem de prioridade:
   * 1. Cor personalizada configurada no orçamento do Espaço (se espacoId for informado).
   * 2. Cor definida nas categorias locais do usuário.
   * 3. Mapeamento do Dicionário Semântico Financeiro.
   * 4. Hash determinístico baseado no nome da categoria (garante 100% de consistência entre membros).
   */
  obterCor(nome: string, espacoId?: number): string {
    if (!nome || !nome.trim()) {
      return '#64748b';
    }

    const norm = normalizarNomeCategoria(nome);

    // 1. Espaço compartilhado configurado
    if (espacoId) {
      const coresEspaco = this._coresEspacos()[espacoId];
      if (coresEspaco && coresEspaco[norm]) {
        return coresEspaco[norm];
      }
    }

    // 2. Categoria pessoal do usuário
    const catPessoal = this._categorias().find(c => normalizarNomeCategoria(c.nome) === norm);
    if (catPessoal && catPessoal.cor) {
      return catPessoal.cor;
    }

    // 3. Dicionário Semântico (correspondência exata)
    if (DICIONARIO_CORES_SEMANTICAS[norm]) {
      return DICIONARIO_CORES_SEMANTICAS[norm];
    }

    // 3.1 Dicionário Semântico (correspondência por inclusão de palavra-chave)
    for (const [termo, cor] of Object.entries(DICIONARIO_CORES_SEMANTICAS)) {
      if (termo.length >= 4 && norm.includes(termo)) {
        return cor;
      }
    }

    // 4. Hash Determinístico consistente para qualquer dispositivo
    return hashStringParaCor(norm);
  }

  definirTetoGeral(valor: number | null): void {
    const valLimpo = valor !== null && !isNaN(Number(valor)) && Number(valor) > 0 ? Number(valor) : null;
    this._tetoGeralManual.set(valLimpo);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const key = this.obterStorageKeyTetoGeral();
        if (valLimpo !== null) {
          localStorage.setItem(key, String(valLimpo));
        } else {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.warn('Erro ao salvar teto geral no localStorage:', e);
    }
  }

  salvarTodas(lista: CategoriaItem[], tetoGeral?: number | null): void {
    const listaTratada = lista.map(c => ({
      ...c,
      cor: c.cor || this.obterCor(c.nome)
    }));
    this._categorias.set([...listaTratada]);
    this.persistir(listaTratada);
    if (tetoGeral !== undefined) {
      this.definirTetoGeral(tetoGeral);
    }
  }

  adicionarCategoria(nome: string, limite: number, gasto: number = 0, cor?: string): boolean {
    const nomeNormalizado = nome.trim();
    if (!nomeNormalizado) return false;

    const lista = this._categorias();
    const jaExiste = lista.some(c => c.nome.toLowerCase() === nomeNormalizado.toLowerCase());
    if (jaExiste) return false;

    // Prioriza a cor informada ou calcula a cor padronizada semântica/determinística
    const corFinal = cor && cor.trim() ? cor.trim() : this.obterCor(nomeNormalizado);
    const nova: CategoriaItem = {
      id: Date.now().toString(),
      nome: nomeNormalizado,
      limite: Math.max(0, limite),
      gasto: Math.max(0, gasto),
      cor: corFinal
    };

    const atualizada = [...lista, nova];
    this._categorias.set(atualizada);
    this.persistir(atualizada);
    return true;
  }

  atualizarCategoria(nomeOuId: string, dados: Partial<CategoriaItem>): void {
    const lista = this._categorias().map(cat => {
      if (cat.id === nomeOuId || cat.nome.toLowerCase() === nomeOuId.toLowerCase()) {
        const novaCor = dados.cor || cat.cor || this.obterCor(dados.nome || cat.nome);
        return { ...cat, ...dados, cor: novaCor };
      }
      return cat;
    });
    this._categorias.set(lista);
    this.persistir(lista);
  }

  removerCategoria(nomeOuId: string): void {
    const lista = this._categorias().filter(cat => cat.id !== nomeOuId && cat.nome.toLowerCase() !== nomeOuId.toLowerCase());
    this._categorias.set(lista);
    this.persistir(lista);
  }

  obterProximaCor(nome?: string): string {
    if (nome) {
      return this.obterCor(nome);
    }
    const len = this._categorias().length;
    return PALETA_CORES[len % PALETA_CORES.length];
  }
}
