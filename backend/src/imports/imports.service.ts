import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaService } from '../prisma/prisma.service.js';

interface ParsedStatement {
  bankImportKey: string; last4: string; period: string; openingBalance: number; closingBalance: number;
  balanceAsOf: string; fingerprint: string;
  rows: { date: string; description: string; type: 'INCOME' | 'EXPENSE'; amount: number; balanceAfter: number }[];
}
@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}
  async parse(buffer: Buffer): Promise<ParsedStatement> {
    if (!buffer?.subarray(0, 5).equals(Buffer.from('%PDF-')) || buffer.length > 10 * 1024 * 1024) {
      throw new BadRequestException('Sube un PDF de hasta 10 MB.');
    }
    const bundled = resolve(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
    const python = process.env.PDF_PYTHON ?? (existsSync(bundled) ? bundled : 'python');
    const script = fileURLToPath(new URL('../../scripts/parse_falabella.py', import.meta.url));
    return new Promise((resolveResult, reject) => {
      const child = execFile(python, [script], { timeout: 30000, maxBuffer: 4 * 1024 * 1024, windowsHide: true }, (error, stdout) => {
        if (error) return reject(new BadRequestException('No se pudo validar la cartola. Revisa el formato, las páginas y la configuración del lector PDF.'));
        try { resolveResult(JSON.parse(stdout) as ParsedStatement); }
        catch { reject(new BadRequestException('Respuesta inválida del lector de cartolas.')); }
      });
      child.stdin?.on('error', () => {});
      child.stdin?.end(buffer);
    });
  }
  list() {
    return this.prisma.statement.findMany({ include: { account: true, _count: { select: { transactions: true } } }, orderBy: [{ period: 'desc' }, { id: 'desc' }] });
  }
  async preview(buffer: Buffer) {
    const parsed = await this.parse(buffer);
    const existing = await this.prisma.statement.findUnique({ where: { fingerprint: parsed.fingerprint } });
    return { ...parsed, alreadyImported: !!existing, count: parsed.rows.length };
  }
  async importPdf(buffer: Buffer, filename: string) {
    const parsed = await this.parse(buffer);
    try {
      return await this.prisma.$transaction(async tx => {
        const account = await tx.account.upsert({
          where: { bankImportKey: parsed.bankImportKey },
          create: { bank: 'Banco Falabella', accountType: 'Cuenta Corriente', balance: 0, source: 'BANK_STATEMENT', bankImportKey: parsed.bankImportKey, last4: parsed.last4 },
          update: {},
        });
        await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${account.id} FOR UPDATE`;
        const existing = await tx.statement.findUnique({ where: { accountId_period: { accountId: account.id, period: parsed.period } } });
        if (existing) {
          if (existing.fingerprint !== parsed.fingerprint) throw new ConflictException('Ya existe una cartola distinta para esta cuenta y mes. Requiere revisión; no se agregó ningún movimiento.');
          return { alreadyImported: true, count: 0, accountId: account.id };
        }
        const statement = await tx.statement.create({ data: {
          accountId: account.id, period: parsed.period, fingerprint: parsed.fingerprint,
          openingBalance: parsed.openingBalance, closingBalance: parsed.closingBalance,
          filename: filename.replace(/[^\p{L}\p{N}. _-]/gu, '').slice(0, 180),
        } });
        // Reverse statement display order so ids preserve same-day chronological order.
        await tx.transaction.createMany({ data: [...parsed.rows].reverse().map(row => ({
          accountId: account.id, statementId: statement.id, type: row.type, amount: row.amount,
          date: new Date(`${row.date}T00:00:00Z`), description: row.description,
          category: 'Sin clasificar', balanceAfter: row.balanceAfter,
        })) });
        const asOf = new Date(`${parsed.balanceAsOf}T00:00:00Z`);
        await tx.account.updateMany({
          where: { id: account.id, OR: [{ balanceAsOf: null }, { balanceAsOf: { lt: asOf } }] },
          data: { balance: parsed.closingBalance, balanceAsOf: asOf },
        });
        return { alreadyImported: false, count: parsed.rows.length, accountId: account.id };
      });
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('La cartola ya fue procesada por otra solicitud. Actualiza la lista.');
      }
      throw error;
    }
  }
}
