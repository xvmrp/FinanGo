import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Account } from '../../models/account.model';
import { Transaction } from '../../models/transaction.model';
import { AccountService } from '../../services/account.service';
import { TransactionService } from '../../services/transaction.service';

@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit {
  private accountService = inject(AccountService);
  private transactionService = inject(TransactionService);
  accounts = signal<Account[]>([]);
  showManual = signal(false);
  hasBankAccounts = computed(() => this.accounts().some(account => account.source === 'BANK_STATEMENT'));
  visibleAccounts = computed(() => this.accounts().filter(account => !this.hasBankAccounts() || (this.showManual() ? account.source !== 'BANK_STATEMENT' : account.source === 'BANK_STATEMENT')));
  transactions = signal<Transaction[]>([]);
  loading = signal(true);
  error = signal('');
  private now = new Date();
  selectedMonth = signal(`${this.now.getFullYear()}-${String(this.now.getMonth() + 1).padStart(2, '0')}`);
  totalBalance = computed(() => this.visibleAccounts().reduce((total, account) => total + account.balance, 0));
  monthlyTransactions = computed(() => this.transactions()
    .filter(item => item.date.slice(0, 7) === this.selectedMonth() && this.visibleAccounts().some(account => account.id === item.accountId))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id));
  monthlyIncome = computed(() => this.monthlyTransactions().filter(item => item.type === 'INCOME').reduce((sum, item) => sum + item.amount, 0));
  monthlyExpenses = computed(() => this.monthlyTransactions().filter(item => item.type === 'EXPENSE').reduce((sum, item) => sum + item.amount, 0));
  monthlyBalance = computed(() => this.monthlyIncome() - this.monthlyExpenses());
  recentTransactions = computed(() => this.monthlyTransactions().slice(0, 5));
  expensesByCategory = computed(() => {
    const groups = new Map<string, number>();
    for (const item of this.monthlyTransactions()) {
      if (item.type === 'EXPENSE') groups.set(item.category, (groups.get(item.category) ?? 0) + item.amount);
    }
    const total = this.monthlyExpenses();
    return [...groups.entries()].map(([category, amount]) => ({ category, amount, percent: total ? amount / total * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));
  });

  ngOnInit(): void { this.loadAccounts(); }
  changeMonth(value: string): void {
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) this.selectedMonth.set(value);
  }
  loadAccounts(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({ accounts: this.accountService.getAccounts(), transactions: this.transactionService.getTransactions() }).subscribe({
      next: result => {
        this.accounts.set(result.accounts); this.transactions.set(result.transactions);
        const latest = result.accounts.filter(account => account.source === 'BANK_STATEMENT' && account.balanceAsOf).map(account => account.balanceAsOf!.slice(0, 7)).sort().at(-1);
        if (latest) this.selectedMonth.set(latest);
        this.loading.set(false);
      },
      error: () => { this.error.set('No se pudo cargar el resumen.'); this.loading.set(false); }
    });
  }
}
