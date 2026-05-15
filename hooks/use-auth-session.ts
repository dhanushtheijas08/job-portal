"use client"

import { useQuery } from "@tanstack/react-query"

import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export function useAuthSession() {
  return useQuery({
    queryKey: ["auth", "session"],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      return data.session
    },
    staleTime: 30_000,
  })
}
