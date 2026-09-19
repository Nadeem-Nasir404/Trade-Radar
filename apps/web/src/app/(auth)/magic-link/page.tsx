"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRequestMagicLink, useVerifyMagicLink } from "@/lib/api/hooks/use-auth";
import { ApiError } from "@/lib/api/client";

export default function MagicLinkPage() {
  return (
    <Suspense>
      <MagicLinkPageInner />
    </Suspense>
  );
}

function MagicLinkPageInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  return token ? <MagicLinkVerify token={token} /> : <MagicLinkRequest />;
}

function MagicLinkRequest() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const requestLink = useRequestMagicLink();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await requestLink.mutateAsync(email);
    setSent(true);
  };

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Check your email</CardTitle>
          <CardDescription>
            If an account exists for <span className="text-foreground">{email}</span>, a sign-in link is on its way. It
            expires in 15 minutes.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Sign in with email</CardTitle>
        <CardDescription>We&apos;ll send you a link - no password needed.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" disabled={requestLink.isPending}>
            {requestLink.isPending ? "Sending..." : "Send sign-in link"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function MagicLinkVerify({ token }: { token: string }) {
  const router = useRouter();
  const verify = useVerifyMagicLink();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    verify
      .mutateAsync(token)
      .then(() => router.replace("/dashboard"))
      .catch((err) => setError(err instanceof ApiError ? err.message : "This link is invalid or has expired"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{error ? "Sign-in failed" : "Signing you in..."}</CardTitle>
        <CardDescription>{error ?? "Just a moment."}</CardDescription>
      </CardHeader>
    </Card>
  );
}
