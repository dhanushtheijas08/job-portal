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
import { useRegisterMutation } from "@/hooks/use-auth-mutations"

export function RegisterForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [info, setInfo] = useState<string | null>(null)
  const { mutate, reset, isPending, isError, error } = useRegisterMutation()

  useEffect(() => {
    reset()
  }, [name, email, password, reset])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    reset()
    setInfo(null)
    mutate(
      { name, email, password },
      {
        onSuccess: (data) => {
          const needsConfirm = !data.session
          setInfo(
            needsConfirm
              ? "Check your email for a confirmation link."
              : "Account created — you’re signed in."
          )
          if (data.session) {
            router.push("/")
            router.refresh()
          }
        },
      }
    )
  }

  const message = isError && error instanceof Error ? error.message : null

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="font-heading text-xl">
          Create an account
        </CardTitle>
        <CardDescription>
          Sign up with email and password, or Google when enabled.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="register-name">Name</Label>
            <Input
              id="register-name"
              type="text"
              autoComplete="name"
              required
              minLength={1}
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={message ? true : undefined}
              placeholder="Your name"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="register-email">Email</Label>
            <Input
              id="register-email"
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
            <Label htmlFor="register-password">Password</Label>
            <Input
              id="register-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={message ? true : undefined}
              placeholder="At least 8 characters"
            />
          </div>
          {message ? (
            <p className="text-sm text-destructive" role="alert">
              {message}
            </p>
          ) : null}
          {info ? (
            <p className="text-sm text-muted-foreground" role="status">
              {info}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Creating account…" : "Create account"}
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
          <GoogleSignInButton actionLabel="Continue" />
        </div>
      </CardContent>
      <CardFooter className="text-muted-foreground">
        <p className="w-full text-center text-sm">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Log in
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
