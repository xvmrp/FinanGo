import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, map } from 'rxjs';
import { Account } from '../../models/account.model';
import { parseClpAmount } from '../../models/clp-amount';
import { Transaction, TransactionType } from '../../models/transaction.model';
import { AccountService } from '../../services/account.service';
import { TransactionService } from '../../services/transaction.service';

function today(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function validDate(control: AbstractControl) {
  const text = String(control.value);
  const date = new Date(`${text}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) && text >= '1900-01-01' && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text ? null : { date: true };
}

@Component({
  selector: 'app-transactions',
  imports: [ReactiveFormsModule, CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './transactions.html',
  styleUrl: './transactions.scss'
})
export class TransactionsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private accountService = inject(AccountService);
  private transactionService = inject(TransactionService);
  accounts = signal<Account[]>([]);
  manualAccounts = computed(() => this.accounts().filter(account => account.source !== 'BANK_STATEMENT'));
  transactions = signal<Transaction[]>([]);
  loading = signal(true);
  saving = signal(false);
  loadError = signal('');
  saveError = signal('');
  notice = signal('');
  editingId = signal<number | null>(null);
  pendingDelete = signal<Transaction | null>(null);
  deleteError = signal('');
  filter = signal({ accountId: '', type: '', from: '', to: '' });
  categories = ['Sueldo', 'Comida', 'Transporte', 'Vivienda', 'Servicios', 'Salud', 'Educación', 'Entretenimiento', 'Otros'];
  form = this.fb.nonNullable.group({
    accountId: ['', Validators.required],
    type: ['EXPENSE' as TransactionType, Validators.required],
    amount: ['', (control: AbstractControl) => (parseClpAmount(String(control.value)) ?? 0) > 0 ? null : { amount: true }],
    date: [today(), validDate],
    description: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)]],
    category: ['', Validators.required],
  });
  filterForm = this.fb.nonNullable.group({ accountId: '', type: '', from: '', to: '' });
  invalidRange = computed(() => !!this.filter().from && !!this.filter().to && this.filter().from > this.filter().to);
  filteredTransactions = computed(() => {
    const filter = this.filter();
    if (this.invalidRange()) return [];
    return this.transactions().filter(item =>
      (filter.accountId || !this.accounts().some(account => account.source === 'BANK_STATEMENT') || !!item.statementId) &&
      (!filter.accountId || item.accountId === Number(filter.accountId)) &&
      (!filter.type || item.type === filter.type) &&
      (!filter.from || item.date.slice(0, 10) >= filter.from) &&
      (!filter.to || item.date.slice(0, 10) <= filter.to)
    );
  });
  income = computed(() => this.filteredTransactions().filter(item => item.type === 'INCOME').reduce((sum, item) => sum + item.amount, 0));
  expenses = computed(() => this.filteredTransactions().filter(item => item.type === 'EXPENSE').reduce((sum, item) => sum + item.amount, 0));

  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    forkJoin({ accounts: this.accountService.getAccounts(), transactions: this.transactionService.getTransactions() }).subscribe({
      next: result => { this.accounts.set(result.accounts); this.transactions.set(result.transactions); this.loading.set(false); },
      error: () => { this.loadError.set('No se pudieron cargar las cuentas y los movimientos.'); this.loading.set(false); },
    });
  }
  applyFilters(): void { this.filter.set(this.filterForm.getRawValue()); }
  clearFilters(): void { this.filterForm.reset(); this.applyFilters(); }

  edit(item: Transaction): void {
    if (this.saving()) return;
    this.editingId.set(item.id);
    this.pendingDelete.set(null);
    this.saveError.set('');
    this.notice.set('');
    this.form.setValue({ accountId: String(item.accountId), type: item.type, amount: item.amount.toLocaleString('es-CL'), date: item.date.slice(0, 10), description: item.description, category: item.category });
  }

  cancelEdit(): void {
    if (this.saving()) return;
    this.editingId.set(null);
    this.saveError.set('');
    this.form.reset({ accountId: '', type: 'EXPENSE', amount: '', date: today(), description: '', category: '' });
  }

  requestDelete(item: Transaction): void {
    if (this.saving()) return;
    this.pendingDelete.set(item);
    this.deleteError.set('');
    this.notice.set('');
  }

  confirmDelete(): void {
    const item = this.pendingDelete();
    if (!item || this.saving()) return;
    this.saving.set(true);
    this.form.disable();
    this.deleteError.set('');
    this.transactionService.deleteTransaction(item.id).subscribe({
      next: result => {
        this.transactions.update(items => items.filter(entry => entry.id !== item.id));
        this.updateAccounts(result.accounts);
        this.form.enable();
        this.saving.set(false);
        if (this.editingId() === item.id) this.cancelEdit();
        this.pendingDelete.set(null);
        this.notice.set('Movimiento eliminado y saldo corregido.');
      },
      error: (error: HttpErrorResponse) => {
        this.form.enable();
        this.saving.set(false);
        this.deleteError.set(typeof error.error?.message === 'string' ? error.error.message : 'No se pudo confirmar la eliminación. Recarga el historial para comprobar el resultado.');
      },
    });
  }

  private updateAccounts(updated: Account[]): void {
    this.accounts.update(items => items.map(account => updated.find(item => item.id === account.id) ?? account));
  }

  save(): void {
    if (this.form.invalid || this.saving() || this.loading() || this.loadError()) return;
    const value = this.form.getRawValue();
    const amount = parseClpAmount(value.amount);
    if (amount === null || amount <= 0) return;
    this.saving.set(true);
    this.saveError.set('');
    this.notice.set('');
    this.form.disable();
    const body = { ...value, accountId: Number(value.accountId), amount, description: value.description.trim() };
    const id = this.editingId();
    const request = id === null
      ? this.transactionService.createTransaction(body).pipe(map(transaction => ({ transaction, accounts: [transaction.account] })))
      : this.transactionService.updateTransaction(id, body);
    request.subscribe({
      next: ({ transaction, accounts }) => {
        this.transactions.update(items => [transaction, ...items.filter(item => item.id !== transaction.id)].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id));
        this.updateAccounts(accounts);
        this.form.enable();
        this.form.reset({ accountId: value.accountId, type: value.type, amount: '', date: today(), description: '', category: '' });
        this.saving.set(false);
        this.editingId.set(null);
        this.pendingDelete.set(null);
        this.clearFilters();
        this.notice.set(id === null ? 'Movimiento registrado y saldo actualizado.' : 'Movimiento actualizado y saldos corregidos.');
      },
      error: (error: HttpErrorResponse) => {
        this.form.enable();
        this.saving.set(false);
        this.saveError.set(typeof error.error?.message === 'string' ? error.error.message : 'No se pudo confirmar el registro. Recarga el historial antes de reintentar para comprobar si se guardó.');
      },
    });
  }
}
