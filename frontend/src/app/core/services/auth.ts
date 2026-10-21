import { Injectable, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface UsuarioPerfil {
  id: number;
  nome: string;
  email: string;
  created_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class Auth {
  private apiUrl = 'http://localhost:8000/api/auth';
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  usuarioAtual = signal<UsuarioPerfil | null>(null);

  constructor(private http: HttpClient) {
    if (this.isBrowser && this.estaAutenticado()) {
      this.obterPerfil().subscribe({
        error: (err) => {
          if (err?.status === 401) {
            this.logout();
          }
        }
      });
    }
  }

  cadastrar(dadosUsuario: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/cadastro`, dadosUsuario);
  }

  login(email: string, senha: string): Observable<any> {
    const body = new URLSearchParams();
    body.set('username', email);
    body.set('password', senha);

    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded'
    });

    return this.http.post<any>(`${this.apiUrl}/login`, body.toString(), { headers }).pipe(
      tap((res) => {
        if (res?.access_token) {
          this.guardarToken(res.access_token);
          this.obterPerfil().subscribe({
            error: (err) => console.warn('Erro ao carregar perfil pós-login:', err)
          });
        }
      })
    );
  }

  obterPerfil(): Observable<UsuarioPerfil> {
    return this.http.get<UsuarioPerfil>(`${this.apiUrl}/me`).pipe(
      tap((perfil) => this.usuarioAtual.set(perfil))
    );
  }

  atualizarPerfil(nome: string): Observable<UsuarioPerfil> {
    return this.http.put<UsuarioPerfil>(`${this.apiUrl}/me`, { nome }).pipe(
      tap((perfil) => this.usuarioAtual.set(perfil))
    );
  }

  alterarSenha(senhaAtual: string, novaSenha: string): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/alterar-senha`, {
      senha_atual: senhaAtual,
      nova_senha: novaSenha
    });
  }

  guardarToken(token: string): void {
    if (this.isBrowser) {
      localStorage.setItem('access_token', token);
    }
  }

  obterToken(): string | null {
    if (this.isBrowser) {
      return localStorage.getItem('access_token');
    }
    return null;
  }

  estaAutenticado(): boolean {
    return !!this.obterToken();
  }

  logout(): void {
    if (this.isBrowser) {
      localStorage.removeItem('access_token');
      this.usuarioAtual.set(null);
    }
  }
}