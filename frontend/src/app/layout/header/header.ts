import {
  Component,
  EventEmitter,
  Output,
  Input,
  OnInit,
  inject,
  signal,
  computed,
  effect,
  HostListener,
  ElementRef
} from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../core/services/auth';
import { EspacoService, ConviteEspacoModel } from '../../core/services/espaco';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.html',
  styleUrl: './header.scss'
})
export class Header implements OnInit {
  authService = inject(Auth);
  espacoService = inject(EspacoService);
  private router = inject(Router);
  private elementRef = inject(ElementRef);

  @Output() menuToggle = new EventEmitter<void>();

  @Input() menuAberto: boolean = false;

  dropdownUsuarioAberto = signal<boolean>(false);
  dropdownNotificacoesAberto = signal<boolean>(false);
  processandoConviteId = signal<number | null>(null);

  // Pedidos pendentes para participar de espaços
  convitesPendentes = this.espacoService.convitesRecebidos;

  // Indica se há algum convite pendente (exibe a bolinha verde no sino)
  temNotificacaoNaoLida = computed<boolean>(() => {
    return this.convitesPendentes().length > 0;
  });

  qtdNaoLidas = computed<number>(() => {
    return this.convitesPendentes().length;
  });

  constructor() {
    effect(() => {
      const u = this.authService.usuarioAtual();
      if (u) {
        this.espacoService.carregarConvites();
      } else {
        this.espacoService.convitesRecebidos.set([]);
        this.espacoService.convitesEnviados.set([]);
      }
    });
  }

  ngOnInit(): void {
    this.espacoService.carregarConvites();
  }

  obterPrimeiroNome(): string {
    const nomeCompleto = this.authService.usuarioAtual()?.nome?.trim();
    if (!nomeCompleto) return 'Usuário';
    return nomeCompleto.split(/\s+/)[0];
  }

  abrirMenu() {
    this.menuToggle.emit();
  }

  toggleDropdownNotificacoes(event: MouseEvent): void {
    event.stopPropagation();
    const proximo = !this.dropdownNotificacoesAberto();
    this.dropdownUsuarioAberto.set(false);
    this.dropdownNotificacoesAberto.set(proximo);
    if (proximo) {
      this.espacoService.carregarConvites();
    }
  }

  fecharDropdownNotificacoes(): void {
    this.dropdownNotificacoesAberto.set(false);
  }

  aceitarConviteNotif(convite: ConviteEspacoModel, event: MouseEvent): void {
    event.stopPropagation();
    if (this.processandoConviteId() !== null) return;
    this.processandoConviteId.set(convite.id);

    this.espacoService.aceitarConvite(convite.id).subscribe({
      next: () => {
        this.processandoConviteId.set(null);
        this.espacoService.definirEspacoAtivoId(convite.espaco_id);
      },
      error: () => {
        this.processandoConviteId.set(null);
        this.espacoService.carregarConvites();
      }
    });
  }

  recusarConviteNotif(convite: ConviteEspacoModel, event: MouseEvent): void {
    event.stopPropagation();
    if (this.processandoConviteId() !== null) return;
    this.processandoConviteId.set(convite.id);

    this.espacoService.recusarConvite(convite.id).subscribe({
      next: () => {
        this.processandoConviteId.set(null);
      },
      error: () => {
        this.processandoConviteId.set(null);
        this.espacoService.carregarConvites();
      }
    });
  }

  irParaEspacosConvites(): void {
    this.fecharDropdownNotificacoes();
    this.router.navigate(['/espacos']);
  }

  toggleDropdownUsuario(event: MouseEvent): void {
    event.stopPropagation();
    const proximoEstado = !this.dropdownUsuarioAberto();
    this.dropdownNotificacoesAberto.set(false);
    this.dropdownUsuarioAberto.set(proximoEstado);

    if (proximoEstado && !this.authService.usuarioAtual() && this.authService.estaAutenticado()) {
      this.authService.obterPerfil().subscribe({ error: () => {} });
    }
  }

  fecharDropdownUsuario(): void {
    this.dropdownUsuarioAberto.set(false);
  }

  irParaConfiguracoes(aba: 'perfil' | 'preferencias' | 'seguranca'): void {
    this.fecharDropdownUsuario();
    this.router.navigate(['/configuracoes'], { queryParams: { aba } });
  }

  sairDaConta(): void {
    this.fecharDropdownUsuario();
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.fecharDropdownUsuario();
      this.fecharDropdownNotificacoes();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.fecharDropdownUsuario();
    this.fecharDropdownNotificacoes();
  }
}