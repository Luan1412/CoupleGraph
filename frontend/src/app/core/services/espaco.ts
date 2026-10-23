import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface MembroEspacoDetalhe {
  usuario_id?: number | null;
  convite_id?: number | null;
  nome: string;
  email: string;
  papel: string;
  status: 'ativo' | 'pendente' | string;
}

export interface EspacoModel {
  id: number;
  nome: string;
  cor?: string;
  icone?: string;
  criado_por: number;
  created_at: string;
  total_membros?: number;
  saldo?: number;
  despesas?: number;
  membros_detalhes?: MembroEspacoDetalhe[];
}

export interface EspacoUsuarioModel {
  id: number;
  espaco_id: number;
  usuario_id: number;
  papel: string;
  created_at: string;
  espaco: EspacoModel;
}

export interface ConviteEspacoModel {
  id: number;
  espaco_id: number;
  espaco_nome: string;
  email: string;
  convidado_por: number;
  convidado_por_nome: string;
  convidado_por_email?: string;
  status: 'pendente' | 'aceito' | 'recusado' | string;
  created_at: string;
}

export interface CategoriaOrcamentoItem {
  id?: number;
  nome: string;
  limite: number;
  cor?: string;
}

export interface OrcamentoEspacoModel {
  espaco_id: number;
  teto_geral: number | null;
  categorias: CategoriaOrcamentoItem[];
  pode_editar: boolean;
}

export interface OrcamentoEspacoUpdate {
  teto_geral: number | null;
  categorias: { id?: number; nome: string; limite: number; cor?: string }[];
}

const STORAGE_ACTIVE_ID_KEY = 'couplegraph_espaco_ativo_id';

