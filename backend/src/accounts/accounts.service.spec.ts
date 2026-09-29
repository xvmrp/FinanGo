import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AccountsService } from './accounts.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('Account updates', () => {
  const data = { bank: 'Banco', accountType: 'Cuenta Vista', balance: 223000 };
  const update = vi.fn();
  const create = vi.fn();
  const service = new AccountsService({ account: { update, create } } as unknown as PrismaService);
  beforeEach(() => vi.resetAllMocks());

  it('persists the complete amount on the selected account', async () => {
    update.mockResolvedValue({ id: 7, ...data });
    expect(await service.update(7, data)).toEqual({ id: 7, ...data });
    expect(update).toHaveBeenCalledWith({ where: { id: 7, source: 'MANUAL' }, data });
  });
  it('rejects invalid amounts on both create and edit before writing', async () => {
    for (const balance of [-1, 1.5, NaN, 2147483648, '223,000']) {
      const invalid = { ...data, balance } as typeof data;
      expect(() => service.create(invalid)).toThrow(BadRequestException);
      await expect(service.update(7, invalid)).rejects.toThrow(BadRequestException);
    }
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
  it('reports missing accounts as not found', async () => {
    update.mockRejectedValue({ code: 'P2025' });
    await expect(service.update(999, data)).rejects.toThrow(NotFoundException);
  });
});
