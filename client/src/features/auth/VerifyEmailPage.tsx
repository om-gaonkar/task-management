import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { verifyEmail } from "./auth.api";
import { ApiError } from "../../lib/api-client";

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const started = useRef(false);
  const [state, setState] = useState<"loading" | "success" | "error">(token ? "loading" : "error");
  const [message, setMessage] = useState(token ? "" : "The verification link is missing its token.");
  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    void verifyEmail(token).then(() => setState("success")).catch(error => {
      setMessage(error instanceof ApiError ? error.message : "Unable to verify this email address.");
      setState("error");
    });
  }, [token]);
  return <main className="auth-screen auth-screen-centered"><section className="auth-panel auth-standalone">
    {state === "loading" ? <><LoaderCircle className="auth-loading" size={28}/><h1>Verifying your email…</h1><p className="auth-description">This should only take a moment.</p></> : state === "success" ? <><div className="auth-success-icon"><CheckCircle2 size={25}/></div><h1>Email verified.</h1><p className="auth-description">Your account is ready. Sign in to open your workspace.</p><Link to="/login" className="button button-primary auth-submit">Continue to sign in</Link></> : <><h1>Link unavailable.</h1><p className="auth-description">{message}</p><Link to="/login" className="button button-secondary auth-submit">Back to sign in</Link></>}
  </section></main>;
}
