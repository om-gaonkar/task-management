import { describe, expect, it } from "vitest";
import { budgetSchema, transactionSchema } from "./finance.validation.js";

describe("finance validation",()=>{
  const valid={type:"expense",amountMinor:12345,currency:"inr",occurredAt:"2026-11-03T10:00:00.000Z",note:"Groceries"};
  it("normalizes currency and accepts safe integer minor units",()=>{
    const parsed=transactionSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if(parsed.success)expect(parsed.data.currency).toBe("INR");
  });
  it("rejects floating point amounts and zero values",()=>{
    expect(transactionSchema.safeParse({...valid,amountMinor:12.5}).success).toBe(false);
    expect(transactionSchema.safeParse({...valid,amountMinor:0}).success).toBe(false);
  });
  it("validates a monthly budget scope and amount",()=>{
    expect(budgetSchema.safeParse({periodMonth:"2026-11",currency:"INR",amountMinor:2500000}).success).toBe(true);
    expect(budgetSchema.safeParse({periodMonth:"2026-13",currency:"INR",amountMinor:2500000}).success).toBe(false);
  });
});
