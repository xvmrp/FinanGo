import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface CreateTransactionDto {
  accountId: number;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  date: string;
  description: string;
  category: string;
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.transaction.findMany({
      include: { account: true },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    });
  }

  async create(body: CreateTransactionDto) {
    const date = this.validate(body);
    return this.prisma.$transaction(async tx => {
      // Conditional arithmetic locks the row and prevents concurrent expenses from overdrawing it.
      const changed = await tx.account.updateMany({
        where: {
          id: body.accountId,
          source: 'MANUAL',
          balance: body.type === 'EXPENSE' ? { gte: body.amount } : { lte: 2147483647 - body.amount },
        },
        data: { balance: { increment: body.type === 'INCOME' ? body.amount : -body.amount } },
      });
      if (changed.count === 0) {
        const account = await tx.account.findUnique({ where: { id: body.accountId } });
        if (!account) throw new NotFoundException('La cuenta seleccionada no existe.');
        if (account.source !== 'MANUAL') throw new BadRequestException('Esta cuenta se actualiza importando cartolas.');
        throw new BadRequestException(body.type === 'EXPENSE'
          ? 'Saldo insuficiente en la cuenta seleccionada.'
          : 'El saldo resultante supera el máximo permitido.');
      }
      // A failed insert rolls back the balance update as part of this same transaction.
      return tx.transaction.create({
        data: {
          accountId: body.accountId, type: body.type, amount: body.amount, date,
          description: body.description.trim(), category: body.category.trim(),
        },
        include: { account: true },
      });
    });
  }

  private validate(body: CreateTransactionDto): Date {
    if (!body || !Number.isInteger(body.accountId) || body.accountId <= 0 || body.accountId > 2147483647 ||
        !['INCOME', 'EXPENSE'].includes(body.type) ||
        !Number.isInteger(body.amount) || body.amount <= 0 || body.amount > 2147483647 ||
        typeof body.description !== 'string' || !body.description.trim() || body.description.trim().length > 200 ||
        typeof body.category !== 'string' || !body.category.trim() || body.category.trim().length > 60 ||
        typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      throw new BadRequestException('Revisa la cuenta, el tipo, el monto, la fecha, la descripción y la categoría.');
    }
    const date = new Date(`${body.date}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== body.date || body.date < '1900-01-01') {
      throw new BadRequestException('Ingresa una fecha válida a partir de 1900.');
    }
    return date;
  }

  update(id: number, body: CreateTransactionDto) {
    const date = this.validate(body);
    return this.change(id, { ...body, date });
  }

  remove(id: number) { return this.change(id); }

  private async change(id: number, replacement?: Omit<CreateTransactionDto, 'date'> & { date: Date }) {
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) throw new BadRequestException('Identificador de movimiento inválido.');
    return this.prisma.$transaction(async tx => {
      // Serialize edits/deletions of this movement before reading its original effect.
      const locked = await tx.$queryRaw<Array<{ id: number }>>`SELECT "id" FROM "Transaction" WHERE "id" = ${id} FOR UPDATE`;
      if (!locked.length) throw new NotFoundException('El movimiento ya no existe. Recarga el historial.');
      const original = await tx.transaction.findUniqueOrThrow({ where: { id } });
      if (original.statementId !== null) throw new BadRequestException('Los movimientos bancarios originales no se pueden editar ni eliminar.');
      const originalEffect = original.type === 'INCOME' ? original.amount : -original.amount;
      const deltas = new Map<number, number>([[original.accountId, -originalEffect]]);
      if (replacement) {
        const effect = replacement.type === 'INCOME' ? replacement.amount : -replacement.amount;
        deltas.set(replacement.accountId, (deltas.get(replacement.accountId) ?? 0) + effect);
      }
      // Apply net differences, not intermediate reversals. Lock accounts in a stable order.
      const accountIds = [...deltas.keys()].sort((a, b) => a - b);
      for (const accountId of accountIds) {
        const delta = deltas.get(accountId)!;
        if (Math.abs(delta) > 2147483647) throw new BadRequestException('El saldo resultante queda fuera del rango permitido.');
        const updated = await tx.account.updateMany({
          where: { id: accountId, source: 'MANUAL', balance: delta < 0 ? { gte: -delta } : { lte: 2147483647 - delta } },
          data: { balance: { increment: delta } },
        });
        if (!updated.count) {
          const account = await tx.account.findUnique({ where: { id: accountId } });
          if (!account) throw new NotFoundException('La cuenta seleccionada no existe.');
          if (account.source !== 'MANUAL') throw new BadRequestException('No se pueden mover registros manuales a una cuenta de cartolas.');
          throw new BadRequestException(delta < 0
            ? `Saldo insuficiente en ${account.bank} para corregir este movimiento. No se realizó ningún cambio.`
            : 'El saldo resultante supera el máximo permitido. No se realizó ningún cambio.');
        }
      }
      const transaction = replacement
        ? await tx.transaction.update({ where: { id }, data: { ...replacement, description: replacement.description.trim(), category: replacement.category.trim() }, include: { account: true } })
        : await tx.transaction.delete({ where: { id } });
      const accounts = await tx.account.findMany({ where: { id: { in: accountIds } }, orderBy: { id: 'asc' } });
      return { transaction, accounts };
    });
  }
}
