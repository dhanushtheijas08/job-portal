"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useEffect, useState } from "react"

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useLoginMutation } from "@/hooks/use-auth-mutations"

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const { mutate, reset, isPending, isError, error } = useLoginMutation()

  useEffect(() => {
    reset()
  }, [email, password, reset])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    reset()
    mutate(
      { email, password },
      {
        onSuccess: () => {
          router.push("/")
          router.refresh()
        },
      }
    )
  }

  const message = isError && error instanceof Error ? error.message : null

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="font-heading text-xl">Log in</CardTitle>
        <CardDescription>
          Use your email and password, or Google when enabled.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={message ? true : undefined}
              placeholder="you@example.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="login-password">Password</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              placeholder="********"
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={message ? true : undefined}
            />
          </div>
          {message ? (
            <p className="text-sm text-destructive" role="alert">
              {message}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="mt-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs whitespace-nowrap text-muted-foreground">
              or continue with
            </span>
            <Separator className="flex-1" />
          </div>
          <GoogleSignInButton actionLabel="Sign in" />
        </div>
      </CardContent>
      <CardFooter className="text-muted-foreground">
        <p className="w-full text-center text-sm">
          No account?{" "}
          <Link
            href="/register"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Register
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
