import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Account } from '../models/account.model';

@Injectable({
  providedIn: 'root'
})
export class AccountService {

  private http = inject(HttpClient);

  private apiUrl = 'http://localhost:3000/accounts';

  getAccounts(): Observable<Account[]> {
    return this.http.get<Account[]>(this.apiUrl);
  }

  createAccount(account: Omit<Account, 'id'>): Observable<Account> {
    return this.http.post<Account>(
      this.apiUrl,
      account
    );
  }
}
