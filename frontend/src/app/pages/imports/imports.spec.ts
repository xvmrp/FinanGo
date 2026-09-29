import { registerLocaleData } from '@angular/common';
import localeEsCl from '@angular/common/locales/es-CL';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ImportsComponent } from './imports';

describe('Statement preview and import', () => {
  it('previews before committing and sends the original PDF on confirmation', async () => {
    registerLocaleData(localeEsCl);
    TestBed.configureTestingModule({ imports: [ImportsComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ImportsComponent);
    await fixture.whenStable();
    const url = 'http://localhost:3000/imports/falabella';
    http.expectOne(url).flush([]);
    const file = new File(['%PDF-test'], 'cartola.pdf', { type: 'application/pdf' });
    const pending = fixture.componentInstance.select({ target: { files: [file] } } as unknown as Event);
    http.expectOne(`${url}/preview`).flush({ last4: '0001', period: '2026-08', closingBalance: 47296, count: 34, alreadyImported: false, rows: [] });
    await pending;
    http.expectNone(`${url}/confirm`);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('47.296');
    const saving = fixture.componentInstance.confirm();
    const request = http.expectOne(`${url}/confirm`);
    expect(request.request.body.get('file').name).toBe('cartola.pdf');
    request.flush({ count: 34 });
    await Promise.resolve();
    await Promise.resolve();
    http.expectOne(url).flush([]);
    await saving;
    expect(fixture.componentInstance.notice()).toContain('34 movimientos nuevos');
    http.verify();
  });
});
