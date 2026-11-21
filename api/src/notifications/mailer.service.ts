import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { Email } from './booking-email.js';

// Envia por SMTP. Em desenvolvimento, quem recebe é o Mailpit.
@Injectable()
export class MailerService {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    const port = Number(config.getOrThrow<string>('SMTP_PORT'));
    const user = config.get<string>('SMTP_USER');
    this.transporter = createTransport({
      host: config.getOrThrow<string>('SMTP_HOST'),
      port,
      // 465 é TLS direto. Nas outras portas, o Nodemailer passa para TLS
      // (STARTTLS) quando o servidor oferece.
      secure: port === 465,
      auth: user ? { user, pass: config.get<string>('SMTP_PASS') } : undefined,
      // Tempos curtos, porque o envio acontece dentro de uma transação do
      // banco (DeliveryService).
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      socketTimeout: 10_000,
    });
    this.from = config.getOrThrow<string>('MAIL_FROM');
  }

  async send(email: Email): Promise<void> {
    await this.transporter.sendMail({ from: this.from, ...email });
  }
}
