import { Body, Controller, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';

import { AccountsService } from './accounts.service.js';
import { CreateAccountDto } from './dto/create-account.dto.js';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  findAll() {
    return this.accountsService.findAll();
  }

  @Post()
  create(@Body() createAccountDto: CreateAccountDto) {
    return this.accountsService.create(createAccountDto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() account: CreateAccountDto) {
    return this.accountsService.update(id, account);
  }
}
