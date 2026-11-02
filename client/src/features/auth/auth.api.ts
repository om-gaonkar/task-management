import { api, clearSessionHint, markSessionPresent } from "../../lib/api-client";
export type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  preferences: { theme?: "light" | "dark" | "system"; timezone?: string; currency?: string };
};
type UserResponse = { data: { user: AuthUser } };
export const authQueryKey = ["auth", "me"] as const;

export async function getCurrentUser() {
  const response = await api<UserResponse>("/auth/me");
  markSessionPresent();
  return response.data.user;
}
export async function login(input: { email: string; password: string }) {
  const response = await api<UserResponse>("/auth/login", { method: "POST", body: JSON.stringify(input) });
  markSessionPresent();
  return response.data.user;
}
export async function register(input: { name: string; email: string; password: string }) {
  return api<{ data: { user: AuthUser; verificationQueued: boolean; developmentVerificationToken?: string } }>("/auth/register", {
    method: "POST", body: JSON.stringify(input)
  }).then(response => response.data);
}
export async function verifyEmail(token: string) {
  return api<{ data: { verified: boolean } }>("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) });
}
export async function resendVerification(email: string) {
  return api<{ data: { accepted: boolean; developmentVerificationToken?: string } }>("/auth/verify-email/resend", {
    method: "POST", body: JSON.stringify({ email })
  }).then(response => response.data);
}
export async function forgotPassword(email: string) {
  return api<{ data: { accepted: boolean; developmentResetToken?: string } }>("/auth/forgot-password", {
    method: "POST", body: JSON.stringify({ email })
  }).then(response => response.data);
}
export async function resetPassword(token: string, password: string) {
  return api<{ data: { passwordReset: boolean } }>("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });
}
export async function logout() {
  try { await api<void>("/auth/logout", { method: "POST" }); }
  finally { clearSessionHint(); }
}
