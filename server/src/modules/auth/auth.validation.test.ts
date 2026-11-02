import { describe, expect, it } from "vitest";
import { changePasswordSchema, loginSchema, registerSchema } from "./auth.validation.js";

describe("authentication validation",()=>{
  it("accepts a registration with a valid name, email and strong password",()=>{
    expect(registerSchema.safeParse({name:"Riya Shah",email:"riya@example.com",password:"correct-horse-2026"}).success).toBe(true);
  });
  it("rejects a weak password and malformed email",()=>{
    expect(registerSchema.safeParse({name:"Riya",email:"not-an-email",password:"short"}).success).toBe(false);
  });
  it("does not allow an empty login password",()=>{
    expect(loginSchema.safeParse({email:"riya@example.com",password:""}).success).toBe(false);
  });
  it("requires a strong new password when changing credentials",()=>{
    expect(changePasswordSchema.safeParse({currentPassword:"current",newPassword:"short"}).success).toBe(false);
    expect(changePasswordSchema.safeParse({currentPassword:"current",newPassword:"a-strong-password"}).success).toBe(true);
  });
});
