import { Component, signal, inject } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { Auth } from '../../core/services/auth';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private fb = inject(FormBuilder);
  private authService = inject(Auth);
  private router = inject(Router);

  hidePassword = signal(true)

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]], 
    senha: ['', [Validators.required]]
  });

  togglePassword() {
    this.hidePassword.update(valor => !valor);
  }

  fazerLogin() {
    if (this.loginForm.valid) {

      const email = this.loginForm.value.email ?? '';
      const senha = this.loginForm.value.senha ?? '';

      this.authService.login(email, senha).subscribe({
        next: (resposta) => {
          console.log('Sucesso! Token gerado:', resposta.access_token);
          
          this.authService.guardarToken(resposta.access_token);

          alert('Login efetuado com sucesso!');      
      },
        error: (erro) => {
          console.error('Falha no login:', erro);
          alert('E-mail ou senha incorretos. Tenta novamente!');
        }      
      });
    
    } else {
      console.log('Preencha os dados corretamente!');
      this.loginForm.markAllAsTouched();
    }
  }
}
