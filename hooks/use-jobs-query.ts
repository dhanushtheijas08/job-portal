"use client"

import { useQuery } from "@tanstack/react-query"

import type { JobRow } from "@/lib/jobs/constants"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

/** Columns we read for the dashboard (matches `jobs` in schema). */
const JOBS_SELECT =
  [
    "id",
    "user_id",
    "job_title",
    "company_name",
    "job_url",
    "resume_url",
    "site",
    "status",
    "is_referred",
    "referred_by_name",
    "referred_by_profile_url",
    "location",
    "notes",
    "applied_at",
    "reminder_at",
    "created_at",
    "updated_at",
  ].join(",")

function asIsoOrNull(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === "string") return value
  return null
}

function normalizeJob(row: Record<string, unknown>): JobRow {
  return {
    ...(row as unknown as JobRow),
    applied_at: asIsoOrNull(row.applied_at),
    reminder_at: asIsoOrNull(row.reminder_at),
  }
}

export function useJobsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: ["jobs", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<JobRow[]> => {
      if (!userId) return []
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .from("jobs")
        .select(JOBS_SELECT)
        .eq("user_id", userId)
        .order("applied_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })

      if (error) throw error
      return (data ?? []).map((r) =>
        normalizeJob(r as unknown as Record<string, unknown>)
      )
    },
  })
}
