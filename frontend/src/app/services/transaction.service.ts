import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CreateTransaction, Transaction } from '../models/transaction.model';
import { Account } from '../models/account.model';

@Injectable({ providedIn: 'root' })
export class TransactionService {
  private http = inject(HttpClient);
  private url = 'http://localhost:3000/transactions';
  getTransactions() { return this.http.get<Transaction[]>(this.url); }
  createTransaction(body: CreateTransaction) { return this.http.post<Transaction>(this.url, body); }
  updateTransaction(id: number, body: CreateTransaction) {
    return this.http.put<{ transaction: Transaction; accounts: Account[] }>(`${this.url}/${id}`, body);
  }
  deleteTransaction(id: number) {
    return this.http.delete<{ transaction: { id: number }; accounts: Account[] }>(`${this.url}/${id}`);
  }
}
