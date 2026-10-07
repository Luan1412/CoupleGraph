import { Component, signal, inject} from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Auth } from '../../core/services/auth';

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
  private authService = inject(Auth);
  private router = inject(Router);

  cadastroForm = this.fb.group({
    nome: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    senha: ['', [
      Validators.required, 
      Validators.minLength(6),
      Validators.pattern(/(?=.*[A-Z])(?=.*[0-9])/) 
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
      const dadosUsuario = {
        nome: this.cadastroForm.value.nome ?? '',
        email: this.cadastroForm.value.email ?? '',
        senha: this.cadastroForm.value.senha ?? ''
      };

      this.authService.cadastrar(dadosUsuario).subscribe({
        next: (resposta) => {
          console.log('Sucesso! Usuário criado:', resposta);
          alert('Conta criada com sucesso! Pode fazer o login agora.');
          
          this.router.navigate(['/login']); 
        },
        error: (erro) => {
          console.error('Falha no cadastro:', erro);
          alert('Erro ao criar conta. Verifica se o e-mail já está em uso.');
        }
      });
      
    } else {
      console.log('Preencha os dados corretamente!');
      this.cadastroForm.markAllAsTouched();
    }
  }
}
