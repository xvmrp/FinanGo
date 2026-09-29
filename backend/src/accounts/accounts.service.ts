import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAccountDto } from './dto/create-account.dto.js';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.account.findMany({
      orderBy: {
        id: 'asc',
      },
    });
  }

  create(createAccountDto: CreateAccountDto) {
    this.validate(createAccountDto);
    return this.prisma.account.create({
      data: {
        bank: createAccountDto.bank,
        accountType: createAccountDto.accountType,
        balance: createAccountDto.balance,
      },
    });
  }

  async update(id: number, account: CreateAccountDto) {
    this.validate(account);
    try {
      return await this.prisma.account.update({
        where: { id, source: 'MANUAL' },
        data: { bank: account.bank.trim(), accountType: account.accountType.trim(), balance: account.balance },
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
        throw new NotFoundException('La cuenta no existe');
      }
      throw error;
    }
  }

  private validate(account: CreateAccountDto) {
    if (!account || typeof account.bank !== 'string' || !account.bank.trim() ||
        typeof account.accountType !== 'string' || !account.accountType.trim() ||
        !Number.isInteger(account.balance) || account.balance < 0 || account.balance > 2147483647) {
      throw new BadRequestException('Ingresa un banco, un tipo de cuenta y un saldo válido en pesos enteros.');
    }
  }
}
