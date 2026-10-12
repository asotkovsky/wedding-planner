"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp } from "@/lib/auth-client";

export function AuthForm({ mode, googleEnabled }: { mode: "sign-in" | "sign-up"; googleEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const email = String(formData.get("email"));
    const password = String(formData.get("password"));
    const result =
      mode === "sign-up"
        ? await signUp.email({ email, password, name: String(formData.get("name")) })
        : await signIn.email({ email, password });
    setPending(false);
    if (result.error) {
      setError(result.error.message ?? "Something went wrong");
      return;
    }
    router.push(next);
    router.refresh();
  }

  const otherHref = `${mode === "sign-in" ? "/sign-up" : "/sign-in"}${next !== "/weddings" ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{mode === "sign-in" ? "Sign in" : "Create an account"}</CardTitle>
        <CardDescription>
          {mode === "sign-in" ? "Welcome back to your wedding planner." : "Start planning your wedding."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={onSubmit} className="space-y-4">
          {mode === "sign-up" && (
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required autoComplete="name" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {mode === "sign-in" ? "Sign in" : "Sign up"}
          </Button>
        </form>
        {googleEnabled && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => signIn.social({ provider: "google", callbackURL: next })}
          >
            Continue with Google
          </Button>
        )}
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        {mode === "sign-in" ? "No account yet?" : "Already have an account?"}&nbsp;
        <Link href={otherHref} className="underline">
          {mode === "sign-in" ? "Sign up" : "Sign in"}
        </Link>
      </CardFooter>
    </Card>
  );
}

// Only allow same-site relative redirects.
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/weddings";
}
