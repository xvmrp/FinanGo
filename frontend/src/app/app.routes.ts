import { Routes } from '@angular/router';

import { DashboardComponent } from './pages/dashboard/dashboard';
import { AccountsComponent } from './pages/accounts/accounts';
import { TransactionsComponent } from './pages/transactions/transactions';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    component: DashboardComponent
  },
  {
    path: 'accounts',
    component: AccountsComponent
  },
  {
    path: 'transactions',
    component: TransactionsComponent
  }
];
