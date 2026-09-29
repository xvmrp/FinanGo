import { registerLocaleData } from '@angular/common';
import localeEsCl from '@angular/common/locales/es-CL';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TransactionsComponent } from './transactions';

describe('Movimientos', () => {
  const account = { id: 1, bank: 'Banco prueba', accountType: 'Cuenta Vista', balance: 223000 };
  const movement = { id: 1, accountId: 1, account, type: 'EXPENSE', amount: 15000, date: '2026-09-29T00:00:00.000Z', description: 'Supermercado', category: 'Comida', createdAt: '2026-09-29T15:00:00Z' };
  const url = 'http://localhost:3000/transactions';
  let http: HttpTestingController;
  beforeEach(() => {
    registerLocaleData(localeEsCl);
    TestBed.configureTestingModule({ imports: [TransactionsComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  async function setup(accounts = [account], movements = [movement]) {
    const fixture = TestBed.createComponent(TransactionsComponent);
    await fixture.whenStable();
    http.expectOne('http://localhost:3000/accounts').flush(accounts);
    http.expectOne(url).flush(movements);
    await fixture.whenStable();
    return fixture;
  }
  it('renders the history without an extra click and filters by inclusive dates, type and account', async () => {
    const fixture = await setup();
    expect(fixture.nativeElement.textContent).toContain('Supermercado');
    expect(fixture.nativeElement.textContent).toContain('29/09/2026');
    const component = fixture.componentInstance;
    component.filterForm.setValue({ accountId: '1', type: 'EXPENSE', from: '2026-09-29', to: '2026-09-29' });
    component.applyFilters();
    expect(component.expenses()).toBe(15000);
    component.filterForm.controls.type.setValue('INCOME');
    component.applyFilters();
    expect(component.filteredTransactions()).toHaveLength(0);
    component.clearFilters();
    expect(component.filteredTransactions()).toHaveLength(1);
    component.filterForm.patchValue({ from: '2026-09-30', to: '2026-09-29' });
    component.applyFilters();
    expect(component.invalidRange()).toBe(true);
  });
  it('sends whole pesos, prevents duplicate submits and updates the displayed balance after saving', async () => {
    const fixture = await setup([account], []);
    const component = fixture.componentInstance;
    component.form.setValue({ accountId: '1', type: 'EXPENSE', amount: '15,000', date: '2026-09-29', description: 'Supermercado', category: 'Comida' });
    component.save();
    component.save();
    const request = http.expectOne(url);
    expect(request.request.method).toBe('POST');
    expect(request.request.body.amount).toBe(15000);
    request.flush({ ...movement, account: { ...account, balance: 208000 } });
    await fixture.whenStable();
    expect(component.accounts()[0].balance).toBe(208000);
    expect(component.transactions()).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('208.000');
    expect(fixture.nativeElement.textContent).toContain('Movimiento registrado');
  });
  it('keeps form and balances unchanged on insufficient funds', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    component.form.setValue({ accountId: '1', type: 'EXPENSE', amount: '300.000', date: '2026-09-29', description: 'Compra', category: 'Otros' });
    component.save();
    http.expectOne(url).flush({ message: 'Saldo insuficiente en la cuenta seleccionada.' }, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();
    expect(component.form.controls.amount.value).toBe('300.000');
    expect(component.accounts()[0].balance).toBe(223000);
    expect(fixture.nativeElement.textContent).toContain('Saldo insuficiente');
  });
  it('guides the user to create an account when none exist', async () => {
    const fixture = await setup([], []);
    expect(fixture.nativeElement.textContent).toContain('Agrega tu primera cuenta');
    expect(fixture.nativeElement.querySelector('.entry-form')).toBeNull();
  });

  it('edits an existing movement and refreshes both affected accounts without duplicating history', async () => {
    const other = { ...account, id: 2, balance: 100000 };
    const fixture = await setup([account, other]);
    const component = fixture.componentInstance;
    component.edit(component.transactions()[0]);
    expect(component.form.controls.date.value).toBe('2026-09-29');
    component.form.patchValue({ accountId: '2', amount: '20.000' });
    component.save();
    const request = http.expectOne(`${url}/1`);
    expect(request.request.method).toBe('PUT');
    request.flush({ transaction: { ...movement, amount: 20000, accountId: 2, account: { ...other, balance: 80000 } }, accounts: [{ ...account, balance: 238000 }, { ...other, balance: 80000 }] });
    await fixture.whenStable();
    expect(component.transactions()).toHaveLength(1);
    expect(component.accounts().map(item => item.balance)).toEqual([238000, 80000]);
    expect(component.editingId()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Movimiento actualizado');
  });

  it('requires confirmation to delete, restores the balance and preserves history on a failure', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    component.requestDelete(component.transactions()[0]);
    http.expectNone(`${url}/1`);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Confirmar eliminación');
    component.confirmDelete();
    http.expectOne(`${url}/1`).flush({ message: 'No se pudo eliminar.' }, { status: 400, statusText: 'Bad Request' });
    expect(component.transactions()).toHaveLength(1);
    expect(component.accounts()[0].balance).toBe(223000);
    component.confirmDelete();
    const request = http.expectOne(`${url}/1`);
    expect(request.request.method).toBe('DELETE');
    request.flush({ transaction: { id: 1 }, accounts: [{ ...account, balance: 238000 }] });
    await fixture.whenStable();
    expect(component.transactions()).toHaveLength(0);
    expect(component.accounts()[0].balance).toBe(238000);
    expect(component.pendingDelete()).toBeNull();
  });
});
