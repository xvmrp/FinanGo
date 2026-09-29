import { Controller, Get, Post, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportsService } from './imports.service.js';
interface PdfUpload { buffer: Buffer; originalname: string }
@Controller('imports/falabella')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}
  @Get() list() { return this.imports.list(); }
  @Post('preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  preview(@UploadedFile() file: PdfUpload) {
    if (!file) throw new BadRequestException('Selecciona un PDF.');
    return this.imports.preview(file.buffer);
  }
  @Post('confirm')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  confirm(@UploadedFile() file: PdfUpload) {
    if (!file) throw new BadRequestException('Selecciona un PDF.');
    return this.imports.importPdf(file.buffer, file.originalname);
  }
}
