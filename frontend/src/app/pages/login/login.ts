import { Component, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
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
      console.log('Formulário válido! Dados:', this.loginForm.value);
      
    } else {
      console.log('Preencha os dados corretamente!');
      this.loginForm.markAllAsTouched();
    }
  }
}
