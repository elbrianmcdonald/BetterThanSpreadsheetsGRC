"use client";

/**
 * Login Form Client Component
 *
 * Local authentication with email and password.
 * Users sign in with credentials created by Organization Administrators.
 */

import { signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, Lock, Mail, Info, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoginFormClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  // Track client-side mount to prevent hydration mismatches
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSigningIn(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
        setIsSigningIn(false);
      } else {
        // Successful sign-in
        const callbackUrl = searchParams?.get("callbackUrl") || "/";
        router.push(callbackUrl);
      }
    } catch (error) {
      console.error("Sign-in error:", error);
      setError("An unexpected error occurred. Please try again.");
      setIsSigningIn(false);
    }
  };

  const Brand = (
    <div className="mb-[26px] flex flex-col items-center">
      <span className="grid size-[42px] place-items-center rounded-[10px] bg-primary text-primary-foreground">
        <Shield className="h-[23px] w-[23px]" strokeWidth={2} />
      </span>
      <div className="mt-3.5 text-[19px] font-extrabold tracking-[-0.02em] text-foreground">
        BetterThanSpreadsheets
      </div>
      <p className="eyebrow mt-1.5">Enterprise GRC Platform</p>
    </div>
  );

  // Show loading state until mounted to prevent hydration mismatch
  if (!isMounted) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6">
        <div className="w-[392px]">
          {Brand}
          <div className="rounded-lg border bg-card p-7 text-center text-[13px] text-muted-foreground shadow-sm">
            Loading…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-[392px]">
        {/* Brand */}
        {Brand}

        {/* Card */}
        <div className="rounded-lg border bg-card p-7 shadow-sm">
          <h1 className="text-[19px] font-bold tracking-[-0.01em] text-foreground">
            Sign in to your account
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Enter your credentials to access the platform.
          </p>

          {/* Error Message */}
          {error && (
            <div className="mt-5 flex items-start gap-2.5 rounded-md bg-destructive/10 px-3.5 py-3 text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-[13px]">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="mt-5">
            {/* Email Input */}
            <div>
              <label
                htmlFor="email"
                className="eyebrow mb-1.5 block text-secondary-foreground"
              >
                Email address
              </label>
              <div className="flex items-center gap-2.5 rounded-md border border-input bg-card px-3.5 py-2.5 transition focus-within:border-primary focus-within:ring-[3px] focus-within:ring-accent">
                <Mail className="h-[15px] w-[15px] text-muted-foreground/70" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70"
                  placeholder="user@example.com"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="mt-4">
              <label
                htmlFor="password"
                className="eyebrow mb-1.5 block text-secondary-foreground"
              >
                Password
              </label>
              <div className="flex items-center gap-2.5 rounded-md border border-input bg-card px-3.5 py-2.5 transition focus-within:border-primary focus-within:ring-[3px] focus-within:ring-accent">
                <Lock className="h-[15px] w-[15px] text-muted-foreground/70" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button type="submit" disabled={isSigningIn} className="mt-[22px] h-11 w-full">
              <Lock className="h-4 w-4" />
              {isSigningIn ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          {/* Help Section */}
          <div className="mt-[18px] space-y-2.5 text-center">
            <a
              href="/forgot-password"
              className="text-[13px] font-semibold text-primary hover:text-primary/80"
            >
              Forgot your password?
            </a>
            <p className="text-[12.5px] text-muted-foreground">
              Don&apos;t have an account?{" "}
              <span className="font-semibold text-foreground">
                Contact your Organization Administrator
              </span>
            </p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-4 flex items-start gap-2.5 rounded-md border border-border bg-accent px-3.5 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-[12px] leading-[1.5] text-secondary-foreground">
            Your password is securely hashed with bcrypt. Sessions expire after 24 hours of inactivity.
          </p>
        </div>
      </div>
    </div>
  );
}
