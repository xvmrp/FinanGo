import { Injectable } from '@nestjs/common';
import { CreateAccountDto } from './dto/create-account.dto.js';

@Injectable()
export class AccountsService {

  private accounts = [
    {
      id: 1,
      bank: 'BancoEstado',
      accountType: 'Cuenta RUT',
      balance: 650000
    },
    {
      id: 2,
      bank: 'Banco de Chile',
      accountType: 'Cuenta Corriente',
      balance: 500000
    },
    {
      id: 3,
      bank: 'Banco Falabella',
      accountType: 'Cuenta Corriente',
      balance: 300000
    }
  ];

  findAll() {
    return this.accounts;
  }

  create(createAccountDto: CreateAccountDto) {

    const newAccount = {
      id: this.accounts.length + 1,
      ...createAccountDto
    };

    this.accounts.push(newAccount);

    return newAccount;
  }
}