"use client"

import type { AuthResponse } from "@supabase/supabase-js"
import { useMutation } from "@tanstack/react-query"

import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export function useLoginMutation() {
  return useMutation({
    mutationFn: async ({
      email,
      password,
    }: {
      email: string
      password: string
    }) => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      return data
    },
  })
}

export function useRegisterMutation() {
  return useMutation({
    mutationFn: async ({
      email,
      password,
      name,
    }: {
      email: string
      password: string
      name: string
    }): Promise<AuthResponse["data"]> => {
      const trimmedName = name.trim()
      if (!trimmedName) {
        throw new Error("Please enter your name.")
      }
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: trimmedName,
          },
        },
      })
      if (error) throw error
      return data
    },
  })
}

export function useGoogleOAuthMutation() {
  return useMutation({
    mutationFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${process.env.NEXT_PUBLIC_REDIRECT_URI}` },
      })
      if (error) throw error
      return data
    },
  })
}
