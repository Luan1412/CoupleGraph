import { Component, signal} from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-cadastro',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cadastro.html',
  styleUrl: './cadastro.scss',
})
export class Cadastro {
  hidePassword = signal(true);
  hideConfirmPassword = signal(true);

  togglePassword() {
    this.hidePassword.update(valor => !valor);
  }

  toggleConfirmPassword() {
    this.hideConfirmPassword.update(valor => !valor);
  }
}
