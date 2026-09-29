import { registerLocaleData } from '@angular/common';
import localeEsCl from '@angular/common/locales/es-CL';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DashboardComponent } from './dashboard';

describe('Monthly dashboard', () => {
  const account = { id: 1, bank: 'Banco', accountType: 'Vista', balance: 50000 };
  let http: HttpTestingController;
  beforeEach(() => {
    registerLocaleData(localeEsCl);
    TestBed.configureTestingModule({ imports: [DashboardComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('keeps manual balances outside the bank total and starts at the latest statement month', async () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    await fixture.whenStable();
    http.expectOne('http://localhost:3000/accounts').flush([account, { ...account, id: 2, bank: 'Falabella', source: 'BANK_STATEMENT', balance: 47296, balanceAsOf: '2026-08-31T00:00:00Z' }]);
    http.expectOne('http://localhost:3000/transactions').flush([]);
    await fixture.whenStable();
    expect(fixture.componentInstance.selectedMonth()).toBe('2026-08');
    expect(fixture.componentInstance.totalBalance()).toBe(47296);
    expect(fixture.nativeElement.textContent).toContain('31/08/2026');
    fixture.componentInstance.showManual.set(true);
    expect(fixture.componentInstance.totalBalance()).toBe(50000);
  });
  it('uses calendar months, groups only expenses and shows the latest five sorted by date and id', async () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    await fixture.whenStable();
    http.expectOne('http://localhost:3000/accounts').flush([account]);
    const row = { accountId: 1, account, description: 'Movimiento', category: 'Comida', createdAt: '2026-09-29T12:00:00Z' };
    http.expectOne('http://localhost:3000/transactions').flush([
      { ...row, id: 1, type: 'INCOME', amount: 100000, date: '2026-09-01T00:00:00Z' },
      ...[2, 3, 4, 5, 6, 7].map(id => ({ ...row, id, type: 'EXPENSE', amount: 1000, date: '2026-09-30T00:00:00Z', category: id === 7 ? 'Transporte' : 'Comida' })),
      { ...row, id: 8, type: 'EXPENSE', amount: 9000, date: '2026-10-01T00:00:00Z' },
    ]);
    fixture.componentInstance.changeMonth('2026-09');
    await fixture.whenStable();
    const component = fixture.componentInstance;
    expect(component.monthlyIncome()).toBe(100000);
    expect(component.monthlyExpenses()).toBe(6000);
    expect(component.monthlyBalance()).toBe(94000);
    expect(component.expensesByCategory().map(item => [item.category, item.amount])).toEqual([['Comida', 5000], ['Transporte', 1000]]);
    expect(component.recentTransactions().map(item => item.id)).toEqual([7, 6, 5, 4, 3]);
    expect(fixture.nativeElement.querySelectorAll('.recent-list li')).toHaveLength(5);
    component.changeMonth('2026-10');
    await fixture.whenStable();
    expect(component.monthlyBalance()).toBe(-9000);
    expect(component.totalBalance()).toBe(50000);
    component.changeMonth('2026-11');
    await fixture.whenStable();
    expect(component.monthlyBalance()).toBe(0);
    expect(component.expensesByCategory()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('No hay movimientos importados o registrados');
  });
  it('offers a retry when one of the requests fails', async () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    await fixture.whenStable();
    http.expectOne('http://localhost:3000/accounts').flush([]);
    http.expectOne('http://localhost:3000/transactions').flush({}, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Reintentar');
    expect(fixture.nativeElement.querySelector('.summary')).toBeNull();
  });
});
