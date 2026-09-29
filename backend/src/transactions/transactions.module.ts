import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TransactionsController } from './transactions.controller.js';
import { TransactionsService } from './transactions.service.js';

@Module({ imports: [PrismaModule], controllers: [TransactionsController], providers: [TransactionsService] })
export class TransactionsModule {}
