"use client"

import { JobStatusBadge } from "@/components/dashboard/job-status-badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useJobDetailQuery } from "@/hooks/use-job-detail-query"
import type {
  AttachmentRow,
  JobLeadRow,
  JobRow,
  LeadAttemptRow,
} from "@/lib/jobs/constants"
import {
  LEAD_STATUSES,
  jobSiteLabel,
  leadStatusLabel,
} from "@/lib/jobs/constants"
import { formatStoredJobDate, formatStoredTimestamp } from "@/lib/jobs/dates"
import { emptyToUndefined } from "@/lib/jobs/job-form-schema"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { uploadAttachmentFile } from "@/lib/supabase/upload-job-attachment"
import { cn } from "@/lib/utils"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  BellIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  FileTextIcon,
  Link2Icon,
  LinkIcon,
  Loader2Icon,
  MailIcon,
  MapPinIcon,
  MessageSquareTextIcon,
  PaperclipIcon,
  PencilIcon,
  PlusIcon,
  UserRoundIcon,
} from "lucide-react"
import Link from "next/link"
import * as React from "react"

function OutLink({
  href,
  label,
  className,
}: {
  href: string
  label: string
  className?: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 transition-colors hover:text-foreground/70 hover:underline",
        className
      )}
    >
      <span className="truncate">{label}</span>
      <LinkIcon className="size-3.5 shrink-0 opacity-60" aria-hidden />
    </a>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <span className="text-sm text-muted-foreground/55">{children}</span>
}

function MetaLabel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        "text-[10px] font-semibold tracking-[0.16em] text-muted-foreground/80 uppercase",
        className
      )}
    >
      {children}
    </p>
  )
}

function StatTile({
  label,
  children,
  icon,
  className,
}: {
  label: string
  children: React.ReactNode
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between gap-4 overflow-hidden rounded-xl border border-border/80 bg-card p-4 shadow-xs ring-1 ring-foreground/4 transition-[border-color,box-shadow,background-color] duration-150 hover:ring-foreground/8",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <MetaLabel>{label}</MetaLabel>
        {icon ? (
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/40 text-muted-foreground transition-colors group-hover:text-foreground"
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div className="text-[15px] leading-tight font-semibold tracking-tight text-foreground">
        {children}
      </div>
    </div>
  )
}

function InfoCell({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border border-border/80 bg-card p-4 shadow-xs ring-1 ring-foreground/4",
        className
      )}
    >
      <MetaLabel>{label}</MetaLabel>
      <div className="text-sm leading-snug font-medium text-foreground">
        {children}
      </div>
    </div>
  )
}

function SectionHeading({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden
          className="mt-[5px] h-3 w-[3px] shrink-0 rounded-full bg-foreground/70"
        />
        <div className="min-w-0 space-y-0.5">
          <h3 className="font-heading text-[15px] font-semibold tracking-tight text-foreground">
            {title}
          </h3>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <SectionHeading title={title} description={description} action={action} />
      {children}
    </section>
  )
}

