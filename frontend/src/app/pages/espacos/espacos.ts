import { Component, OnInit, inject, signal, computed, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EspacoService } from '../../core/services/espaco';
import { MovimentacaoService } from '../../core/services/movimentacao';
import { ThemeService } from '../../core/services/theme';
import { Auth } from '../../core/services/auth';

export type IconeEspaco = 'casal' | 'casa' | 'viagem' | 'pessoal';

export interface ParticipanteEspaco {
  nome: string;
  email?: string;
  papel: 'admin' | 'membro';
  iniciais: string;
  corAvatar: string;
}

export interface ItemEspaco {
  id: number;
  nome: string;
  tipo: 'compartilhado' | 'individual';
  cor: string;
  icone: IconeEspaco;
  saldo: number;
  receitas: number;
  despesas: number;
  admin: string;
  participantes: ParticipanteEspaco[];
}

interface EspacoMetaStorage {
  tipo?: 'compartilhado' | 'individual';
  cor?: string;
  corPersonalizada?: boolean;
  icone?: IconeEspaco;
  participantesExtras?: ParticipanteEspaco[];
}

const STORAGE_META_KEY = 'couplegraph_espacos_meta_real_v1';
const STORAGE_ACTIVE_ID_KEY = 'couplegraph_espaco_ativo_id';

@Component({
  selector: 'app-espacos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './espacos.html',
  styleUrl: './espacos.scss'
})
export class Espacos implements OnInit {
  private espacoService = inject(EspacoService);
  private movimentacaoService = inject(MovimentacaoService);
  themeService = inject(ThemeService);
  private authService = inject(Auth);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  listaEspacos = signal<ItemEspaco[]>([]);
  espacoAtivoId = this.espacoService.espacoAtivoId;
  carregando = signal<boolean>(true);
  toastMensagem = signal<string>('');

  // Paleta de cores oficial para identificação dos espaços
  readonly coresDisponiveis: string[] = [
    '#22C55E', // Verde CoupleGraph
    '#3B82F6', // Azul
    '#8B5CF6', // Roxo
    '#F59E0B', // Laranja
    '#EF4444', // Vermelho
    '#06B6D4', // Ciano
    '#EAB308', // Amarelo
    '#6366F1', // Índigo
    '#64748B'  // Cinza Ardósia
  ];

  // As 4 opções de ícones solicitadas: Grupo, Casa, Viagem e Pessoal
  readonly iconesDisponiveis: { id: IconeEspaco; label: string }[] = [
    { id: 'casal', label: 'Grupo' },
    { id: 'casa', label: 'Casa' },
    { id: 'viagem', label: 'Viagem' },
    { id: 'pessoal', label: 'Pessoal' }
  ];

  // Espaço ativo computado a partir da lista real
  espacoAtivo = computed<ItemEspaco | null>(() => {
    const lista = this.listaEspacos();
    if (lista.length === 0) return null;
    const idAtivo = this.espacoAtivoId();
    return lista.find(e => e.id === idAtivo) || lista[0];
  });

  // Estados de Modais / Painel Lateral
  modalNovoEspacoAberto = signal(false);
  modalGerenciarAberto = signal(false);
  modoConvidar = signal(false);
  editandoNome = signal(false);

  // Modais de Confirmação e Sucesso
  modalConfirmarExclusaoAberto = signal(false);
  modalSucessoExclusaoAberto = signal(false);
  nomeEspacoExcluido = signal('');

  modalConfirmarRemoverMembroAberto = signal(false);
  modalSucessoRemoverMembroAberto = signal(false);
  membroParaRemover = signal('');

  // Mensagens de Erro
  erroNovoEspaco = signal('');
  erroEdicaoNome = signal('');

  // Campos do Formulário "Novo Espaço"
  novoEspacoNome = '';
  novoEspacoTipo: 'compartilhado' | 'individual' = 'compartilhado';
  novoEspacoCor = '#22C55E';
  novoEspacoIcone: IconeEspaco = 'casal';
  novoEspacoEmailConvite = '';
  novosConvidados = signal<string[]>([]);

