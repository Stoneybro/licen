"use client"

import { useState, useEffect, Suspense, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useLogin, usePrivy } from "@privy-io/react-auth"
import Image from "next/image"
import { FcGoogle } from "react-icons/fc"
import { SiGmail } from "react-icons/si"
import { FaGithub } from "react-icons/fa"
import { WalletIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import LoginFormSkeleton from "./LoginSkeleton"
type LoginMethod = "google" | "github" | "email" | "wallet"

function LoginFormContent() {
  const { ready, authenticated } = usePrivy();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/app";

  useEffect(() => {
    if (ready && authenticated) {
      router.push(returnTo);
    }
  }, [ready, authenticated, router, returnTo]);

  const [loadingProvider, setLoadingProvider] = useState<LoginMethod | null>(null);
  const { login } = useLogin({
    onComplete: ({ user, isNewUser, wasAlreadyAuthenticated }) => {
      console.log("Login success", { user, isNewUser, wasAlreadyAuthenticated });
      router.push(returnTo);
    },
    onError: (error) => {
      console.error("Login error", error);
      setLoadingProvider(null);
    },
  });

  const handleLogin = (method: LoginMethod) => {
    setLoadingProvider(method);
    login({ loginMethods: [method] });
  };

  const loginMethods: { id: LoginMethod; label: string; icon: ReactNode }[] = [
    { id: "google", label: "Continue with Google", icon: <FcGoogle /> },
    { id: "github", label: "Continue with GitHub", icon: <FaGithub className="size-4" /> },
    { id: "email", label: "Continue with Email", icon: <SiGmail className="size-4" /> },
    { id: "wallet", label: "Continue with Wallet", icon: <WalletIcon className="size-4" /> },
  ]

  if (!ready) {
    return <LoginFormSkeleton />
  }

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-border/60 bg-card/60 p-6 shadow-sm md:p-7">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="mb-2 relative h-16 w-16">
          <Image
            alt="Licen Logo"
            className="block dark:hidden object-contain"
            src="/licen-logo-light.svg"
            fill
          />
          <Image
            alt="Licen Logo"
            className="hidden dark:block object-contain"
            src="/licen-logo-light.svg"
            fill
          />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to LICEN</h1>
        <p className="text-muted-foreground text-sm text-balance max-w-[28ch]">
          Choose a method to continue to your dashboard.
        </p>
      </div>

      <div className="grid gap-3">
        {loginMethods.map((method) => (
          <Button
            key={method.id}
            type="button"
            onClick={() => handleLogin(method.id)}
            variant="outline"
            className="w-full h-11 justify-start gap-2.5 text-sm"
            aria-label={`Continue with ${method.id}`}
            disabled={loadingProvider !== null}
          >
            <span className="inline-flex items-center" aria-hidden>
              {method.icon}
            </span>
            {loadingProvider === method.id ? "Connecting..." : method.label}
          </Button>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground/80">
        You will be redirected back to your requested page after sign in.
      </p>
    </div>
  );
}

export default function LoginForm() {
  return (
    <Suspense fallback={<LoginFormSkeleton />}>
      <LoginFormContent />
    </Suspense>
  );
}