function AttachmentLinks({ items }: { items: AttachmentRow[] }) {
  if (!items.length) return null
  return (
    <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
      {items.map((f) => (
        <li key={f.id}>
          <a
            href={f.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 items-center gap-3 rounded-xl border border-border/80 bg-card px-3 py-2.5 text-sm shadow-xs ring-1 ring-foreground/4 transition-[border-color,box-shadow,background-color] duration-150 hover:bg-muted/20 hover:shadow-sm hover:ring-foreground/8"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/40 text-muted-foreground">
              <FileTextIcon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-foreground">
                {f.file_name?.trim() || "Download file"}
              </span>
              {f.content_type ? (
                <span className="block truncate text-xs text-muted-foreground">
                  {f.content_type}
                </span>
              ) : null}
            </span>
            <LinkIcon
              className="size-3.5 shrink-0 text-muted-foreground/60"
              aria-hidden
            />
          </a>
        </li>
      ))}
    </ul>
  )
}

function AttemptCard({
  attempt,
  isLast,
}: {
  attempt: LeadAttemptRow
  isLast: boolean
}) {
  const sent = formatStoredTimestamp(attempt.sent_at)
  const reminder = formatStoredJobDate(attempt.reminder_at)
  const files = attempt.attachments ?? []

  return (
    <div className="relative pl-10">
      {!isLast ? (
        <span
          aria-hidden
          className="absolute top-9 -bottom-4 left-[15px] w-px bg-border"
        />
      ) : null}
      <span
        aria-hidden
        className="absolute top-2 left-0 flex size-8 items-center justify-center rounded-full border border-border bg-card font-mono text-[11px] font-semibold text-foreground tabular-nums shadow-xs ring-4 ring-background"
      >
        {attempt.attempt_no}
      </span>

      <div className="rounded-xl border border-border/80 bg-card shadow-xs ring-1 ring-foreground/4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border/70 px-4 py-2.5">
          {sent ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
              <ClockIcon className="size-3 shrink-0 opacity-70" aria-hidden />
              {sent}
            </span>
          ) : null}
          <Badge variant="outline" className="text-xs font-normal">
            After {leadStatusLabel(String(attempt.lead_status))}
          </Badge>
          <span
            className={cn(
              "ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
              attempt.response_received
                ? "border-foreground/15 bg-foreground text-background"
                : "border-border bg-muted/30 text-muted-foreground"
            )}
          >
            {attempt.response_received ? (
              <>
                <CheckIcon className="size-3" aria-hidden />
                Reply received
              </>
            ) : (
              <>
                <ClockIcon className="size-3" aria-hidden />
                Awaiting reply
              </>
            )}
          </span>
        </div>

        <div className="space-y-4 p-4">
          {attempt.message_text?.trim() ? (
            <div className="relative">
              <span
                aria-hidden
                className="absolute top-1 bottom-1 left-0 w-[2px] rounded-full bg-foreground/25"
              />
              <p className="pl-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                {attempt.message_text}
              </p>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border/70 bg-muted/15 px-3.5 py-3 text-sm text-muted-foreground/70">
              No outbound message logged.
            </p>
          )}
          {reminder ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
              <BellIcon className="size-3.5 shrink-0 opacity-70" aria-hidden />
              Follow-up {reminder}
            </p>
          ) : null}
          {attempt.notes?.trim() ? (
            <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/15 px-3.5 py-3">
              <MetaLabel>Internal note</MetaLabel>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                {attempt.notes}
              </p>
            </div>
          ) : null}
          {files.length ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <PaperclipIcon
                  className="size-3 shrink-0 text-muted-foreground/70"
                  aria-hidden
                />
                <MetaLabel>Attachments</MetaLabel>
              </div>
              <AttachmentLinks items={files} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function LeadContactRow({
  icon,
  href,
  external,
  children,
  empty,
}: {
  icon: React.ReactNode
  href?: string
  external?: boolean
  children: React.ReactNode
  empty?: boolean
}) {
  const inner = (
    <>
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/30",
          empty ? "text-muted-foreground/50" : "text-muted-foreground"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {href && external ? (
        <LinkIcon
          className="size-3.5 shrink-0 text-muted-foreground/60"
          aria-hidden
        />
      ) : null}
    </>
  )
  if (empty) {
    return (
      <span className="inline-flex min-w-0 items-center gap-2.5 rounded-xl border border-dashed border-border/70 bg-transparent px-3 py-2 text-sm text-muted-foreground/55">
        {inner}
      </span>
    )
  }
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border/80 bg-card px-3 py-2 text-sm font-medium text-foreground shadow-xs ring-1 ring-foreground/4 transition-[border-color,box-shadow,background-color] duration-150 hover:bg-muted/20 hover:ring-foreground/8"
    >
      {inner}
    </a>
  )
}

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

function safeFileSegment(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 180) || "file"
}

function attachmentObjectPath(userId: string, file: File) {
  const safe = safeFileSegment(file.name)
  const dot = safe.lastIndexOf(".")
  const base = (dot > 0 ? safe.slice(0, dot) : safe) || "file"
  const ext = dot > 0 ? safe.slice(dot) : ""
  const buf = new Uint16Array(1)
  crypto.getRandomValues(buf)
  const suffix = String(buf[0] % 10000).padStart(4, "0")
  return `${userId}/${base}-${suffix}${ext}`
}

