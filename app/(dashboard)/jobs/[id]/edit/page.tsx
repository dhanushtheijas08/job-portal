"use client"

import { AlertCircleIcon, Loader2Icon } from "lucide-react"
import { useParams, useSearchParams } from "next/navigation"
import { useMemo } from "react"

import { NewJobForm } from "@/components/dashboard/new-job-form"
import { Button } from "@/components/ui/button"
import { useAuthSession } from "@/hooks/use-auth-session"
import { useJobDetailQuery } from "@/hooks/use-job-detail-query"
import { jobDetailToFormValues } from "@/lib/jobs/job-form-schema"

export default function EditJobPage() {
  const params = useParams<{ id?: string }>()
  const searchParams = useSearchParams()
  const jobId = typeof params.id === "string" ? params.id : undefined
  const initialStep = searchParams.get("step") === "networking" ? 1 : 0
  const { data: session } = useAuthSession()
  const userId = session?.user.id
  const { data, isPending, isError, error, refetch } = useJobDetailQuery(
    userId,
    jobId,
    true
  )

  const initialValues = useMemo(
    () => (data ? jobDetailToFormValues(data) : undefined),
    [data]
  )

  if (isPending) {
    return (
      <div
        className="mx-auto flex min-h-[360px] w-full max-w-3xl items-center justify-center rounded-xl border border-border/80 bg-card px-6 py-12 text-sm text-muted-foreground shadow-xs ring-1 ring-foreground/4"
        role="status"
        aria-label="Loading job"
      >
        <Loader2Icon className="me-2 size-4 animate-spin" aria-hidden />
        Loading job details…
      </div>
    )
  }

  if (isError || !data || !initialValues) {
    return (
      <div className="mx-auto w-full max-w-3xl rounded-xl border border-destructive/35 bg-destructive/5 px-5 py-5 ring-1 ring-destructive/15">
        <div className="flex items-start gap-3">
          <AlertCircleIcon
            className="mt-0.5 size-4 shrink-0 text-destructive"
            aria-hidden
          />
          <div className="min-w-0 space-y-2">
            <p className="font-medium text-destructive">
              {error instanceof Error
                ? error.message
                : "Could not load this job for editing."}
            </p>
            <p className="text-sm text-muted-foreground">
              Check that the job still exists and that your Supabase policies
              allow reading it.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <NewJobForm
      mode="edit"
      jobId={data.id}
      initialValues={initialValues}
      initialStep={initialStep}
    />
  )
}
