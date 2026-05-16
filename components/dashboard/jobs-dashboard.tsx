"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  BellIcon,
  BriefcaseIcon,
  CalendarIcon,
  ExternalLinkIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import Link from "next/link"

import { JobStatusBadge } from "@/components/dashboard/job-status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { JobDetailDialogContent } from "@/components/dashboard/job-detail-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useAuthSession } from "@/hooks/use-auth-session"
import { useJobsQuery } from "@/hooks/use-jobs-query"
import type { JobRow } from "@/lib/jobs/constants"
import { jobSiteLabel } from "@/lib/jobs/constants"
import { formatStoredJobDate } from "@/lib/jobs/dates"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

function JobsListSkeleton() {
  return (
    <div
      className="m-0 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-label="Loading applications"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex h-full min-h-52 flex-col rounded-xl border border-border/80 bg-card p-5 shadow-xs ring-1 ring-foreground/4"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="space-y-2">
              <div className="h-5 w-4/5 max-w-56 animate-pulse rounded-md bg-muted" />
              <div className="h-4 w-3/5 max-w-36 animate-pulse rounded-md bg-muted/75" />
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="h-6 w-19 animate-pulse rounded-full bg-muted/70" />
              <div className="h-6 w-20 animate-pulse rounded-full bg-muted/55" />
            </div>
            <div className="mt-auto space-y-2 pt-1">
              <div className="h-9 w-full animate-pulse rounded-md bg-muted/50" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function useDeleteJobMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (job: JobRow) => {
      const supabase = getSupabaseBrowserClient()

      const { data: leadRows, error: leadsError } = await supabase
        .from("job_leads")
        .select("id")
        .eq("user_id", job.user_id)
        .eq("job_id", job.id)

      if (leadsError) throw leadsError

      const leadIds = (leadRows ?? []).map((lead) => lead.id as string)
      const { data: attemptRows, error: attemptsError } = leadIds.length
        ? await supabase
            .from("lead_attempts")
            .select("id")
            .eq("user_id", job.user_id)
            .in("lead_id", leadIds)
        : { data: [], error: null }

      if (attemptsError) throw attemptsError

      const attemptIds = (attemptRows ?? []).map(
        (attempt) => attempt.id as string
      )

      const { error: jobAttachmentError } = await supabase
        .from("attachments")
        .delete()
        .eq("user_id", job.user_id)
        .eq("job_id", job.id)

      if (jobAttachmentError) throw jobAttachmentError

      if (leadIds.length) {
        const { error: leadAttachmentError } = await supabase
          .from("attachments")
          .delete()
          .eq("user_id", job.user_id)
          .in("lead_id", leadIds)

        if (leadAttachmentError) throw leadAttachmentError
      }

      if (attemptIds.length) {
        const { error: attemptAttachmentError } = await supabase
          .from("attachments")
          .delete()
          .eq("user_id", job.user_id)
          .in("attempt_id", attemptIds)

        if (attemptAttachmentError) throw attemptAttachmentError

        const { error: attemptDeleteError } = await supabase
          .from("lead_attempts")
          .delete()
          .eq("user_id", job.user_id)
          .in("id", attemptIds)

        if (attemptDeleteError) throw attemptDeleteError
      }

      if (leadIds.length) {
        const { error: leadDeleteError } = await supabase
          .from("job_leads")
          .delete()
          .eq("user_id", job.user_id)
          .in("id", leadIds)

        if (leadDeleteError) throw leadDeleteError
      }

      const { error: jobDeleteError } = await supabase
        .from("jobs")
        .delete()
        .eq("user_id", job.user_id)
        .eq("id", job.id)

      if (jobDeleteError) throw jobDeleteError
    },
    onSuccess: (_data, job) => {
      void queryClient.invalidateQueries({ queryKey: ["jobs", job.user_id] })
      void queryClient.invalidateQueries({
        queryKey: ["job-detail", job.user_id, job.id],
      })
    },
  })
}