function dateInputToIso(value: string) {
  const trimmed = value.trim()
  return trimmed ? new Date(`${trimmed}T12:00:00`).toISOString() : null
}

function useAddLeadMutation(args: {
  userId: string
  jobId: string
  onSaved: () => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: {
      name: string
      role: string
      linkedinUrl: string
    }) => {
      const name = emptyToUndefined(values.name)
      const linkedinUrl = emptyToUndefined(values.linkedinUrl)
      if (!name) throw new Error("Contact name is required.")
      if (linkedinUrl && !isHttpUrl(linkedinUrl)) {
        throw new Error("Enter a valid LinkedIn URL.")
      }

      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.from("job_leads").insert({
        user_id: args.userId,
        job_id: args.jobId,
        name,
        role: emptyToUndefined(values.role) ?? null,
        linkedin_url: linkedinUrl ?? null,
        profile_url: null,
        email: null,
        status: "not_contacted",
      })

      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["job-detail", args.userId, args.jobId],
      })
      void queryClient.invalidateQueries({ queryKey: ["jobs", args.userId] })
      args.onSaved()
    },
  })
}

function useAddAttemptMutation(args: {
  userId: string
  jobId: string
  leadId: string
  nextAttemptNo: number
  onSaved: () => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: {
      messageText: string
      notes: string
      reminderAt: string
      leadStatus: string
      file: File | null
    }) => {
      const hasContent = Boolean(
        emptyToUndefined(values.messageText) ||
        emptyToUndefined(values.notes) ||
        emptyToUndefined(values.reminderAt) ||
        values.file
      )
      if (!hasContent) {
        throw new Error("Add a message, note, follow-up date, or attachment.")
      }

      const supabase = getSupabaseBrowserClient()
      const { data: attemptRow, error: attemptError } = await supabase
        .from("lead_attempts")
        .insert({
          user_id: args.userId,
          lead_id: args.leadId,
          attempt_no: args.nextAttemptNo,
          message_text: emptyToUndefined(values.messageText) ?? null,
          notes: emptyToUndefined(values.notes) ?? null,
          response_received: false,
          reminder_at: dateInputToIso(values.reminderAt),
          lead_status: values.leadStatus,
        })
        .select("id")
        .single()

      if (attemptError) throw attemptError

      const { error: leadError } = await supabase
        .from("job_leads")
        .update({ status: values.leadStatus })
        .eq("id", args.leadId)
        .eq("user_id", args.userId)
        .eq("job_id", args.jobId)

      if (leadError) throw leadError

      if (values.file) {
        const path = attachmentObjectPath(args.userId, values.file)
        const { publicUrl } = await uploadAttachmentFile({
          file: values.file,
          objectPath: path,
        })
        const { error: attachmentError } = await supabase
          .from("attachments")
          .insert({
            user_id: args.userId,
            attempt_id: attemptRow.id as string,
            file_url: publicUrl,
            file_name: values.file.name,
            content_type: values.file.type || null,
          })

        if (attachmentError) throw attachmentError
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["job-detail", args.userId, args.jobId],
      })
      void queryClient.invalidateQueries({ queryKey: ["jobs", args.userId] })
      args.onSaved()
    },
  })
}

