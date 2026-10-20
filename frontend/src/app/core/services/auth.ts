import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class Auth {
  private apiUrl = 'http://localhost:8000/api/auth';
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  constructor(private http: HttpClient) { }

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

    return this.http.post(`${this.apiUrl}/login`, body.toString(), { headers });
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
    }
  }
}