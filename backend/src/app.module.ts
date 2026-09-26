import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AccountsModule } from './accounts/accounts.module.js';

@Module({
  imports: [AccountsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}