function AddLeadForm({
  userId,
  jobId,
  onSaved,
  onCancel,
}: {
  userId: string
  jobId: string
  onSaved: () => void
  onCancel: () => void
}) {
  const [name, setName] = React.useState("")
  const [role, setRole] = React.useState("")
  const [linkedinUrl, setLinkedinUrl] = React.useState("")
  const mutation = useAddLeadMutation({
    userId,
    jobId,
    onSaved: () => {
      setName("")
      setRole("")
      setLinkedinUrl("")
      onSaved()
    },
  })

  const error = mutation.error instanceof Error ? mutation.error.message : null

  return (
    <form
      className="rounded-xl border border-border/80 bg-card p-4 shadow-xs ring-1 ring-foreground/4"
      onSubmit={(e) => {
        e.preventDefault()
        mutation.mutate({ name, role, linkedinUrl })
      }}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-heading text-sm font-semibold text-foreground">
            Add contact
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Save a recruiter, hiring manager, or referral contact for this role.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <label
            className="text-xs font-medium text-foreground"
            htmlFor="lead-name"
          >
            Name
          </label>
          <Input
            id="lead-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Hiring manager or recruiter"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label
            className="text-xs font-medium text-foreground"
            htmlFor="lead-role"
          >
            Role
          </label>
          <Input
            id="lead-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Engineering manager"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <label
            className="text-xs font-medium text-foreground"
            htmlFor="lead-linkedin"
          >
            LinkedIn
          </label>
          <Input
            id="lead-linkedin"
            type="url"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="https://linkedin.com/in/..."
          />
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save contact"}
        </Button>
      </div>
    </form>
  )
}

