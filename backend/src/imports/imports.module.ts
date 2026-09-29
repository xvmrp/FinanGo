import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ImportsController } from './imports.controller.js';
import { ImportsService } from './imports.service.js';
@Module({ imports: [PrismaModule], controllers: [ImportsController], providers: [ImportsService] })
export class ImportsModule {}
