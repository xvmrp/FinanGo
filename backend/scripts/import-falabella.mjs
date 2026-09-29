// Usage (from backend): node scripts/import-falabella.mjs path/to/cartola.pdf [...]
import 'dotenv/config';
import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { PrismaService } from '../dist/prisma/prisma.service.js';
import { ImportsService } from '../dist/imports/imports.service.js';
const prisma = new PrismaService();
try {
  const imports = new ImportsService(prisma);
  for (const path of process.argv.slice(2)) {
    const result = await imports.importPdf(await readFile(path), basename(path));
    console.log(JSON.stringify({ file: basename(path), ...result }));
  }
} finally { await prisma.$disconnect(); }
