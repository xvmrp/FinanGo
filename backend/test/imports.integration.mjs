// Read-only integrity checks plus idempotent reimport of already imported files.
// Usage: node test/imports.integration.mjs path/to/already-imported.pdf [...]
import 'dotenv/config';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { PrismaService } from '../dist/prisma/prisma.service.js';
import { ImportsService } from '../dist/imports/imports.service.js';
import { AccountsService } from '../dist/accounts/accounts.service.js';
import { TransactionsService } from '../dist/transactions/transactions.service.js';
const prisma = new PrismaService();
try {
 const imports = new ImportsService(prisma);
 const before = await prisma.account.findMany({ orderBy: { id: 'asc' } });
 const count = await prisma.transaction.count();
 for (const path of process.argv.slice(2)) {
  const buffer = await readFile(path);
  const preview = await imports.preview(buffer);
  assert.equal(preview.alreadyImported, true);
  assert.equal((await imports.importPdf(buffer, basename(path))).count, 0);
 }
 assert.equal(await prisma.transaction.count(), count);
 assert.deepEqual(await prisma.account.findMany({ orderBy: { id: 'asc' } }), before);
 await assert.rejects(imports.parse(Buffer.from('not a pdf')));
 for (const account of before.filter(item => item.source === 'BANK_STATEMENT')) {
  const movement = await prisma.transaction.findFirstOrThrow({ where: { accountId: account.id, statementId: { not: null } } });
  const body = { accountId: account.id, type: movement.type, amount: movement.amount, description: movement.description, category: movement.category, date: movement.date.toISOString().slice(0,10) };
  const transactions = new TransactionsService(prisma);
  await assert.rejects(transactions.create(body), /cartolas/);
  await assert.rejects(transactions.update(movement.id, body), /no se pueden editar/);
  await assert.rejects(transactions.remove(movement.id), /no se pueden editar/);
  await assert.rejects(new AccountsService(prisma).update(account.id, { bank: account.bank, accountType: account.accountType, balance: account.balance }));
  const latest = await prisma.statement.findFirstOrThrow({ where: { accountId: account.id }, orderBy: { period: 'desc' } });
  assert.equal(account.balance, latest.closingBalance);
 }
 assert.equal(await prisma.transaction.count(), count);
 assert.deepEqual(await prisma.account.findMany({ orderBy: { id: 'asc' } }), before);
 console.log('OK: duplicate imports, invalid input, latest balance and immutable bank records verified.');
} finally { await prisma.$disconnect(); }
