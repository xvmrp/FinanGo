import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AccountsModule } from './accounts/accounts.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';
import { ImportsModule } from './imports/imports.module.js';

@Module({
  imports: [AccountsModule, PrismaModule, TransactionsModule, ImportsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
