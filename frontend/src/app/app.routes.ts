import { Routes } from '@angular/router';
import { MainLayout } from './layout/main-layout/main-layout';
import { Welcome } from './pages/welcome/welcome';
import { Login } from './pages/login/login';
import { Cadastro } from './pages/cadastro/cadastro';
import { Dashboard } from './pages/dashboard/dashboard';

export const routes: Routes = [
  { path: '', component: Welcome },
  { path: 'login', component: Login },
  { path: 'cadastro', component: Cadastro },

  {
    path: '',
    component: MainLayout,
    children: [
      { path: 'dashboard', component: Dashboard }
    ]
  }
];