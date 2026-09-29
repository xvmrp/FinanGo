import { registerLocaleData } from '@angular/common';
import localeEsCl from '@angular/common/locales/es-CL';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { AccountsComponent } from './pages/accounts/accounts';

describe('Accounts navigation and editing', () => {
  const url = 'http://localhost:3000/accounts';
  const original = { id: 1, bank: 'Banco de prueba', accountType: 'Cuenta Vista', balance: 223 };
  let http: HttpTestingController;
  beforeEach(() => {
    registerLocaleData(localeEsCl);
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('renders asynchronous responses without another click, edits and refreshes totals on navigation', async () => {
    const harness = await RouterTestingHarness.create('/accounts');
    http.expectOne(url).flush([original]);
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Banco de prueba');
    const component = harness.routeDebugElement!.componentInstance as AccountsComponent;
    component.editAccount(original);
    component.accountForm.controls.balance.setValue('223,000');
    component.saveAccount();
    const request = http.expectOne(`${url}/1`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.balance).toBe(223000);
    const updated = { ...original, balance: 223000 };
    request.flush(updated);
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('223.000');
    await harness.navigateByUrl('/transactions');
    http.expectOne(url).flush([updated]);
    http.expectOne('http://localhost:3000/transactions').flush([]);
    await harness.navigateByUrl('/dashboard');
    http.expectOne(url).flush([updated, { ...original, id: 2, balance: 1000 }]);
    http.expectOne('http://localhost:3000/transactions').flush([]);
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelector('.balance-card h2')?.textContent).toContain('224.000');
    await harness.navigateByUrl('/accounts');
    http.expectOne(url).flush([updated]);
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('223.000');
  });

  it('retains edits on save failure and allows cancellation without a write', async () => {
    const harness = await RouterTestingHarness.create('/accounts');
    http.expectOne(url).flush([original]);
    const component = harness.routeDebugElement!.componentInstance as AccountsComponent;
    component.editAccount(original);
    component.accountForm.controls.balance.setValue('500.000');
    component.saveAccount();
    http.expectOne(`${url}/1`).flush({}, { status: 500, statusText: 'Error' });
    await harness.fixture.whenStable();
    expect(component.accountForm.controls.balance.value).toBe('500.000');
    expect(component.accounts()[0].balance).toBe(223);
    expect(harness.routeNativeElement?.querySelector('[role="alert"]')?.textContent).toContain('No se pudo guardar');
    component.cancelEdit();
    expect(component.editingId()).toBeNull();
  });
});
