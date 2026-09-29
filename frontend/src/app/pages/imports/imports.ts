import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
interface Preview { last4: string; period: string; closingBalance: number; count: number; alreadyImported: boolean; rows: { date: string; description: string; type: string; amount: number; balanceAfter: number }[] }
interface Imported { period: string; filename: string; closingBalance: number; importedAt: string; account: { last4: string }; _count: { transactions: number } }
@Component({ selector: 'app-imports', imports: [CurrencyPipe, DatePipe, RouterLink], templateUrl: './imports.html', styleUrl: './imports.scss' })
export class ImportsComponent implements OnInit {
  private http = inject(HttpClient);
  private url = 'http://localhost:3000/imports/falabella';
  files: File[] = [];
  previews = signal<{ file: File; data: Preview }[]>([]);
  history = signal<Imported[]>([]);
  busy = signal(false);
  error = signal('');
  notice = signal('');
  async ngOnInit() { await this.load(); }
  private async load() {
    try { this.history.set(await firstValueFrom(this.http.get<Imported[]>(this.url))); }
    catch { this.error.set('No se pudo consultar el historial de importaciones.'); }
  }
  async select(event: Event) {
    this.files = Array.from((event.target as HTMLInputElement).files ?? []);
    this.previews.set([]); this.error.set(''); this.notice.set('');
    if (!this.files.length) return;
    this.busy.set(true);
    try {
      const previews = [];
      for (const file of this.files) {
        if (file.size > 10 * 1024 * 1024) throw new Error('Cada PDF debe pesar hasta 10 MB.');
        const body = new FormData(); body.append('file', file);
        const data = await firstValueFrom(this.http.post<Preview>(`${this.url}/preview`, body));
        previews.push({ file, data });
      }
      this.previews.set(previews);
    } catch (error) { this.error.set(this.message(error)); }
    finally { this.busy.set(false); }
  }
  async confirm() {
    if (this.busy() || !this.previews().length) return;
    this.busy.set(true); this.error.set('');
    let count = 0;
    try {
      for (const item of this.previews()) {
        const body = new FormData(); body.append('file', item.file);
        const result = await firstValueFrom(this.http.post<{ count: number }>(`${this.url}/confirm`, body));
        count += result.count;
      }
      this.notice.set(`${count} movimientos nuevos importados. Los archivos repetidos no se duplicaron.`);
      this.previews.set([]);
    } catch (error) { this.error.set(`${count} movimientos nuevos guardados antes de detenerse. ${this.message(error)} Puedes reintentar sin duplicar las cartolas ya guardadas.`); }
    finally { await this.load(); this.busy.set(false); }
  }
  private message(error: unknown) {
    return error instanceof HttpErrorResponse && typeof error.error?.message === 'string' ? error.error.message : error instanceof Error ? error.message : 'No se pudo procesar el PDF.';
  }
}
