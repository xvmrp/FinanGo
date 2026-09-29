import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Account } from '../../models/account.model';
import { parseClpAmount } from '../../models/clp-amount';
import { AccountService } from '../../services/account.service';

@Component({
  selector: 'app-accounts',
  imports: [ReactiveFormsModule, CurrencyPipe, DatePipe],
  templateUrl: './accounts.html',
  styleUrl: './accounts.scss',
})
export class AccountsComponent implements OnInit {
  private accountService = inject(AccountService);
  private fb = inject(FormBuilder);
  accounts = signal<Account[]>([]);
  loading = signal(true);
  saving = signal(false);
  error = signal('');
  notice = signal('');
  editingId = signal<number | null>(null);
  isEditing = computed(() => this.editingId() !== null);

  accountForm = this.fb.nonNullable.group({
    bank: ['', [Validators.required, Validators.pattern(/\S/)]],
    accountType: ['', Validators.required],
    balance: ['0', (control: AbstractControl) => parseClpAmount(String(control.value)) === null ? { amount: true } : null],
  });

  ngOnInit(): void { this.loadAccounts(); }

  loadAccounts(): void {
    this.loading.set(true);
    this.error.set('');
    this.accountService.getAccounts().subscribe({
      next: accounts => { this.accounts.set(accounts); this.loading.set(false); },
      error: () => { this.error.set('No se pudieron cargar las cuentas. Intenta nuevamente.'); this.loading.set(false); },
    });
  }

  editAccount(account: Account): void {
    this.editingId.set(account.id);
    this.error.set('');
    this.notice.set('');
    this.accountForm.setValue({ bank: account.bank, accountType: account.accountType, balance: account.balance.toLocaleString('es-CL') });
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.accountForm.reset({ bank: '', accountType: '', balance: '0' });
  }

  saveAccount(): void {
    if (this.accountForm.invalid || this.saving()) return;
    const form = this.accountForm.getRawValue();
    const balance = parseClpAmount(form.balance);
    if (balance === null) return;
    const account = { bank: form.bank.trim(), accountType: form.accountType, balance };
    const id = this.editingId();
    this.saving.set(true);
    this.error.set('');
    this.notice.set('');
    this.accountForm.disable();
    const request = id === null ? this.accountService.createAccount(account) : this.accountService.updateAccount(id, account);
    request.subscribe({
      next: saved => {
        this.accounts.update(accounts => id === null ? [...accounts, saved] : accounts.map(item => item.id === id ? saved : item));
        this.accountForm.enable();
        this.saving.set(false);
        this.cancelEdit();
        this.notice.set(id === null ? 'Cuenta agregada.' : 'Cuenta actualizada.');
      },
      error: () => {
        this.accountForm.enable();
        this.saving.set(false);
        this.error.set('No se pudo guardar la cuenta. Tus cambios siguen en el formulario para reintentar.');
      },
    });
  }
}
