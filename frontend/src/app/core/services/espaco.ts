import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface EspacoModel {
  id: number;
  nome: string;
  criado_por: number;
  created_at: string;
  total_membros?: number;
  saldo?: number;
  despesas?: number;
}

export interface EspacoUsuarioModel {
  id: number;
  espaco_id: number;
  usuario_id: number;
  papel: string;
  created_at: string;
  espaco: EspacoModel;
}

const STORAGE_ACTIVE_ID_KEY = 'couplegraph_espaco_ativo_id';

@Injectable({
  providedIn: 'root'
})
export class EspacoService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private apiUrl = 'http://localhost:8000/api/espacos';

  // Sinais compartilhados entre Sidebar e páginas
  readonly espacoAtivoId = signal<number | null>(this.lerEspacoAtivoInicial());
  readonly versaoEspacos = signal<number>(0);

  private lerEspacoAtivoInicial(): number | null {
    if (isPlatformBrowser(this.platformId)) {
      const val = Number(localStorage.getItem(STORAGE_ACTIVE_ID_KEY));
      return val > 0 ? val : null;
    }
    return null;
  }

  definirEspacoAtivoId(id: number | null): void {
    this.espacoAtivoId.set(id);
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

  criarEspaco(dados: { nome: string }): Observable<EspacoModel> {
    return this.http.post<EspacoModel>(`${this.apiUrl}/`, dados).pipe(
      tap(() => this.notificarAtualizacao())
    );
  }

  atualizarEspaco(id: number, dados: { nome: string }): Observable<EspacoModel> {
    return this.http.put<EspacoModel>(`${this.apiUrl}/${id}`, dados).pipe(
      tap(() => this.notificarAtualizacao())
    );
  }

  excluirEspaco(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.notificarAtualizacao())
    );
  }
}