  // Campos do Modal "Gerenciar Espaço"
  espacoSelecionado: ItemEspaco | null = null;
  nomeEditado = '';
  corEditada = '#22C55E';
  iconeEditado: IconeEspaco = 'casal';
  tipoEditado: 'compartilhado' | 'individual' = 'compartilhado';
  emailConvite = '';

  ngOnInit(): void {
    this.carregarEspacos();
  }

  obterNomeUsuarioLogado(): string {
    const u = this.authService.usuarioAtual();
    if (u?.nome) {
      return u.nome.split(' ')[0];
    }
    return 'Você';
  }

  obterEmailUsuarioLogado(): string {
    return this.authService.usuarioAtual()?.email || '';
  }

  obterIniciais(nome: string): string {
    if (!nome) return 'U';
    const partes = nome.trim().split(' ').filter(Boolean);
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }

  formatarMoeda(valor: number): string {
    return this.themeService.formatarMoeda(valor || 0);
  }

  obterDescricaoTipo(espaco: ItemEspaco): string {
    const num = espaco.participantes?.length || 1;
    if (espaco.tipo === 'individual' && num <= 1) {
      return 'Espaço individual • 1 participante';
    }
    return `Espaço compartilhado • ${num} ${num === 1 ? 'participante' : 'participantes'}`;
  }

  carregarEspacos(): void {
    this.carregando.set(true);
    const metaMap = this.lerMetaStorage();
    const nomeUser = this.obterNomeUsuarioLogado();
    const emailUser = this.obterEmailUsuarioLogado();

    this.espacoService.listarMeusEspacos().subscribe({
      next: (dados) => {
        const coresUsadas = new Set<string>();
        const espacosBase: ItemEspaco[] = (dados || []).map((item, idx) => {
          const id = item.espaco.id;
          const nome = item.espaco.nome;
          const meta = metaMap[id] || {};
          const padrao = this.inferirVisualPorNome(nome, idx);

          let corEspaco: string = meta.cor || padrao.cor;
          if (!meta.corPersonalizada && coresUsadas.has(corEspaco.toUpperCase())) {
            const alternativa = this.coresDisponiveis.find(c => !coresUsadas.has(c.toUpperCase()));
            corEspaco = alternativa || this.coresDisponiveis[idx % this.coresDisponiveis.length];
          }
          coresUsadas.add(corEspaco.toUpperCase());

          const saldoReal = Number(item.espaco.saldo ?? 0);
          const despesasReal = Number(item.espaco.despesas ?? 0);
          const receitasReal = saldoReal + despesasReal;

          const adminParticipante: ParticipanteEspaco = {
            nome: nomeUser,
            email: emailUser,
            papel: item.papel === 'administrador' ? 'admin' : 'membro',
            iniciais: this.obterIniciais(nomeUser),
            corAvatar: '#3B82F6'
          };

          const extras = meta.participantesExtras || [];
          const todosParticipantes = [adminParticipante, ...extras];

          const tipoReal: 'compartilhado' | 'individual' =
            meta.tipo || (todosParticipantes.length > 1 || (item.espaco.total_membros ?? 1) > 1 ? 'compartilhado' : 'individual');

          return {
            id,
            nome,
            tipo: tipoReal,
            cor: corEspaco,
            icone: meta.icone || padrao.icone,
            saldo: saldoReal,
            receitas: receitasReal,
            despesas: despesasReal,
            admin: nomeUser,
            participantes: todosParticipantes
          };
        });

        this.listaEspacos.set(espacosBase);
        this.inicializarEspacoAtivo(espacosBase);
        this.carregando.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erro ao buscar espaços reais:', err);
        this.listaEspacos.set([]);
        this.carregando.set(false);
        this.cdr.detectChanges();
      }
    });
  }

  private inferirVisualPorNome(nome: string, idx: number): { cor: string; icone: IconeEspaco } {
    const n = nome.toLowerCase();
    if (n.includes('casa') || n.includes('imóvel') || n.includes('moradia')) {
      return { cor: '#3B82F6', icone: 'casa' };
    }
    if (n.includes('viagem') || n.includes('férias')) {
      return { cor: '#8B5CF6', icone: 'viagem' };
    }
    if (n.includes('pessoal') || n.includes('individual')) {
      return { cor: '#64748B', icone: 'pessoal' };
    }
    return {
      cor: this.coresDisponiveis[idx % this.coresDisponiveis.length],
      icone: 'casal'
    };
  }

