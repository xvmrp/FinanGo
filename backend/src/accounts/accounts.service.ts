import { Injectable } from '@nestjs/common';

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
    return this.prisma.account.create({
      data: {
        bank: createAccountDto.bank,
        accountType: createAccountDto.accountType,
        balance: createAccountDto.balance,
      },
    });
  }
}
