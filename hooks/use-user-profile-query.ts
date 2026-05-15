"use client"

import { useQuery } from "@tanstack/react-query"

import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import {
  normalizeResumeEntriesFromDb,
  type ResumeEntry,
} from "@/lib/users/profile-schema"

export type UserProfileRow = {
  id: string
  user_name: string
  email: string
  linkedin_url: string | null
  github_url: string | null
  portfolio_url: string | null
  resumes: ResumeEntry[] | null
  created_at: string
}

export function useUserProfileQuery(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-profile", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<UserProfileRow | null> => {
      if (!userId) return null
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .from("users")
        .select(
          "id,user_name,email,linkedin_url,github_url,portfolio_url,resumes,created_at"
        )
        .eq("id", userId)
        .maybeSingle()

      if (error) throw error
      if (!data) return null

      return {
        id: data.id as string,
        user_name: data.user_name as string,
        email: data.email as string,
        linkedin_url: (data.linkedin_url as string | null) ?? null,
        github_url: (data.github_url as string | null) ?? null,
        portfolio_url: (data.portfolio_url as string | null) ?? null,
        resumes: normalizeResumeEntriesFromDb(data.resumes),
        created_at: data.created_at as string,
      }
    },
    staleTime: 30_000,
  })
}
