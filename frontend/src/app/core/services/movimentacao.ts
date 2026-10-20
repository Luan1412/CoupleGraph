import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface MovimentacaoItem {
  id: number;
  espaco_id: number;
  usuario_id: number;
  tipo: 'receita' | 'despesa';
  descricao: string;
  valor: number;
  categoria: string;
  data: string;
  created_at: string;
  usuario_nome?: string;
  espaco_nome?: string;
}

export interface MovimentacaoCreate {
  espaco_id: number;
  tipo: 'receita' | 'despesa';
  descricao?: string;
  valor: number;
  categoria: string;
  data?: string;
}

export interface MovimentacaoResumo {
  total_receitas: number;
  total_despesas: number;
  saldo: number;
  total_movimentacoes: number;
}

export interface MovimentacaoFiltros {
  espaco_id?: number | string;
  tipo?: 'receita' | 'despesa';
  categoria?: string;
  busca?: string;
  mes?: number;
  ano?: number;
}

@Injectable({
  providedIn: 'root'
})
export class MovimentacaoService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8000/api/movimentacoes';

  listar(filtros?: MovimentacaoFiltros): Observable<MovimentacaoItem[]> {
    let params = new HttpParams();

    if (filtros) {
      if (filtros.espaco_id && filtros.espaco_id !== 'todos') {
        params = params.set('espaco_id', filtros.espaco_id.toString());
      }
      if (filtros.tipo) {
        params = params.set('tipo', filtros.tipo);
      }
      if (filtros.categoria && filtros.categoria !== 'todas') {
        params = params.set('categoria', filtros.categoria);
      }
      if (filtros.busca && filtros.busca.trim()) {
        params = params.set('busca', filtros.busca.trim());
      }
      if (filtros.mes) {
        params = params.set('mes', filtros.mes.toString());
      }
      if (filtros.ano) {
        params = params.set('ano', filtros.ano.toString());
      }
    }

    return this.http.get<MovimentacaoItem[]>(`${this.apiUrl}/`, { params });
  }

  criar(dados: MovimentacaoCreate): Observable<MovimentacaoItem> {
    return this.http.post<MovimentacaoItem>(`${this.apiUrl}/`, dados);
  }

  atualizar(id: number, dados: Partial<MovimentacaoCreate>): Observable<MovimentacaoItem> {
    return this.http.put<MovimentacaoItem>(`${this.apiUrl}/${id}`, dados);
  }

  excluir(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  obterResumo(filtros?: MovimentacaoFiltros): Observable<MovimentacaoResumo> {
    let params = new HttpParams();

    if (filtros) {
      if (filtros.espaco_id && filtros.espaco_id !== 'todos') {
        params = params.set('espaco_id', filtros.espaco_id.toString());
      }
      if (filtros.mes) {
        params = params.set('mes', filtros.mes.toString());
      }
      if (filtros.ano) {
        params = params.set('ano', filtros.ano.toString());
      }
    }

    return this.http.get<MovimentacaoResumo>(`${this.apiUrl}/resumo`, { params });
  }
}
