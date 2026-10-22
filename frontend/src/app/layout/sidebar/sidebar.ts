import { Component, OnInit, inject, signal, computed, effect, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { EspacoService } from '../../core/services/espaco';
import { ThemeService } from '../../core/services/theme';
import { Auth } from '../../core/services/auth';

export type IconeEspacoSidebar = 'casal' | 'casa' | 'viagem' | 'pessoal';

export interface EspacoResumoSidebar {
  id: number;
  nome: string;
  tipo: 'compartilhado' | 'individual';
  cor: string;
  icone: IconeEspacoSidebar;
  numParticipantes: number;
}

const STORAGE_META_KEY = 'couplegraph_espacos_meta_real_v1';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class Sidebar implements OnInit {
  espacoService = inject(EspacoService);
  themeService = inject(ThemeService);
  authService = inject(Auth);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  espacos = signal<EspacoResumoSidebar[]>([]);
  dropdownAberto = signal<boolean>(false);

  readonly coresPadrao = [
    '#22C55E',
    '#3B82F6',
    '#8B5CF6',
    '#F59E0B',
    '#EF4444',
    '#06B6D4',
    '#EAB308',
    '#6366F1',
    '#64748B'
  ];

  espacoAtivo = computed<EspacoResumoSidebar | null>(() => {
    const lista = this.espacos();
    if (lista.length === 0) return null;
    const idAtivo = this.espacoService.espacoAtivoId();
    return lista.find(e => e.id === idAtivo) || lista[0];
  });

  constructor() {
    effect(() => {
      // Recarrega sempre que houver criação, edição, exclusão ou mudança de metadados nos espaços
      this.espacoService.versaoEspacos();
      this.carregarEspacosSidebar();
    });
  }

  ngOnInit(): void {
    this.carregarEspacosSidebar();
    if (!this.authService.usuarioAtual() && this.authService.estaAutenticado()) {
      this.authService.obterPerfil().subscribe({ error: () => {} });
    }
  }

  carregarEspacosSidebar(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const metaMap = this.lerMetaStorage();

    this.espacoService.listarMeusEspacos().subscribe({
      next: (dados) => {
        const coresUsadas = new Set<string>();
        const mapeados: EspacoResumoSidebar[] = (dados || []).map((item, idx) => {
          const id = item.espaco.id;
          const nome = item.espaco.nome;
          const meta = metaMap[id] || {};
          const padrao = this.inferirVisualPorNome(nome, idx);

          let corEspaco: string = meta.cor || padrao.cor;
          if (!meta.corPersonalizada && coresUsadas.has(corEspaco.toUpperCase())) {
            const alternativa = this.coresPadrao.find(c => !coresUsadas.has(c.toUpperCase()));
            corEspaco = alternativa || this.coresPadrao[idx % this.coresPadrao.length];
          }
          coresUsadas.add(corEspaco.toUpperCase());

          const extrasCount = Array.isArray(meta.participantesExtras) ? meta.participantesExtras.length : 0;
          const totalMembros = Math.max(item.espaco.total_membros || 1, 1 + extrasCount);
          const tipo: 'compartilhado' | 'individual' =
            meta.tipo || (totalMembros > 1 ? 'compartilhado' : 'individual');

          return {
            id,
            nome,
            tipo,
            cor: corEspaco,
            icone: meta.icone || padrao.icone,
            numParticipantes: tipo === 'individual' ? 1 : Math.max(2, totalMembros)
          };
        });

        this.espacos.set(mapeados);
        if (mapeados.length > 0) {
          const atual = this.espacoService.espacoAtivoId();
          if (!atual || !mapeados.some(e => e.id === atual)) {
            this.espacoService.definirEspacoAtivoId(mapeados[0].id);
          }
        }
      },
      error: () => {
        this.espacos.set([]);
      }
    });
  }

  private inferirVisualPorNome(nome: string, idx: number): { cor: string; icone: IconeEspacoSidebar } {
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
      cor: this.coresPadrao[idx % this.coresPadrao.length],
      icone: 'casal'
    };
  }

  private lerMetaStorage(): Record<number, any> {
    if (!isPlatformBrowser(this.platformId)) return {};
    try {
      const raw = localStorage.getItem(STORAGE_META_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  alternarDropdownEspacos(): void {
    this.dropdownAberto.update(v => !v);
  }

  selecionarEspaco(espaco: EspacoResumoSidebar): void {
    this.espacoService.definirEspacoAtivoId(espaco.id);
    this.dropdownAberto.set(false);
  }

  irParaEspacos(): void {
    this.dropdownAberto.set(false);
    this.router.navigate(['/espacos']);
  }

  alternarModoEscuro(): void {
    this.themeService.alternarTema();
  }

  obterNomeUsuario(): string {
    return this.authService.usuarioAtual()?.nome || 'Usuário';
  }

  obterEmailUsuario(): string {
    return this.authService.usuarioAtual()?.email || '';
  }

  irParaConfiguracoes(): void {
    this.router.navigate(['/configuracoes']);
  }
}