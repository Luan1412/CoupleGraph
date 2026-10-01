import { Routes } from '@angular/router';
import { MainLayout } from './layout/main-layout/main-layout';
import { Welcome } from './pages/welcome/welcome';
import { Login } from './pages/login/login';
import { Cadastro } from './pages/cadastro/cadastro';

export const routes: Routes = [
  {path: '',component: Welcome,},
  { path: 'login', component: Login },
  { path: 'cadastro', component: Cadastro },
  
  {
    path: 'painel',
    component: MainLayout,
    children: [
    ]
  }
];