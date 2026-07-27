"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button, ErrorText, Field, Input } from "@/components/ui";
import { lookup, type Dictionary } from "@/lib/i18n";
import {
  signInWithPassword,
  signUpWithPassword,
  signInWithGoogle,
  type AuthState,
} from "./actions";

export function AuthForm({
  t,
  mode,
  next,
}: {
  t: Dictionary;
  mode: "signin" | "signup";
  next?: string;
}) {
  const action = mode === "signin" ? signInWithPassword : signUpWithPassword;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    {},
  );

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        {next ? <input type="hidden" name="suite" value={next} /> : null}

        <Field label={t.auth.email}>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
          />
        </Field>

        <Field
          label={t.auth.password}
          hint={mode === "signup" ? t.auth.password_hint : undefined}
        >
          <Input
            name="password"
            type="password"
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
            minLength={mode === "signup" ? 8 : undefined}
            required
          />
        </Field>

        {state.error ? <ErrorText>{lookup(t, state.error)}</ErrorText> : null}
        {state.info ? (
          <p className="text-sm text-accent">{lookup(t, state.info)}</p>
        ) : null}

        <Button type="submit" disabled={pending}>
          {pending
            ? t.common.loading
            : mode === "signin"
              ? t.auth.signin_submit
              : t.auth.signup_submit}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        {t.auth.separator}
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={signInWithGoogle}>
        <Button type="submit" variant="secondary" className="w-full">
          {t.auth.google}
        </Button>
      </form>

      <p className="text-center text-sm text-muted">
        {mode === "signin" ? t.auth.no_account : t.auth.have_account}{" "}
        <Link
          href={mode === "signin" ? "/inscription" : "/connexion"}
          className="font-medium text-accent underline underline-offset-4"
        >
          {mode === "signin" ? t.auth.signup_title : t.auth.signin_title}
        </Link>
      </p>
    </div>
  );
}
