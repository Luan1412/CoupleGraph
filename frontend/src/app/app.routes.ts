import { Routes } from '@angular/router';
import { MainLayout } from './layout/main-layout/main-layout';
import { Welcome } from './pages/welcome/welcome';

export const routes: Routes = [
  {
    path: '',
    component: Welcome,
  },
  
  {
    path: 'painel',
    component: MainLayout,
    children: [
    ]
  }
];