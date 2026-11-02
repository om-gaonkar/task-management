import nodemailer from "nodemailer";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";

async function send(to: string, subject: string, text: string, html: string) {
  if (!env.smtpConfigured) {
    if (env.NODE_ENV === "production") throw new AppError("Email delivery is not configured", 503, "EMAIL_NOT_CONFIGURED");
    return false;
  }
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
  });
  await transporter.sendMail({ from: env.SMTP_FROM, to, subject, text, html });
  return true;
}

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const url = new URL("/verify-email", env.CLIENT_URL);
  url.searchParams.set("token", token);
  const link = url.toString();
  return send(
    to,
    "Verify your Daymark email",
    `Hi ${name}, verify your email address: ${link}`,
    `<p>Hi ${name},</p><p>Verify your email address to finish setting up Daymark.</p><p><a href="${link}">Verify email</a></p><p>This link expires in 30 minutes.</p>`
  );
}

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  const url = new URL("/reset-password", env.CLIENT_URL);
  url.searchParams.set("token", token);
  const link = url.toString();
  return send(
    to,
    "Reset your Daymark password",
    `Hi ${name}, reset your password: ${link}`,
    `<p>Hi ${name},</p><p>Use this link to reset your Daymark password.</p><p><a href="${link}">Reset password</a></p><p>This link expires in 30 minutes. Ignore this email if you did not request it.</p>`
  );
}