@Injectable({
  providedIn: 'root'
})
export class EspacoService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private apiUrl = 'http://localhost:8000/api/espacos';

  // Sinais compartilhados entre Sidebar, Header e páginas
  readonly espacoAtivoId = signal<number | null>(this.lerEspacoAtivoInicial());
  readonly versaoEspacos = signal<number>(0);
  readonly selecaoEspacoTick = signal<number>(0);
  readonly orcamentosPorEspaco = signal<Map<number, OrcamentoEspacoModel>>(new Map());

  // Sinais de Convites (Pedidos para participar de espaços)
  readonly convitesRecebidos = signal<ConviteEspacoModel[]>([]);
  readonly convitesEnviados = signal<ConviteEspacoModel[]>([]);

  private lerEspacoAtivoInicial(): number | null {
    if (isPlatformBrowser(this.platformId)) {
      const val = Number(localStorage.getItem(STORAGE_ACTIVE_ID_KEY));
      return val > 0 ? val : null;
    }
    return null;
  }

  definirEspacoAtivoId(id: number | null): void {
    this.espacoAtivoId.set(id);
    this.selecaoEspacoTick.update(v => v + 1);
    if (isPlatformBrowser(this.platformId)) {
      if (id !== null) {
        localStorage.setItem(STORAGE_ACTIVE_ID_KEY, String(id));
      } else {
        localStorage.removeItem(STORAGE_ACTIVE_ID_KEY);
      }
    }
  }

  notificarAtualizacao(): void {
    this.versaoEspacos.update(v => v + 1);
  }

  listarMeusEspacos(): Observable<EspacoUsuarioModel[]> {
    return this.http.get<EspacoUsuarioModel[]>(`${this.apiUrl}/meus`);
  }

  criarEspaco(dados: { nome: string; cor?: string; icone?: string }): Observable<EspacoModel> {
    return this.http.post<EspacoModel>(`${this.apiUrl}/`, dados).pipe(
      tap(() => this.notificarAtualizacao())
    );
  }

  atualizarEspaco(id: number, dados: { nome?: string; cor?: string; icone?: string }): Observable<EspacoModel> {
    return this.http.put<EspacoModel>(`${this.apiUrl}/${id}`, dados).pipe(
      tap(() => this.notificarAtualizacao())
    );
  }

  excluirEspaco(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.notificarAtualizacao())
    );
  }

  // =========================================================
  // MÉTODOS DE CONVITES PARA PARTICIPAR DE ESPAÇOS
  // =========================================================

  carregarConvites(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const token = localStorage.getItem('access_token');
    if (!token) {
      this.convitesRecebidos.set([]);
      this.convitesEnviados.set([]);
      return;
    }

    this.listarConvitesRecebidos().subscribe({
      next: (lista) => this.convitesRecebidos.set(lista || []),
      error: () => this.convitesRecebidos.set([])
    });

    this.listarConvitesEnviados().subscribe({
      next: (lista) => this.convitesEnviados.set(lista || []),
      error: () => this.convitesEnviados.set([])
    });
  }

  listarConvitesRecebidos(): Observable<ConviteEspacoModel[]> {
    return this.http.get<ConviteEspacoModel[]>(`${this.apiUrl}/convites/recebidos`);
  }

  listarConvitesEnviados(): Observable<ConviteEspacoModel[]> {
    return this.http.get<ConviteEspacoModel[]>(`${this.apiUrl}/convites/enviados`);
  }

  enviarConvite(espacoId: number, email: string): Observable<ConviteEspacoModel> {
    return this.http.post<ConviteEspacoModel>(`${this.apiUrl}/${espacoId}/convites`, { email }).pipe(
      tap(() => {
        this.carregarConvites();
        this.notificarAtualizacao();
      })
    );
  }

  aceitarConvite(conviteId: number): Observable<ConviteEspacoModel> {
    return this.http.post<ConviteEspacoModel>(`${this.apiUrl}/convites/${conviteId}/aceitar`, {}).pipe(
      tap(() => {
        this.carregarConvites();
        this.notificarAtualizacao();
      })
    );
  }

  recusarConvite(conviteId: number): Observable<ConviteEspacoModel> {
    return this.http.post<ConviteEspacoModel>(`${this.apiUrl}/convites/${conviteId}/recusar`, {}).pipe(
      tap(() => {
        this.carregarConvites();
        this.notificarAtualizacao();
      })
    );
  }

  cancelarConvite(conviteId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/convites/${conviteId}`).pipe(
      tap(() => {
        this.carregarConvites();
        this.notificarAtualizacao();
      })
    );
  }

  removerMembro(espacoId: number, usuarioId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${espacoId}/membros/${usuarioId}`).pipe(
      tap(() => {
        this.notificarAtualizacao();
      })
    );
  }

  sairDoEspaco(espacoId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${espacoId}/sair`, {}).pipe(
      tap(() => {
        this.notificarAtualizacao();
      })
    );
  }

  alterarPapelMembro(espacoId: number, usuarioId: number, papel: string): Observable<EspacoModel> {
    return this.http.put<EspacoModel>(`${this.apiUrl}/${espacoId}/membros/${usuarioId}/papel`, { papel }).pipe(
      tap(() => {
        this.notificarAtualizacao();
      })
    );
  }

  obterOrcamentoEspaco(espacoId: number): Observable<OrcamentoEspacoModel> {
    return this.http.get<OrcamentoEspacoModel>(`${this.apiUrl}/${espacoId}/orcamento`).pipe(
      tap(orc => {
        this.orcamentosPorEspaco.update(mapa => {
          const novo = new Map(mapa);
          novo.set(espacoId, orc);
          return novo;
        });
      })
    );
  }

  salvarOrcamentoEspaco(espacoId: number, dados: OrcamentoEspacoUpdate): Observable<OrcamentoEspacoModel> {
    return this.http.put<OrcamentoEspacoModel>(`${this.apiUrl}/${espacoId}/orcamento`, dados).pipe(
      tap(orc => {
        this.orcamentosPorEspaco.update(mapa => {
          const novo = new Map(mapa);
          novo.set(espacoId, orc);
          return novo;
        });
        this.notificarAtualizacao();
      })
    );
  }

  carregarOrcamentosDeEspacos(espacoIds: number[]): void {
    if (!espacoIds || espacoIds.length === 0) return;
    espacoIds.forEach(id => {
      this.obterOrcamentoEspaco(id).subscribe({
        error: (err) => console.warn(`Não foi possível carregar orçamento do espaço ${id}`, err)
      });
    });
  }

  obterTetoEspaco(espacoId: number): number {
    const orc = this.orcamentosPorEspaco().get(espacoId);
    if (!orc) return 0;
    if (orc.teto_geral !== null && Number(orc.teto_geral) > 0) {
      return Number(orc.teto_geral);
    }
    if (orc.categorias && orc.categorias.length > 0) {
      return orc.categorias.reduce((acc, c) => acc + (Number(c.limite) || 0), 0);
    }
    return 0;
  }
}
