import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly transporter?: Transporter;
  private readonly sender?: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const user = config.get<string>('SMTP_USER');
    const password = config.get<string>('SMTP_PASSWORD');
    this.sender = config.get<string>('SMTP_FROM');
    if (host && user && password && this.sender) {
      this.transporter = nodemailer.createTransport({
        host,
        port: config.getOrThrow<number>('SMTP_PORT'),
        secure: config.getOrThrow<number>('SMTP_PORT') === 465,
        auth: { user, pass: password },
      });
    }
  }

  get isConfigured(): boolean {
    return this.transporter !== undefined && this.sender !== undefined;
  }

  assertConfigured(): void {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException('Email delivery is not configured.');
    }
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    if (!this.transporter || !this.sender) {
      throw new ServiceUnavailableException('Email delivery is not configured.');
    }
    await this.transporter.sendMail({ from: this.sender, to, subject, text });
  }
}
