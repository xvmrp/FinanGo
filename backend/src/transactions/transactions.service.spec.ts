import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TransactionsService, type CreateTransactionDto } from './transactions.service.js';

describe('TransactionsService', () => {
  const tx = { account: { updateMany: vi.fn(), findUnique: vi.fn() }, transaction: { create: vi.fn() } };
  const atomic = vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx));
  const service = new TransactionsService({ $transaction: atomic } as unknown as PrismaService);
  const body: CreateTransactionDto = { accountId: 1, type: 'EXPENSE', amount: 15000, date: '2026-09-29', description: 'Supermercado', category: 'Comida' };
  beforeEach(() => { vi.clearAllMocks(); tx.account.updateMany.mockResolvedValue({ count: 1 }); tx.transaction.create.mockResolvedValue({ id: 1, source: 'MANUAL' }); });

  it('deducts expenses conditionally within the same transaction as the history insert', async () => {
    await service.create(body);
    expect(atomic).toHaveBeenCalledOnce();
    expect(tx.account.updateMany).toHaveBeenCalledWith({ where: { id: 1, source: 'MANUAL', balance: { gte: 15000 } }, data: { balance: { increment: -15000 } } });
    expect(tx.transaction.create.mock.calls[0][0].data.date.toISOString()).toBe('2026-09-29T00:00:00.000Z');
  });
  it('adds income with an integer overflow guard', async () => {
    await service.create({ ...body, type: 'INCOME' });
    expect(tx.account.updateMany).toHaveBeenCalledWith({ where: { id: 1, source: 'MANUAL', balance: { lte: 2147483647 - 15000 } }, data: { balance: { increment: 15000 } } });
  });
  it('does not insert a movement when funds are insufficient or account is missing', async () => {
    tx.account.updateMany.mockResolvedValue({ count: 0 });
    tx.account.findUnique.mockResolvedValue({ id: 1, source: 'MANUAL' });
    await expect(service.create(body)).rejects.toThrow(BadRequestException);
    tx.account.findUnique.mockResolvedValue(null);
    await expect(service.create(body)).rejects.toThrow(NotFoundException);
    expect(tx.transaction.create).not.toHaveBeenCalled();
  });
  it('rejects invalid inputs before accessing the database', async () => {
    for (const patch of [{ amount: 0 }, { amount: -1 }, { amount: 1.5 }, { amount: 2147483648 }, { date: '2026-02-30' }, { date: 'invalid' }, { description: ' ' }, { accountId: 0 }, { category: '' }, { type: 'INVALID' }]) {
      await expect(service.create({ ...body, ...patch } as CreateTransactionDto)).rejects.toThrow(BadRequestException);
    }
    expect(atomic).not.toHaveBeenCalled();
  });
});
