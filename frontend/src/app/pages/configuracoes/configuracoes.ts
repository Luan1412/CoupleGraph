import { Component, OnInit, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth, UsuarioPerfil } from '../../core/services/auth';
import { ThemeService, TemaTipo } from '../../core/services/theme';

@Component({
  selector: 'app-configuracoes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './configuracoes.html',
  styleUrl: './configuracoes.scss'
})
export class Configuracoes implements OnInit {
  authService = inject(Auth);
  themeService = inject(ThemeService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  // Aba ativa
  abaAtiva = signal<'perfil' | 'seguranca' | 'preferencias' | 'conta'>('perfil');

  // Estados
  carregando = signal<boolean>(true);
  salvandoPerfil = signal<boolean>(false);
  salvandoSenha = signal<boolean>(false);
  erroPerfil = signal<string>('');
  erroSenha = signal<string>('');
  toastSucesso = signal<string>('');
  modalLogoutAberto = signal<boolean>(false);

  // Formulário Perfil
  nomeForm = '';
  emailForm = '';
  dataCriacaoForm = '';

  // Formulário Senha
  senhaAtualForm = '';
  novaSenhaForm = '';
  confirmarNovaSenhaForm = '';
  mostrarSenhaAtual = false;
  mostrarNovaSenha = false;

  ngOnInit(): void {
    const u = this.authService.usuarioAtual();
    if (u) {
      this.preencherDados(u);
    }
    this.carregarDadosUsuario();
  }

  carregarDadosUsuario(): void {
    this.carregando.set(true);
    this.authService.obterPerfil().subscribe({
      next: (usuario: UsuarioPerfil) => {
        this.preencherDados(usuario);
        this.carregando.set(false);
        this.cdr.detectChanges();
      },
      error: () => {
        const u = this.authService.usuarioAtual();
        if (u) {
          this.preencherDados(u);
        }
        this.carregando.set(false);
        this.cdr.detectChanges();
      }
    });
  }

  private preencherDados(u: UsuarioPerfil): void {
    this.nomeForm = u.nome || '';
    this.emailForm = u.email || '';
    if (u.created_at) {
      const d = new Date(u.created_at);
      this.dataCriacaoForm = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    } else {
      this.dataCriacaoForm = 'Membro desde 2026';
    }
  }

  trocarAba(aba: 'perfil' | 'seguranca' | 'preferencias' | 'conta'): void {
    this.abaAtiva.set(aba);
    this.erroPerfil.set('');
    this.erroSenha.set('');
  }

  obterIniciais(nome: string): string {
    if (!nome) return 'CG';
    const partes = nome.trim().split(' ');
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }

  salvarPerfil(): void {
    if (!this.nomeForm || !this.nomeForm.trim()) {
      this.erroPerfil.set('O nome não pode ficar em branco.');
      return;
    }

    this.salvandoPerfil.set(true);
    this.erroPerfil.set('');

    this.authService.atualizarPerfil(this.nomeForm.trim()).subscribe({
      next: () => {
        this.salvandoPerfil.set(false);
        this.exibirToast('Perfil atualizado com sucesso!');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.salvandoPerfil.set(false);
        this.erroPerfil.set(err?.error?.detail || 'Erro ao atualizar perfil.');
        this.cdr.detectChanges();
      }
    });
  }

  salvarSenha(): void {
    this.erroSenha.set('');

    if (!this.senhaAtualForm) {
      this.erroSenha.set('Por favor, informe sua senha atual.');
      return;
    }

    if (this.novaSenhaForm.length < 8) {
      this.erroSenha.set('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }

    if (!/[A-Z]/.test(this.novaSenhaForm)) {
      this.erroSenha.set('A nova senha deve conter pelo menos uma letra maiúscula.');
      return;
    }

    if (!/\d/.test(this.novaSenhaForm)) {
      this.erroSenha.set('A nova senha deve conter pelo menos um número.');
      return;
    }

    if (this.novaSenhaForm !== this.confirmarNovaSenhaForm) {
      this.erroSenha.set('A confirmação da nova senha não confere.');
      return;
    }

    this.salvandoSenha.set(true);
    this.authService.alterarSenha(this.senhaAtualForm, this.novaSenhaForm).subscribe({
      next: () => {
        this.salvandoSenha.set(false);
        this.senhaAtualForm = '';
        this.novaSenhaForm = '';
        this.confirmarNovaSenhaForm = '';
        this.exibirToast('Senha alterada com sucesso!');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.salvandoSenha.set(false);
        this.erroSenha.set(err?.error?.detail || 'Não foi possível alterar a senha. Verifique a senha atual.');
        this.cdr.detectChanges();
      }
    });
  }

  selecionarTema(tema: TemaTipo): void {
    if (this.themeService.temaAtual() === tema) return;
    this.themeService.definirTema(tema);
    this.exibirToast(tema === 'escuro' ? 'Modo Escuro ativado com sucesso!' : 'Modo Claro ativado com sucesso!');
  }

  alterarMoeda(event: Event): void {
    const target = event.target as HTMLSelectElement;
    if (target && target.value) {
      const moeda = target.value as 'BRL' | 'USD' | 'EUR';
      this.themeService.salvarMoeda(moeda);
      const nomes = { BRL: 'Real Brasileiro (R$)', USD: 'Dólar Americano ($)', EUR: 'Euro (€)' };
      this.exibirToast(`Moeda principal definida para ${nomes[moeda] || moeda}!`);
    }
  }

  alternarAlertaOrcamento(): void {
    const novoValor = !this.themeService.alertaOrcamento();
    this.themeService.salvarAlertaOrcamento(novoValor);
    this.exibirToast(novoValor ? 'Alertas de orçamento ativados!' : 'Alertas de orçamento desativados.');
  }

  alternarResumoSemanal(): void {
    const novoValor = !this.themeService.resumoSemanal();
    this.themeService.salvarResumoSemanal(novoValor);
    this.exibirToast(novoValor ? 'Resumo financeiro semanal ativado!' : 'Resumo financeiro semanal desativado.');
  }

  abrirModalLogout(): void {
    this.modalLogoutAberto.set(true);
  }

  fecharModalLogout(): void {
    this.modalLogoutAberto.set(false);
  }

  confirmarLogout(): void {
    this.fecharModalLogout();
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  exibirToast(msg: string): void {
    this.toastSucesso.set(msg);
    setTimeout(() => {
      this.toastSucesso.set('');
      this.cdr.detectChanges();
    }, 3500);
  }
}