function JobCard({ job }: { job: JobRow }) {
  const [open, setOpen] = React.useState(false)
  const [actionsOpen, setActionsOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const deleteJob = useDeleteJobMutation()
  const applied = formatStoredJobDate(job.applied_at)
  const followUp = formatStoredJobDate(job.reminder_at)
  const showMetaStrip = Boolean(applied) || Boolean(followUp)

  function handleDeleteRequest() {
    setActionsOpen(false)
    setDeleteOpen(true)
  }

  function handleConfirmDelete() {
    deleteJob.mutate(job, {
      onSuccess: () => setDeleteOpen(false),
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <li
          aria-expanded={open}
          aria-haspopup="dialog"
          role="button"
          tabIndex={0}
          className={cn(
            "flex h-full min-h-0 cursor-pointer flex-col rounded-xl border border-border/80 bg-card shadow-xs ring-1 ring-foreground/4",
            "transition-[border-color,box-shadow,background-color] duration-150",
            "bg-muted/70 hover:border-border hover:bg-muted/60 hover:shadow-md hover:ring-foreground/7",
            "focus-visible:border-primary/35 focus-visible:bg-muted/15 focus-visible:shadow-md focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:outline-none",
            open && "border-primary/25 bg-muted/15 ring-primary/10"
          )}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              setOpen(true)
            }
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
            <div className="flex min-w-0 items-start gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <h2 className="line-clamp-2 font-heading text-base leading-snug font-semibold tracking-tight text-foreground">
                  {job.job_title}
                </h2>
                <p className="truncate text-sm text-muted-foreground">
                  {job.company_name}
                </p>
              </div>
              <Popover open={actionsOpen} onOpenChange={setActionsOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="-mt-2 -mr-2 text-muted-foreground hover:text-foreground"
                    aria-label={`Actions for ${job.job_title}`}
                    aria-expanded={actionsOpen}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <MoreVerticalIcon className="size-4" aria-hidden />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="w-44 gap-1 p-1.5"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2"
                    asChild
                  >
                    <Link href={`/jobs/${job.id}/edit`}>
                      <PencilIcon className="size-4" aria-hidden />
                      Edit
                    </Link>
                  </Button>
                  {job.job_url ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-2"
                      asChild
                    >
                      <a href={job.job_url} target="_blank" rel="noreferrer">
                        <ExternalLinkIcon className="size-4" aria-hidden />
                        Open listing
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                    disabled={deleteJob.isPending}
                    onClick={handleDeleteRequest}
                  >
                    <Trash2Icon className="size-4" aria-hidden />
                    Delete
                  </Button>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <JobStatusBadge status={String(job.status)} />
              <Badge
                variant="outline"
                className="font-normal text-muted-foreground"
              >
                {jobSiteLabel(String(job.site))}
              </Badge>
            </div>

            {showMetaStrip ? (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                {applied ? (
                  <div
                    className="flex max-w-[min(100%,12rem)] min-w-0 items-center gap-1.5 sm:max-w-none"
                    aria-label={`Applied ${applied}`}
                  >
                    <CalendarIcon
                      className="size-3.5 shrink-0 opacity-75"
                      aria-hidden
                    />
                    <span className="min-w-0 truncate tabular-nums">
                      {applied}
                    </span>
                  </div>
                ) : null}
                {followUp ? (
                  <div
                    className="flex max-w-[min(100%,12rem)] min-w-0 items-center gap-1.5 sm:max-w-none"
                    aria-label={`Follow-up ${followUp}`}
                  >
                    <BellIcon
                      className="size-3.5 shrink-0 opacity-75"
                      aria-hidden
                    />
                    <span className="min-w-0 truncate tabular-nums">
                      {followUp}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}

            {deleteJob.isError ? (
              <p className="mt-auto rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {deleteJob.error instanceof Error
                  ? deleteJob.error.message
                  : "Could not delete this job."}
              </p>
            ) : null}
          </div>
        </li>
        <JobDetailDialogContent job={job} open={open} />
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(nextOpen) => {
          if (!deleteJob.isPending) setDeleteOpen(nextOpen)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete application?</DialogTitle>
            <DialogDescription>
              This will permanently delete {job.job_title} at {job.company_name}
              , including saved outreach and attachments.
            </DialogDescription>
          </DialogHeader>
          {deleteJob.isError ? (
            <p className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {deleteJob.error instanceof Error
                ? deleteJob.error.message
                : "Could not delete this job."}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deleteJob.isPending}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteJob.isPending}
              onClick={handleConfirmDelete}
            >
              {deleteJob.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function JobsDashboard() {
  const { data: session } = useAuthSession()
  const userId = session?.user.id
  const {
    data: jobs,
    isPending,
    isError,
    error,
    refetch,
    isFetching,
  } = useJobsQuery(userId)

  const count = jobs?.length ?? 0

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl space-y-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Applications
          </h1>
          <p className="text-[15px] text-muted-foreground">
            Scan where you are in each pipeline, open postings in a click, and
            add new roles when you apply.
          </p>
        </div>
        <Button
          asChild
          size="lg"
          className="shrink-0 gap-2 self-start lg:self-auto"
        >
          <Link href="/new">
            <PlusIcon className="size-4" aria-hidden />
            Track new job
          </Link>
        </Button>
      </header>

      {isError ? (
        <div className="rounded-xl border border-destructive/35 bg-destructive/5 px-5 py-4 text-sm ring-1 ring-destructive/15">
          <p className="font-medium text-destructive">
            {error instanceof Error ? error.message : "Failed to load jobs."}
          </p>
          <p className="mt-2 text-muted-foreground">
            Check your Supabase `jobs` table and row-level policies, then try
            again.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => void refetch()}
          >
            Retry
          </Button>
        </div>
      ) : null}

      {isPending ? <JobsListSkeleton /> : null}

      {!isPending && !isError && count === 0 ? (
        <div className="flex flex-col items-center justify-center gap-6 rounded-xl border border-dashed border-border bg-muted/25 px-8 py-16 text-center ring-1 ring-foreground/5">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-card shadow-xs ring-1 ring-foreground/10">
            <BriefcaseIcon
              className="size-7 text-muted-foreground"
              aria-hidden
            />
          </span>
          <div className="max-w-sm space-y-2">
            <p className="font-heading text-lg font-semibold text-foreground">
              No applications yet
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              When you apply somewhere, add it here so you never lose the
              posting, date, or status.
            </p>
          </div>
        </div>
      ) : null}

      {!isPending && !isError && count > 0 ? (
        <section
          className="space-y-4"
          aria-labelledby="applications-list-heading"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h2
              id="applications-list-heading"
              className="font-heading text-base font-medium text-foreground"
            >
              All roles
            </h2>
            <p className="text-sm text-muted-foreground">
              {count} application{count === 1 ? "" : "s"}
              {isFetching ? " · Updating…" : ""}
            </p>
          </div>

          <ul className="m-0 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {(jobs ?? []).map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
