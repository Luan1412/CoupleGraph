import { Component, OnInit, inject, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EspacoService } from '../../core/services/espaco';

export interface ItemEspaco {
  id?: number;
  nome: string;
  tipo: string;
  admin: string;
  participantes?: string[];
}

@Component({
  selector: 'app-espacos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './espacos.html',
  styleUrl: './espacos.scss'
})
export class Espacos implements OnInit {
  private espacoService = inject(EspacoService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  listaEspacos = signal<ItemEspaco[]>([]);
  carregando = signal<boolean>(true);

  // Paginação (3 itens por página)
  readonly itensPorPagina = 3;
  paginaAtual = signal(1);

  totalPaginas = computed(() => {
    return Math.ceil(this.listaEspacos().length / this.itensPorPagina) || 1;
  });

  paginasArray = computed(() => {
    return Array.from({ length: this.totalPaginas() }, (_, i) => i + 1);
  });

  espacosPaginados = computed(() => {
    const inicio = (this.paginaAtual() - 1) * this.itensPorPagina;
    return this.listaEspacos().slice(inicio, inicio + this.itensPorPagina);
  });

  paginaAnterior(): void {
    if (this.paginaAtual() > 1) {
      this.paginaAtual.update(p => p - 1);
      this.cdr.detectChanges();
    }
  }

  proximaPagina(): void {
    if (this.paginaAtual() < this.totalPaginas()) {
      this.paginaAtual.update(p => p + 1);
      this.cdr.detectChanges();
    }
  }

  irParaPagina(num: number): void {
    this.paginaAtual.set(num);
    this.cdr.detectChanges();
  }

  // Modais e Estados
  modalNovoEspacoAberto = signal(false);
  modalGerenciarAberto = signal(false);
  modoConvidar = signal(false);
  editandoNome = signal(false);

  // Modais de Confirmação e Sucesso Customizados
  modalConfirmarExclusaoAberto = signal(false);
  modalSucessoExclusaoAberto = signal(false);
  nomeEspacoExcluido = signal('');

  modalConfirmarRemoverMembroAberto = signal(false);
  modalSucessoRemoverMembroAberto = signal(false);
  membroParaRemover = signal('');

  // Mensagens de Erro de Validação
  erroNovoEspaco = signal('');
  erroEdicaoNome = signal('');

  espacoSelecionado: ItemEspaco | null = null;
  novoEspacoNome = '';
  nomeEditado = '';
  emailConvite = '';

  ngOnInit(): void {
    this.carregarEspacos();
  }

  carregarEspacos(): void {
    this.carregando.set(true);
    this.espacoService.listarMeusEspacos().subscribe({
      next: (dados) => {
        if (dados && dados.length > 0) {
          const mapeados: ItemEspaco[] = dados.map(item => ({
            id: item.espaco.id,
            nome: item.espaco.nome,
            tipo: 'Espaço compartilhado · 2 pessoas',
            admin: item.papel === 'administrador' ? 'Luan' : 'Parceiro(a)',
            participantes: ['Késia']
          }));
          this.listaEspacos.set(mapeados);
        } else {
          this.listaEspacos.set([]);
        }
        this.paginaAtual.set(1);
        this.carregando.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erro ao buscar espaços:', err);
        this.listaEspacos.set([]);
        this.carregando.set(false);
        this.cdr.detectChanges();
      }
    });
  }

  abrirModalNovoEspaco(): void {
    this.novoEspacoNome = '';
    this.erroNovoEspaco.set('');
    this.modalNovoEspacoAberto.set(true);
    this.cdr.detectChanges();
  }

  fecharModalNovoEspaco(): void {
    this.modalNovoEspacoAberto.set(false);
    this.novoEspacoNome = '';
    this.erroNovoEspaco.set('');
    this.cdr.detectChanges();
  }

  salvarNovoEspaco(): void {
    const nome = this.novoEspacoNome.trim();
    if (!nome) return;

    this.erroNovoEspaco.set('');

    // Validação local imediata: se já administra um espaço com esse nome
    const jaExiste = this.listaEspacos().some(
      esp => esp.nome.trim().toLowerCase() === nome.toLowerCase()
    );
    if (jaExiste) {
      this.erroNovoEspaco.set('Você já é dono de um espaço com esse nome.');
      this.cdr.detectChanges();
      return;
    }

    this.espacoService.criarEspaco({ nome }).subscribe({
      next: (novo) => {
        const novoItem: ItemEspaco = {
          id: novo.id,
          nome: novo.nome,
          tipo: 'Espaço compartilhado · 1 pessoa',
          admin: 'Luan',
          participantes: []
        };
        this.listaEspacos.update(lista => [...lista, novoItem]);
        this.paginaAtual.set(this.totalPaginas());
        this.fecharModalNovoEspaco();
        this.cdr.detectChanges();
      },
      error: (err) => {
        const msg = err.error?.detail || 'Você já é dono de um espaço com esse nome.';
        this.erroNovoEspaco.set(msg);
        this.cdr.detectChanges();
      }
    });
  }

  gerenciarEspaco(espaco: ItemEspaco): void {
    this.espacoSelecionado = { ...espaco };
    this.emailConvite = '';
    this.modoConvidar.set(false);
    this.editandoNome.set(false);
    this.erroEdicaoNome.set('');
    this.nomeEditado = espaco.nome;
    this.modalGerenciarAberto.set(true);
    this.cdr.detectChanges();
  }

  fecharModalGerenciar(): void {
    this.modalGerenciarAberto.set(false);
    this.espacoSelecionado = null;
    this.modoConvidar.set(false);
    this.editandoNome.set(false);
    this.erroEdicaoNome.set('');
    this.cdr.detectChanges();
  }

  iniciarEdicaoNome(): void {
    this.nomeEditado = this.espacoSelecionado?.nome || '';
    this.erroEdicaoNome.set('');
    this.editandoNome.set(true);
    this.cdr.detectChanges();
  }

  cancelarEdicaoNome(): void {
    this.editandoNome.set(false);
    this.erroEdicaoNome.set('');
    this.cdr.detectChanges();
  }

  salvarNomeEditado(): void {
    const novoNome = this.nomeEditado.trim();
    if (!novoNome || !this.espacoSelecionado) return;

    this.erroEdicaoNome.set('');

    // Se o nome não mudou, apenas fecha o modo de edição
    if (novoNome.toLowerCase() === this.espacoSelecionado.nome.trim().toLowerCase()) {
      this.editandoNome.set(false);
      this.cdr.detectChanges();
      return;
    }

    // Validação local: verifica se já é dono de outro espaço com o mesmo nome
    const jaExisteOutro = this.listaEspacos().some(
      esp => esp.id !== this.espacoSelecionado?.id && esp.nome.trim().toLowerCase() === novoNome.toLowerCase()
    );
    if (jaExisteOutro) {
      this.erroEdicaoNome.set('Você já é dono de um espaço com esse nome.');
      this.cdr.detectChanges();
      return;
    }

    const id = this.espacoSelecionado.id;
    if (id && id < 1000000000) {
      this.espacoService.atualizarEspaco(id, { nome: novoNome }).subscribe({
        next: (atualizado) => {
          this.aplicarEdicao(id, atualizado.nome);
        },
        error: (err) => {
          const msg = err.error?.detail || 'Você já é dono de um espaço com esse nome.';
          this.erroEdicaoNome.set(msg);
          this.cdr.detectChanges();
        }
      });
    } else if (id) {
      this.aplicarEdicao(id, novoNome);
    }
  }

  private aplicarEdicao(id: number, novoNome: string): void {
    if (this.espacoSelecionado) {
      this.espacoSelecionado.nome = novoNome;
    }
    this.listaEspacos.update(lista =>
      lista.map(item => item.id === id ? { ...item, nome: novoNome } : item)
    );
    this.editandoNome.set(false);
    this.cdr.detectChanges();
  }

  abrirConvidarPessoa(): void {
    this.modoConvidar.set(true);
    this.emailConvite = '';
    this.cdr.detectChanges();
  }

  cancelarConvidar(): void {
    this.modoConvidar.set(false);
    this.emailConvite = '';
    this.cdr.detectChanges();
  }

  enviarConvite(): void {
    if (this.emailConvite.trim()) {
      alert(`Convite enviado para ${this.emailConvite.trim()}!`);
      this.cancelarConvidar();
    }
  }

  // Gerenciamento de Membros com Modais Customizados
  solicitarRemocaoMembro(membro: string): void {
    this.membroParaRemover.set(membro);
    this.modalConfirmarRemoverMembroAberto.set(true);
    this.cdr.detectChanges();
  }

  cancelarRemocaoMembro(): void {
    this.modalConfirmarRemoverMembroAberto.set(false);
    this.membroParaRemover.set('');
    this.cdr.detectChanges();
  }

  confirmarRemocaoMembro(): void {
    const membro = this.membroParaRemover();
    if (this.espacoSelecionado && this.espacoSelecionado.participantes && membro) {
      this.espacoSelecionado.participantes = this.espacoSelecionado.participantes.filter(p => p !== membro);
      this.espacoSelecionado.tipo = 'Espaço pessoal · 1 pessoa';
    }
    this.modalConfirmarRemoverMembroAberto.set(false);
    this.modalSucessoRemoverMembroAberto.set(true);
    this.cdr.detectChanges();
  }

  fecharModalSucessoRemocaoMembro(): void {
    this.modalSucessoRemoverMembroAberto.set(false);
    this.membroParaRemover.set('');
    this.cdr.detectChanges();
  }

  // Exclusão de Espaço com Modais Customizados
  solicitarExclusaoEspaco(): void {
    if (!this.espacoSelecionado) return;
    this.modalGerenciarAberto.set(false);
    this.modalConfirmarExclusaoAberto.set(true);
    this.cdr.detectChanges();
  }

  cancelarExclusaoEspaco(): void {
    this.modalConfirmarExclusaoAberto.set(false);
    this.modalGerenciarAberto.set(true);
    this.cdr.detectChanges();
  }

  fecharModalExclusao(): void {
    this.modalConfirmarExclusaoAberto.set(false);
    this.cdr.detectChanges();
  }

  confirmarExclusaoEspaco(): void {
    if (!this.espacoSelecionado) return;
    const espaco = this.espacoSelecionado;
    const id = espaco.id;
    this.nomeEspacoExcluido.set(espaco.nome);

    const concluirExclusao = () => {
      this.listaEspacos.update(lista => lista.filter(e => e.id !== id));
      if (this.paginaAtual() > this.totalPaginas()) {
        this.paginaAtual.set(Math.max(1, this.totalPaginas()));
      }
      this.modalConfirmarExclusaoAberto.set(false);
      this.espacoSelecionado = null;
      this.modalSucessoExclusaoAberto.set(true);
      this.cdr.detectChanges();
    };

    if (id && id < 1000000000) {
      this.espacoService.excluirEspaco(id).subscribe({
        next: () => concluirExclusao(),
        error: (err) => {
          console.error('Erro ao excluir espaço:', err);
          concluirExclusao();
        }
      });
    } else {
      concluirExclusao();
    }
  }

  fecharModalSucessoExclusao(): void {
    this.modalSucessoExclusaoAberto.set(false);
    this.cdr.detectChanges();
  }

  abrirEspaco(espaco: ItemEspaco): void {
    this.router.navigate(['/dashboard']);
  }
}
