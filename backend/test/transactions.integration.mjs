// Run after building: node test/transactions.integration.mjs
// Uses one temporary account; existing user accounts are never modified.
import 'dotenv/config';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { PrismaService } from '../dist/prisma/prisma.service.js';
import { TransactionsService } from '../dist/transactions/transactions.service.js';

const prisma = new PrismaService();
const service = new TransactionsService(prisma);
let account;
let secondAccount;
try {
  account = await prisma.account.create({ data: { bank: 'Prueba automática de movimientos', accountType: 'Prueba temporal', balance: 223000 } });
  const data = { accountId: account.id, type: 'EXPENSE', amount: 15000, date: '2026-09-29', description: 'Prueba temporal', category: 'Otros' };
  await service.create(data);
  assert.equal((await prisma.account.findUniqueOrThrow({ where: { id: account.id } })).balance, 208000);
  await service.create({ ...data, type: 'INCOME', amount: 12000 });
  assert.equal((await prisma.account.findUniqueOrThrow({ where: { id: account.id } })).balance, 220000);

  const concurrent = await Promise.allSettled([service.create({ ...data, amount: 200000 }), service.create({ ...data, amount: 200000 })]);
  assert.equal(concurrent.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal((await prisma.account.findUniqueOrThrow({ where: { id: account.id } })).balance, 20000);
  assert.equal(await prisma.transaction.count({ where: { accountId: account.id } }), 3);

  const failingService = new TransactionsService({
    $transaction: callback => prisma.$transaction(tx => callback({
      account: tx.account,
      transaction: { create: () => { throw new Error('Simulated insertion failure'); } },
    })),
  });
  await assert.rejects(failingService.create({ ...data, amount: 1000 }), /Simulated insertion failure/);
  assert.equal((await prisma.account.findUniqueOrThrow({ where: { id: account.id } })).balance, 20000);
  assert.equal(await prisma.transaction.count({ where: { accountId: account.id } }), 3);
  secondAccount = await prisma.account.create({ data: { bank: 'Segunda cuenta de prueba', accountType: 'Prueba temporal', balance: 100000 } });
  const balance = async id => (await prisma.account.findUniqueOrThrow({ where: { id } })).balance;
  const editable = await service.create({ ...data, amount: 1000 });
  await service.update(editable.id, { ...data, amount: 2000 });
  assert.equal(await balance(account.id), 18000);
  await service.update(editable.id, { ...data, type: 'INCOME', amount: 3000 });
  assert.equal(await balance(account.id), 23000);
  await service.update(editable.id, { ...data, accountId: secondAccount.id, type: 'INCOME', amount: 3000 });
  assert.equal(await balance(account.id), 20000);
  assert.equal(await balance(secondAccount.id), 103000);
  await service.remove(editable.id);
  assert.equal(await balance(secondAccount.id), 100000);

  const income = await service.create({ ...data, type: 'INCOME', amount: 5000 });
  const spent = await service.create({ ...data, amount: 24000 });
  // A metadata-only correction must work even after spending the income.
  await service.update(income.id, { ...data, type: 'INCOME', amount: 5000, description: 'Descripción corregida' });
  assert.equal(await balance(account.id), 1000);
  await assert.rejects(service.remove(income.id), /Saldo insuficiente/);
  await assert.rejects(service.update(income.id, { ...data, accountId: secondAccount.id, type: 'INCOME', amount: 5000 }), /Saldo insuficiente/);
  assert.equal(await balance(account.id), 1000);
  assert.equal(await balance(secondAccount.id), 100000);
  assert.ok(await prisma.transaction.findUnique({ where: { id: income.id } }));
  await service.remove(spent.id);
  await service.remove(income.id);
  assert.equal(await balance(account.id), 20000);

  const toDelete = await service.create({ ...data, amount: 500 });
  const deletions = await Promise.allSettled([service.remove(toDelete.id), service.remove(toDelete.id)]);
  assert.equal(deletions.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(await balance(account.id), 20000);

  const toEdit = await service.create({ ...data, amount: 1000 });
  await Promise.all([service.update(toEdit.id, { ...data, amount: 2000 }), service.update(toEdit.id, { ...data, amount: 3000 })]);
  const finalMovement = await prisma.transaction.findUniqueOrThrow({ where: { id: toEdit.id } });
  assert.equal(await balance(account.id), 20000 - finalMovement.amount);
  await service.remove(toEdit.id);
  assert.equal(await balance(account.id), 20000);
  console.log('OK: create, edit amount/type/account, metadata correction, delete, insufficient funds, concurrent edits/deletes and rollback verified against PostgreSQL.');
} finally {
  if (account) {
    await prisma.$transaction([
      prisma.transaction.deleteMany({ where: { accountId: account.id } }),
      prisma.account.delete({ where: { id: account.id } }),
    ]);
  }
  if (secondAccount) {
    await prisma.$transaction([
      prisma.transaction.deleteMany({ where: { accountId: secondAccount.id } }),
      prisma.account.delete({ where: { id: secondAccount.id } }),
    ]);
  }
  await prisma.$disconnect();
}
