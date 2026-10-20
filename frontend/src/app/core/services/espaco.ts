import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface EspacoModel {
  id: number;
  nome: string;
  criado_por: number;
  created_at: string;
}

export interface EspacoUsuarioModel {
  id: number;
  espaco_id: number;
  usuario_id: number;
  papel: string;
  created_at: string;
  espaco: EspacoModel;
}

@Injectable({
  providedIn: 'root'
})
export class EspacoService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8000/api/espacos';

  listarMeusEspacos(): Observable<EspacoUsuarioModel[]> {
    return this.http.get<EspacoUsuarioModel[]>(`${this.apiUrl}/meus`);
  }

  criarEspaco(dados: { nome: string }): Observable<EspacoModel> {
    return this.http.post<EspacoModel>(`${this.apiUrl}/`, dados);
  }

  atualizarEspaco(id: number, dados: { nome: string }): Observable<EspacoModel> {
    return this.http.put<EspacoModel>(`${this.apiUrl}/${id}`, dados);
  }

  excluirEspaco(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
