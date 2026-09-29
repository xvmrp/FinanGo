import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { TransactionsService } from './transactions.service.js';
import type { CreateTransactionDto } from './transactions.service.js';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  findAll() { return this.transactions.findAll(); }

  @Post()
  create(@Body() body: CreateTransactionDto) { return this.transactions.create(body); }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: CreateTransactionDto) {
    return this.transactions.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) { return this.transactions.remove(id); }
}
