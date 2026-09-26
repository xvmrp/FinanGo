import { CurrencyPipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';

import { Account } from '../../models/account.model';
import { AccountService } from '../../services/account.service';

@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit {

  private accountService = inject(AccountService);

  accounts: Account[] = [];

  ngOnInit(): void {
    this.accountService.getAccounts().subscribe({
      next: (accounts) => {
        console.log('ANTES:', this.accounts);

        this.accounts = accounts;

        console.log('RECIBIDAS:', accounts);
        console.log('DESPUÉS:', this.accounts);
      },

      error: (error) => {
        console.error('ERROR:', error);
      }
    });
  }

  get totalBalance(): number {
    return this.accounts.reduce(
      (total, account) => total + account.balance,
      0
    );
  }
}
