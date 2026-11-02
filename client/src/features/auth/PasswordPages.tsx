import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Mail, LockKeyhole } from "lucide-react";
import { emailSchema, resetPasswordSchema } from "./auth.schemas";
import { forgotPassword, resetPassword } from "./auth.api";

type EmailValues = { email: string };
type ResetValues = { password: string; confirmPassword: string };

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const form = useForm<EmailValues>({ resolver: zodResolver(emailSchema), defaultValues: { email: "" } });
  const mutation = useMutation({ mutationFn: forgotPassword, onSuccess: () => setSent(true) });
  return <main className="auth-screen auth-screen-centered"><section className="auth-panel auth-standalone"><Link to="/login" className="auth-back"><ArrowLeft size={15}/> Back to sign in</Link>{sent ? <><div className="auth-success-icon"><CheckCircle2 size={25}/></div><h1>Check your inbox.</h1><p className="auth-description">If an account exists for that address, a password reset link has been sent.</p></> : <><span className="eyebrow">ACCOUNT RECOVERY</span><h1>Reset your password.</h1><p className="auth-description">Enter your account email and we’ll send a secure reset link if it exists.</p><form className="auth-form" onSubmit={form.handleSubmit(values => mutation.mutate(values.email))}><label>Email address</label><div className="auth-input-wrap"><Mail size={16}/><input type="email" placeholder="you@example.com" {...form.register("email")}/></div>{form.formState.errors.email && <small className="field-error">{form.formState.errors.email.message}</small>}{mutation.error && <p className="form-error">{mutation.error.message}</p>}<button className="button button-primary auth-submit" disabled={mutation.isPending}>{mutation.isPending ? "Sending…" : "Send reset link"}</button></form></>}</section></main>;
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [done, setDone] = useState(false);
  const form = useForm<ResetValues>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: "", confirmPassword: "" } });
  const mutation = useMutation({ mutationFn: (values: ResetValues) => resetPassword(token, values.password), onSuccess: () => setDone(true) });
  return <main className="auth-screen auth-screen-centered"><section className="auth-panel auth-standalone"><Link to="/login" className="auth-back"><ArrowLeft size={15}/> Back to sign in</Link>{done ? <><div className="auth-success-icon"><CheckCircle2 size={25}/></div><h1>Password updated.</h1><p className="auth-description">All active sessions were revoked. Sign in with your new password.</p><Link to="/login" className="button button-primary auth-submit">Continue to sign in</Link></> : <><span className="eyebrow">SECURE YOUR ACCOUNT</span><h1>Choose a new password.</h1><p className="auth-description">Use at least 10 characters. Other sessions will be signed out.</p>{!token && <p className="form-error">The reset token is missing. Request another reset link.</p>}<form className="auth-form" onSubmit={form.handleSubmit(values => mutation.mutate(values))}><label>New password</label><div className="auth-input-wrap"><LockKeyhole size={16}/><input type="password" autoComplete="new-password" {...form.register("password")}/></div>{form.formState.errors.password && <small className="field-error">{form.formState.errors.password.message}</small>}<label>Confirm password</label><div className="auth-input-wrap"><LockKeyhole size={16}/><input type="password" autoComplete="new-password" {...form.register("confirmPassword")}/></div>{form.formState.errors.confirmPassword && <small className="field-error">{form.formState.errors.confirmPassword.message}</small>}{mutation.error && <p className="form-error">{mutation.error.message}</p>}<button className="button button-primary auth-submit" disabled={!token || mutation.isPending}>{mutation.isPending ? "Updating…" : "Update password"}</button></form></>}</section></main>;
}
