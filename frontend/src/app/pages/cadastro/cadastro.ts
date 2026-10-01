import { Component, signal, inject} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';

function senhasIguaisValidator(control: AbstractControl): ValidationErrors | null {
  const senha = control.get('senha')?.value;
  const confirmarSenha = control.get('confirmarSenha')?.value;
  return senha === confirmarSenha ? null : { senhasDiferentes: true };
}

@Component({
  selector: 'app-cadastro',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './cadastro.html',
  styleUrl: './cadastro.scss',
})
export class Cadastro {
  private fb = inject(FormBuilder);

  cadastroForm = this.fb.group({
    nome: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    senha: ['', [
      Validators.required, 
      Validators.minLength(6),
      Validators.pattern(/(?=.*[A-Z])(?=.*[0-9])/) // Pelo menos 1 maiúscula e 1 número
    ]],
    confirmarSenha: ['', Validators.required]
  }, { validators: senhasIguaisValidator });
  
  hidePassword = signal(true);
  hideConfirmPassword = signal(true);

  togglePassword() {
    this.hidePassword.update(valor => !valor);
  }

  toggleConfirmPassword() {
    this.hideConfirmPassword.update(valor => !valor); 
  }
  fazerCadastro() {
    if (this.cadastroForm.valid) {
      console.log('Dados do novo utilizador prontos:', this.cadastroForm.value);
    } else {
      this.cadastroForm.markAllAsTouched();
    }
  }
}