  private inicializarEspacoAtivo(lista: ItemEspaco[]): void {
    if (lista.length === 0) {
      this.espacoService.definirEspacoAtivoId(null);
      return;
    }
    const salvo = this.espacoService.espacoAtivoId();
    if (salvo && lista.some(e => e.id === salvo)) {
      return;
    }
    this.espacoService.definirEspacoAtivoId(lista[0].id);
  }

  selecionarEspacoAtivo(espaco: ItemEspaco, mostrarAviso = true): void {
    this.espacoService.definirEspacoAtivoId(espaco.id);
    if (mostrarAviso) {
      this.exibirToast(`Espaço "${espaco.nome}" definido como atual!`);
    }
    this.cdr.detectChanges();
  }

  acessarDetalhesEspaco(espaco: ItemEspaco, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.selecionarEspacoAtivo(espaco, false);
    this.router.navigate(['/movimentacoes'], { queryParams: { espaco: espaco.id } });
  }

  // --- CRIAR NOVO ESPAÇO ---
  abrirModalNovoEspaco(): void {
    this.novoEspacoNome = '';
    this.novoEspacoTipo = 'compartilhado';
    const coresEmUso = new Set(this.listaEspacos().map(e => (e.cor || '').toUpperCase()));
    const corLivre = this.coresDisponiveis.find(c => !coresEmUso.has(c.toUpperCase()));
    this.novoEspacoCor = corLivre || this.coresDisponiveis[this.listaEspacos().length % this.coresDisponiveis.length];
    this.novoEspacoIcone = 'casal';
    this.novoEspacoEmailConvite = '';
    this.novosConvidados.set([]);
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

  selecionarTipoNovoEspaco(tipo: 'compartilhado' | 'individual'): void {
    this.novoEspacoTipo = tipo;
    if (tipo === 'individual' && this.novoEspacoIcone === 'casal') {
      this.novoEspacoIcone = 'pessoal';
    } else if (tipo === 'compartilhado' && this.novoEspacoIcone === 'pessoal') {
      this.novoEspacoIcone = 'casal';
    }
  }

  selecionarCorNovoEspaco(cor: string): void {
    this.novoEspacoCor = cor;
  }

  selecionarIconeNovoEspaco(icone: IconeEspaco): void {
    this.novoEspacoIcone = icone;
  }

  adicionarConvidadoLista(): void {
    const email = this.novoEspacoEmailConvite.trim();
    if (!email) return;
    if (!email.includes('@')) {
      this.erroNovoEspaco.set('Informe um e-mail válido para convidar.');
      return;
    }
    this.erroNovoEspaco.set('');
    if (!this.novosConvidados().includes(email)) {
      this.novosConvidados.update(atuais => [...atuais, email]);
    }
    this.novoEspacoEmailConvite = '';
  }

  removerConvidadoLista(email: string): void {
    this.novosConvidados.update(atuais => atuais.filter(e => e !== email));
  }

  salvarNovoEspaco(): void {
    const nome = this.novoEspacoNome.trim();
    if (!nome) {
      this.erroNovoEspaco.set('Informe um nome para o espaço.');
      return;
    }

    this.erroNovoEspaco.set('');

    const jaExiste = this.listaEspacos().some(
      esp => esp.nome.trim().toLowerCase() === nome.toLowerCase()
    );
    if (jaExiste) {
      this.erroNovoEspaco.set('Você já é dono de um espaço com esse nome.');
      this.cdr.detectChanges();
      return;
    }

    if (this.novoEspacoEmailConvite.trim() && this.novoEspacoEmailConvite.includes('@')) {
      this.adicionarConvidadoLista();
    }

    const nomeUser = this.obterNomeUsuarioLogado();
    const emailUser = this.obterEmailUsuarioLogado();

    const adminPart: ParticipanteEspaco = {
      nome: nomeUser,
      email: emailUser,
      papel: 'admin',
      iniciais: this.obterIniciais(nomeUser),
      corAvatar: '#3B82F6'
    };

    const participantesExtras: ParticipanteEspaco[] = [];
    if (this.novoEspacoTipo === 'compartilhado') {
      this.novosConvidados().forEach((em, i) => {
        const nomeExtraido = em.split('@')[0];
        const formatado = nomeExtraido.charAt(0).toUpperCase() + nomeExtraido.slice(1);
        participantesExtras.push({
          nome: formatado,
          email: em,
          papel: 'membro',
          iniciais: this.obterIniciais(formatado),
          corAvatar: this.coresDisponiveis[(i + 2) % this.coresDisponiveis.length]
        });
      });
    }

    this.espacoService.criarEspaco({ nome }).subscribe({
      next: (novo) => {
        this.salvarMetaNoStorage(novo.id, {
          tipo: this.novoEspacoTipo,
          cor: this.novoEspacoCor,
          corPersonalizada: true,
          icone: this.novoEspacoIcone,
          participantesExtras
        });

        const novoItem: ItemEspaco = {
          id: novo.id,
          nome: novo.nome,
          tipo: this.novoEspacoTipo,
          cor: this.novoEspacoCor,
          icone: this.novoEspacoIcone,
          saldo: 0,
          receitas: 0,
          despesas: 0,
          admin: nomeUser,
          participantes: [adminPart, ...participantesExtras]
        };

        this.listaEspacos.update(lista => [...lista, novoItem]);
        this.selecionarEspacoAtivo(novoItem, false);
        this.fecharModalNovoEspaco();
        this.exibirToast(`Espaço "${novo.nome}" criado com sucesso!`);
        this.cdr.detectChanges();
      },
      error: (err) => {
        const msg = err.error?.detail || 'Não foi possível criar o espaço. Verifique se já existe outro com este nome.';
        this.erroNovoEspaco.set(msg);
        this.cdr.detectChanges();
      }
    });
  }

  // --- GERENCIAR ESPAÇO ---
  gerenciarEspaco(espaco: ItemEspaco, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.espacoSelecionado = {
      ...espaco,
      participantes: [...(espaco.participantes || [])]
    };
    this.nomeEditado = espaco.nome;
    this.corEditada = espaco.cor;
    this.iconeEditado = espaco.icone;
    this.tipoEditado = espaco.tipo;
    this.emailConvite = '';
    this.modoConvidar.set(false);
    this.editandoNome.set(false);
    this.erroEdicaoNome.set('');
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

  alterarCorNoGerenciar(cor: string): void {
    this.corEditada = cor;
    if (this.espacoSelecionado) {
      this.espacoSelecionado.cor = cor;
      this.persistirAlteracoesEspacoSelecionado();
    }
  }

  alterarIconeNoGerenciar(icone: IconeEspaco): void {
    this.iconeEditado = icone;
    if (this.espacoSelecionado) {
      this.espacoSelecionado.icone = icone;
      this.persistirAlteracoesEspacoSelecionado();
    }
  }

  salvarNomeEditado(): void {
    const novoNome = this.nomeEditado.trim();
    if (!novoNome || !this.espacoSelecionado) return;

    this.erroEdicaoNome.set('');

    if (novoNome.toLowerCase() === this.espacoSelecionado.nome.trim().toLowerCase()) {
      this.editandoNome.set(false);
      this.cdr.detectChanges();
      return;
    }

    const jaExisteOutro = this.listaEspacos().some(
      esp => esp.id !== this.espacoSelecionado?.id && esp.nome.trim().toLowerCase() === novoNome.toLowerCase()
    );
    if (jaExisteOutro) {
      this.erroEdicaoNome.set('Você já possui outro espaço com esse nome.');
      this.cdr.detectChanges();
      return;
    }

    const id = this.espacoSelecionado.id;
    this.espacoService.atualizarEspaco(id, { nome: novoNome }).subscribe({
      next: (atualizado) => {
        if (this.espacoSelecionado) {
          this.espacoSelecionado.nome = atualizado.nome;
        }
        this.listaEspacos.update(lista =>
          lista.map(item => item.id === id ? { ...item, nome: atualizado.nome } : item)
        );
        this.editandoNome.set(false);
        this.exibirToast('Nome do espaço atualizado!');
        this.cdr.detectChanges();
      },
      error: (err) => {
        const msg = err.error?.detail || 'Erro ao atualizar o nome do espaço.';
        this.erroEdicaoNome.set(msg);
        this.cdr.detectChanges();
      }
    });
  }

  private persistirAlteracoesEspacoSelecionado(): void {
    if (!this.espacoSelecionado) return;
    const esp = this.espacoSelecionado;
    const extras = esp.participantes.filter(p => p.papel !== 'admin');

    this.salvarMetaNoStorage(esp.id, {
      tipo: esp.tipo,
      cor: esp.cor,
      corPersonalizada: true,
      icone: esp.icone,
      participantesExtras: extras
    });

    this.listaEspacos.update(lista =>
      lista.map(item => item.id === esp.id ? { ...esp } : item)
    );
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
    const email = this.emailConvite.trim();
    if (!email || !this.espacoSelecionado) return;

    const nomeExtraido = email.includes('@') ? email.split('@')[0] : email;
    const nomeFormatado = nomeExtraido.charAt(0).toUpperCase() + nomeExtraido.slice(1);

    const novoMembro: ParticipanteEspaco = {
      nome: nomeFormatado,
      email,
      papel: 'membro',
      iniciais: this.obterIniciais(nomeFormatado),
      corAvatar: '#EC4899'
    };

    this.espacoSelecionado.participantes = [
      ...(this.espacoSelecionado.participantes || []),
      novoMembro
    ];
    this.espacoSelecionado.tipo = 'compartilhado';
    this.persistirAlteracoesEspacoSelecionado();
    this.exibirToast(`Participante ${nomeFormatado} adicionado!`);
    this.cancelarConvidar();
  }

  // --- REMOÇÃO DE PARTICIPANTE ---
  solicitarRemocaoMembro(membroNome: string): void {
    this.membroParaRemover.set(membroNome);
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
    if (this.espacoSelecionado && membro) {
      this.espacoSelecionado.participantes = this.espacoSelecionado.participantes.filter(
        p => p.nome !== membro
      );
      if (this.espacoSelecionado.participantes.length <= 1) {
        this.espacoSelecionado.tipo = 'individual';
      }
      this.persistirAlteracoesEspacoSelecionado();
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

  // --- EXCLUSÃO DE ESPAÇO ---
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
      if (this.espacoAtivoId() === id) {
        const restantes = this.listaEspacos();
        this.espacoAtivoId.set(restantes.length > 0 ? restantes[0].id : null);
      }
      this.modalConfirmarExclusaoAberto.set(false);
      this.espacoSelecionado = null;
      this.modalSucessoExclusaoAberto.set(true);
      this.cdr.detectChanges();
    };

    this.espacoService.excluirEspaco(id).subscribe({
      next: () => concluirExclusao(),
      error: (err) => {
        console.error('Erro ao excluir espaço:', err);
        concluirExclusao();
      }
    });
  }

  fecharModalSucessoExclusao(): void {
    this.modalSucessoExclusaoAberto.set(false);
    this.cdr.detectChanges();
  }

  // --- PERSISTÊNCIA LOCALSTORAGE (COR, ÍCONE E PARTICIPANTES EXTRAS) ---
  private lerMetaStorage(): Record<number, EspacoMetaStorage> {
    if (!isPlatformBrowser(this.platformId)) return {};
    try {
      const raw = localStorage.getItem(STORAGE_META_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private salvarMetaNoStorage(id: number, meta: EspacoMetaStorage): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const atual = this.lerMetaStorage();
      atual[id] = meta;
      localStorage.setItem(STORAGE_META_KEY, JSON.stringify(atual));
      this.espacoService.notificarAtualizacao();
    } catch {
      // ignore
    }
  }

  exibirToast(msg: string): void {
    this.toastMensagem.set(msg);
    setTimeout(() => {
      this.toastMensagem.set('');
      this.cdr.detectChanges();
    }, 3200);
  }
}
