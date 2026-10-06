import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class Auth {
  private apiUrl = 'http://localhost:8000/api/auth';

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
    localStorage.setItem('access_token', token);
  }

  obterToken(): string | null {
    return localStorage.getItem('access_token');
  }

  logout(): void {
    localStorage.removeItem('access_token');
  }
}