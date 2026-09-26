import { CurrencyPipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Account } from '../../models/account.model';
import { AccountService } from '../../services/account.service';

@Component({
  selector: 'app-accounts',
  imports: [ReactiveFormsModule, CurrencyPipe],
  templateUrl: './accounts.html',
  styleUrl: './accounts.scss',
})
export class AccountsComponent implements OnInit {
  private accountService = inject(AccountService);
  private fb = inject(FormBuilder);

  accounts: Account[] = [];

  accountForm = this.fb.nonNullable.group({
    bank: ['', Validators.required],

    accountType: ['', Validators.required],

    balance: [0, [Validators.required, Validators.min(0)]],
  });

  ngOnInit(): void {
    this.loadAccounts();
  }

  loadAccounts(): void {
    this.accountService.getAccounts().subscribe({
      next: (accounts) => {
        this.accounts = accounts;
      },

      error: (error) => {
        console.error('Error al cargar las cuentas:', error);
      },
    });
  }

  addAccount(): void {
    if (this.accountForm.invalid) {
      return;
    }

    const newAccount = this.accountForm.getRawValue();

    this.accountService.createAccount(newAccount).subscribe({
      next: (account) => {
        this.accounts.push(account);

        this.accountForm.reset({
          bank: '',
          accountType: '',
          balance: 0,
        });
      },

      error: (error) => {
        console.error('Error al crear la cuenta:', error);
      },
    });
  }
}
