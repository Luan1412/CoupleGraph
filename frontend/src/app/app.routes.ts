import { Routes } from '@angular/router';
import { MainLayout } from './layout/main-layout/main-layout';
import { Welcome } from './pages/welcome/welcome';
import { Login } from './pages/login/login';
import { Cadastro } from './pages/cadastro/cadastro';
import { Dashboard } from './pages/dashboard/dashboard';
import { Espacos } from './pages/espacos/espacos';
import { Relatorios } from './pages/relatorios/relatorios';
import { Financas } from './pages/financas/financas';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', component: Welcome },
  { path: 'login', component: Login },
  { path: 'cadastro', component: Cadastro },

  {
    path: '',
    component: MainLayout,
    children: [
      { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
      { path: 'financas', component: Financas, canActivate: [authGuard] },
      { path: 'espacos', component: Espacos, canActivate: [authGuard] },
      { path: 'relatorios', component: Relatorios, canActivate: [authGuard] }
    ]
  }
];