function AddAttemptForm({
  userId,
  jobId,
  leadId,
  nextAttemptNo,
  onSaved,
  onCancel,
}: {
  userId: string
  jobId: string
  leadId: string
  nextAttemptNo: number
  onSaved: () => void
  onCancel: () => void
}) {
  const [messageText, setMessageText] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [reminderAt, setReminderAt] = React.useState("")
  const [leadStatus, setLeadStatus] = React.useState("contacted")
  const [file, setFile] = React.useState<File | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const mutation = useAddAttemptMutation({
    userId,
    jobId,
    leadId,
    nextAttemptNo,
    onSaved: () => {
      setMessageText("")
      setNotes("")
      setReminderAt("")
      setLeadStatus("contacted")
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      onSaved()
    },
  })

  const error = mutation.error instanceof Error ? mutation.error.message : null

  return (
    <form
      className="rounded-xl border border-border/80 bg-card p-4 shadow-xs ring-1 ring-foreground/4"
      onSubmit={(e) => {
        e.preventDefault()
        mutation.mutate({ messageText, notes, reminderAt, leadStatus, file })
      }}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-heading text-sm font-semibold text-foreground">
            Add attempt
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Log a message, reminder, status change, or attached file.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5 md:col-span-2">
          <label
            className="text-xs font-medium text-foreground"
            htmlFor={`attempt-message-${leadId}`}
          >
            Message
          </label>
          <Textarea
            id={`attempt-message-${leadId}`}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="What you sent or plan to send..."
            className="min-h-[88px]"
          />
        </div>
        <div className="space-y-1.5">
          <label
            className="text-xs font-medium text-foreground"
            htmlFor={`attempt-date-${leadId}`}
          >
            Follow-up date
          </label>
          <Input
            id={`attempt-date-${leadId}`}
            type="date"
            value={reminderAt}
            onChange={(e) => setReminderAt(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">
            Outreach status
          </label>
          <Select value={leadStatus} onValueChange={setLeadStatus}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose status" />
            </SelectTrigger>
            <SelectContent>
              {LEAD_STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <label
            className="text-xs font-medium text-foreground"
            htmlFor={`attempt-notes-${leadId}`}
          >
            Notes
          </label>
          <Textarea
            id={`attempt-notes-${leadId}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Private notes for this outreach..."
            className="min-h-[76px]"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <label
            className="text-xs font-medium text-foreground"
            htmlFor={`attempt-file-${leadId}`}
          >
            Attachment
          </label>
          <Input
            ref={fileInputRef}
            id={`attempt-file-${leadId}`}
            type="file"
            className="h-10 cursor-pointer pb-1 text-muted-foreground file:me-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <p className="truncate text-xs text-muted-foreground">
              Selected: {file.name}
            </p>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save attempt"}
        </Button>
      </div>
    </form>
  )
}

function LeadPanel({
  lead,
  userId,
  jobId,
  onSaved,
}: {
  lead: JobLeadRow
  userId: string
  jobId: string
  onSaved: () => void
}) {
  const attempts = lead.lead_attempts ?? []
  const updated = formatStoredTimestamp(lead.updated_at)
  const created = formatStoredTimestamp(lead.created_at)
  const [showAttemptForm, setShowAttemptForm] = React.useState(false)

  return (
    <div className="space-y-6 pt-4 pb-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Badge variant="outline" className="text-xs font-normal">
          {leadStatusLabel(String(lead.status))}
        </Badge>
        {created ? (
          <span className="text-xs text-muted-foreground/80 tabular-nums">
            Added {created}
          </span>
        ) : null}
        {updated ? (
          <span className="text-xs text-muted-foreground/80 tabular-nums">
            · Updated {updated}
          </span>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <LeadContactRow
          icon={<MailIcon className="size-3.5" aria-hidden />}
          href={lead.email?.trim() ? `mailto:${lead.email.trim()}` : undefined}
          empty={!lead.email?.trim()}
        >
          {lead.email?.trim() || "No email"}
        </LeadContactRow>
        <LeadContactRow
          icon={<Link2Icon className="size-3.5" aria-hidden />}
          href={lead.linkedin_url?.trim() || undefined}
          external
          empty={!lead.linkedin_url?.trim()}
        >
          {lead.linkedin_url?.trim() ? "LinkedIn" : "No LinkedIn"}
        </LeadContactRow>
        <LeadContactRow
          icon={<UserRoundIcon className="size-3.5" aria-hidden />}
          href={lead.profile_url?.trim() || undefined}
          external
          empty={!lead.profile_url?.trim()}
        >
          {lead.profile_url?.trim() ? "Profile" : "No profile"}
        </LeadContactRow>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MessageSquareTextIcon
              className="size-3.5 shrink-0 text-muted-foreground/70"
              aria-hidden
            />
            <MetaLabel>Outreach attempts</MetaLabel>
            {attempts.length > 0 ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-border/80 bg-muted/40 px-1.5 text-[10px] font-semibold text-foreground tabular-nums">
                {attempts.length}
              </span>
            ) : null}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            type="button"
            onClick={() => setShowAttemptForm(true)}
          >
            <PlusIcon className="size-3.5" aria-hidden />
            Add attempt
          </Button>
        </div>
        {showAttemptForm ? (
          <AddAttemptForm
            userId={userId}
            jobId={jobId}
            leadId={lead.id}
            nextAttemptNo={attempts.length + 1}
            onSaved={() => {
              setShowAttemptForm(false)
              onSaved()
            }}
            onCancel={() => setShowAttemptForm(false)}
          />
        ) : null}
        {!attempts.length ? (
          <p className="rounded-xl border border-dashed border-border/70 bg-card/40 px-4 py-6 text-center text-sm text-muted-foreground">
            No outreach attempts recorded yet.
          </p>
        ) : (
          <div className="space-y-4">
            {attempts.map((attempt, idx) => (
              <AttemptCard
                key={attempt.id}
                attempt={attempt}
                isLast={idx === attempts.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function JobDetailDialogContent({
  job,
  open,
}: {
  job: JobRow
  open: boolean
}) {
  const { data, isPending, isError, error, refetch } = useJobDetailQuery(
    job.user_id,
    job.id,
    open
  )

  const detail = data
  const merged = detail ?? {
    ...job,
    job_leads: [] as JobLeadRow[],
    attachments: [] as AttachmentRow[],
  }

  const applied = formatStoredJobDate(merged.applied_at)
  const followUp = formatStoredJobDate(merged.reminder_at)
  const jobFiles = (merged.attachments ?? []).filter(
    (a) => a.job_id != null && a.job_id === merged.id
  )

  const showReferralBlock =
    merged.is_referred ||
    Boolean(merged.referred_by_name?.trim()) ||
    Boolean(merged.referred_by_profile_url?.trim())

  const leadDefault = merged.job_leads[0]?.id
  const leadCount = merged.job_leads.length
  const [showLeadForm, setShowLeadForm] = React.useState(false)
  const refetchDetails = React.useCallback(() => {
    void refetch()
  }, [refetch])

  return (
    <DialogContent
      showCloseButton
      className="flex max-h-[min(92vh,880px)] w-[calc(100%-1rem)] max-w-4xl flex-col gap-0 overflow-hidden rounded-xl border border-border/80 bg-card p-0 shadow-lg ring-1 ring-foreground/6 sm:w-[calc(100%-2rem)]"
    >
      {/* Header */}
      <div className="relative shrink-0 border-b border-border/80 bg-card">
        <DialogHeader className="gap-0 space-y-0 px-6 py-6 pr-14 text-left sm:px-8 sm:py-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <JobStatusBadge status={String(merged.status)} />
                  <Badge
                    variant="outline"
                    className="font-normal text-muted-foreground"
                  >
                    {jobSiteLabel(String(merged.site))}
                  </Badge>
                </div>
                <DialogTitle className="font-heading text-2xl leading-tight tracking-tight text-balance sm:text-[28px]">
                  {merged.job_title}
                </DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-pretty text-muted-foreground sm:text-[15px]">
                  <span className="font-medium text-foreground/85">
                    {merged.company_name}
                  </span>
                  {merged.location?.trim() ? (
                    <>
                      <span className="inline-flex items-center gap-1">
                        <MapPinIcon
                          className="size-3.5 shrink-0 opacity-60"
                          aria-hidden
                        />
                        {merged.location.trim()}
                      </span>
                    </>
                  ) : null}
                </DialogDescription>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2 lg:translate-x-2 lg:translate-y-8">
              <Button
                size="sm"
                variant="secondary"
                className="h-9 gap-1.5 px-3.5 text-xs"
                asChild
              >
                <Link href={`/jobs/${merged.id}/edit`}>
                  <PencilIcon className="size-3.5" aria-hidden />
                  Edit
                </Link>
              </Button>
              {merged.job_url ? (
                <Button
                  size="sm"
                  className="h-9 gap-1.5 px-3.5 text-xs"
                  asChild
                >
                  <a
                    href={merged.job_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <LinkIcon className="size-3.5" aria-hidden />
                    View posting
                  </a>
                </Button>
              ) : null}
              {merged.resume_url ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 gap-1.5 px-3.5 text-xs"
                  asChild
                >
                  <a
                    href={merged.resume_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileTextIcon className="size-3.5" aria-hidden />
                    Resume used
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </DialogHeader>
      </div>

      {/* Scrollable body — recessed surface so cards POP */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-background px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto grid max-w-3xl gap-8">
          {/* Quick-info stat tiles */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Applied on"
              icon={<CalendarIcon className="size-3.5" aria-hidden />}
            >
              {applied ?? <EmptyHint>Not set</EmptyHint>}
            </StatTile>
            <StatTile
              label="Follow-up"
              icon={<BellIcon className="size-3.5" aria-hidden />}
            >
              {followUp ?? <EmptyHint>None</EmptyHint>}
            </StatTile>

            <StatTile
              label="Resume"
              icon={<FileTextIcon className="size-3.5" aria-hidden />}
            >
              {merged.resume_url?.trim() ? (
                <OutLink href={merged.resume_url.trim()} label="Open file" />
              ) : (
                <EmptyHint>Not attached</EmptyHint>
              )}
            </StatTile>
          </div>

          {/* Notes */}
          <Section
            title="Notes"
            description="Context, reminders, and next actions."
          >
            <div className="relative rounded-xl border border-border/80 bg-card px-4 py-4 shadow-xs ring-1 ring-foreground/4 sm:px-5 sm:py-5">
              {merged.notes?.trim() ? (
                <div className="relative">
                  <span
                    aria-hidden
                    className="absolute top-1 bottom-1 left-0 w-[2px] rounded-full bg-foreground/25"
                  />
                  <p className="pl-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                    {merged.notes}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground/65">
                  No notes added for this application.
                </p>
              )}
            </div>
          </Section>

          {/* Job attachments */}
          {jobFiles.length ? (
            <Section
              title="Attachments"
              description="Files attached to this application."
            >
              <AttachmentLinks items={jobFiles} />
            </Section>
          ) : null}

          {/* Networking */}
          <Section
            title="Networking"
            description="Contacts and outreach tied to this role."
            action={
              !isPending && !isError ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-2.5 py-1 text-[11px] font-medium text-foreground tabular-nums shadow-xs">
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full bg-foreground/70"
                    />
                    {leadCount} contact{leadCount === 1 ? "" : "s"}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs"
                    type="button"
                    onClick={() => setShowLeadForm(true)}
                  >
                    <PlusIcon className="size-3.5" aria-hidden />
                    Add contact
                  </Button>
                </div>
              ) : null
            }
          >
            {isError ? (
              <div className="rounded-xl border border-destructive/35 bg-destructive/5 px-4 py-4 ring-1 ring-destructive/15">
                <p className="text-sm font-medium text-destructive">
                  {error instanceof Error
                    ? error.message
                    : "Could not load contacts and outreach."}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => void refetch()}
                >
                  Retry
                </Button>
              </div>
            ) : null}

            {isPending ? (
              <div
                className="flex items-center gap-3 rounded-xl border border-border/80 bg-card px-4 py-6 text-sm text-muted-foreground shadow-xs ring-1 ring-foreground/4"
                role="status"
                aria-label="Loading contacts"
              >
                <Loader2Icon
                  className="size-4 shrink-0 animate-spin"
                  aria-hidden
                />
                Loading contacts and attempts…
              </div>
            ) : null}

            {!isPending && !isError && showLeadForm ? (
              <AddLeadForm
                userId={merged.user_id}
                jobId={merged.id}
                onSaved={() => {
                  setShowLeadForm(false)
                  refetchDetails()
                }}
                onCancel={() => setShowLeadForm(false)}
              />
            ) : null}

            {!isPending && !isError && leadCount === 0 && !showLeadForm ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
                <span className="flex size-11 items-center justify-center rounded-xl border border-border/80 bg-card text-muted-foreground shadow-xs ring-1 ring-foreground/4">
                  <UserRoundIcon className="size-5" aria-hidden />
                </span>
                <p className="text-sm text-muted-foreground">
                  No networking contacts linked to this job yet.
                </p>
                <Button
                  size="sm"
                  className="gap-1.5"
                  type="button"
                  onClick={() => setShowLeadForm(true)}
                >
                  <PlusIcon className="size-4" aria-hidden />
                  Add first contact
                </Button>
              </div>
            ) : null}

            {!isPending && !isError && leadCount > 0 ? (
              <Accordion
                type="single"
                collapsible
                defaultValue={leadDefault}
                className="w-full space-y-2"
              >
                {merged.job_leads.map((lead) => {
                  const attemptCount = lead.lead_attempts?.length ?? 0
                  return (
                    <AccordionItem
                      key={lead.id}
                      value={lead.id}
                      className="overflow-hidden rounded-xl border border-border/80 bg-card px-0 shadow-xs ring-1 ring-foreground/4"
                    >
                      <AccordionTrigger className="px-4 py-3.5 hover:bg-muted/15 hover:no-underline data-[state=open]:border-b data-[state=open]:border-border/80">
                        <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-sm font-bold tracking-tight text-background shadow-sm">
                            {lead.name.trim().charAt(0).toUpperCase() || "?"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {lead.name}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {lead.role?.trim() || "Role not set"}
                            </p>
                          </div>
                          {attemptCount > 0 ? (
                            <span className="mr-1 hidden items-center gap-1.5 rounded-full border border-border/80 bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums sm:inline-flex">
                              <MessageSquareTextIcon
                                className="size-3 shrink-0 opacity-70"
                                aria-hidden
                              />
                              {attemptCount}
                            </span>
                          ) : null}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="bg-background px-4 pb-5 sm:px-5">
                        <LeadPanel
                          lead={lead}
                          userId={merged.user_id}
                          jobId={merged.id}
                          onSaved={refetchDetails}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  )
                })}
              </Accordion>
            ) : null}
          </Section>
        </div>
      </div>
    </DialogContent>
  )
}
