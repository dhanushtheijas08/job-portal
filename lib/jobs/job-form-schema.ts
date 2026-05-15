import { z } from "zod"

import {
  JOB_SITES,
  JOB_STATUSES,
  LEAD_STATUSES,
  type LeadStatus,
} from "@/lib/jobs/constants"
import { todayYmd } from "@/lib/jobs/dates"

const siteValues = JOB_SITES.map((s) => s.value) as [string, ...string[]]
const statusValues = JOB_STATUSES.map((s) => s.value) as [string, ...string[]]
const leadStatusValues = LEAD_STATUSES.map((s) => s.value) as [
  string,
  ...string[],
]

export const MAX_JOB_LEADS = 20
export const MAX_ATTEMPTS_PER_LEAD = 15

export function emptyToUndefined(s: string | undefined) {
  const t = s?.trim()
  return t ? t : undefined
}

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

/** One saved row in `lead_attempts` per filled attempt (within a contact). */
export const leadAttemptFormSchema = z.object({
  /** Maps to `lead_attempts.message_text`. */
  message_text: z.string().max(8000),
  notes: z.string().max(8000),
  /** YYYY-MM-DD → `lead_attempts.reminder_at`. */
  reminder_at: z.string(),
  lead_status: z.enum(leadStatusValues),
})

export type LeadAttemptFormValues = z.infer<typeof leadAttemptFormSchema>

/** One saved row in `job_leads` when `contact_name` is filled. */
export const jobLeadFormSchema = z.object({
  contact_name: z.string().max(200),
  role: z.string().max(200),
  linkedin_url: z.string().max(2000),
  attempts: z
    .array(leadAttemptFormSchema)
    .min(1, "Each contact needs at least one outreach row.")
    .max(MAX_ATTEMPTS_PER_LEAD),
})

export type JobLeadFormValues = z.infer<typeof jobLeadFormSchema>

export function emptyLeadAttemptForm(): LeadAttemptFormValues {
  return {
    message_text: "",
    notes: "",
    reminder_at: "",
    lead_status: "not_contacted",
  }
}

export function emptyJobLeadForm(): JobLeadFormValues {
  return {
    contact_name: "",
    role: "",
    linkedin_url: "",
    attempts: [emptyLeadAttemptForm()],
  }
}

export function attemptHasOutboundContent(att: LeadAttemptFormValues): boolean {
  return Boolean(
    emptyToUndefined(att.message_text) ||
      emptyToUndefined(att.notes) ||
      emptyToUndefined(att.reminder_at)
  )
}

export const jobFormSchema = z
  .object({
    job_title: z.string().min(1, "Title is required").max(200),
    company_name: z.string().min(1, "Company is required").max(200),
    job_url: z.string().max(2000).optional(),
    site: z.enum(siteValues),
    status: z.enum(statusValues),
    applied_at: z.string().optional(),
    reminder_at: z.string().optional(),
    is_referred: z.boolean(),
    referred_by_name: z.string().max(200).optional(),
    referred_by_profile_url: z.string().max(2000).optional(),
    location: z.string().max(200).optional(),
    notes: z.string().max(8000).optional(),
    job_leads: z.array(jobLeadFormSchema).max(MAX_JOB_LEADS),
  })
  .superRefine((data, ctx) => {
    const url = emptyToUndefined(data.job_url)
    if (url && !isHttpUrl(url)) {
      ctx.addIssue({
        code: "custom",
        path: ["job_url"],
        message: "Enter a valid URL",
      })
    }
    const refUrl = emptyToUndefined(data.referred_by_profile_url)
    if (refUrl && !isHttpUrl(refUrl)) {
      ctx.addIssue({
        code: "custom",
        path: ["referred_by_profile_url"],
        message: "Enter a valid URL",
      })
    }

    data.job_leads.forEach((lead, li) => {
      const linkedin = emptyToUndefined(lead.linkedin_url)
      if (linkedin && !isHttpUrl(linkedin)) {
        ctx.addIssue({
          code: "custom",
          path: ["job_leads", li, "linkedin_url"],
          message: "Enter a valid URL",
        })
      }

      const leadName = emptyToUndefined(lead.contact_name)
      lead.attempts.forEach((att, ai) => {
        if (!attemptHasOutboundContent(att)) return
        if (!leadName) {
          ctx.addIssue({
            code: "custom",
            path: ["job_leads", li, "contact_name"],
            message:
              "Add a contact name when you record outreach notes, reminders, or a message.",
          })
        }
      })
    })
  })

export type JobFormValues = z.infer<typeof jobFormSchema>

export function getJobFormDefaults(): JobFormValues {
  return {
    job_title: "",
    company_name: "",
    job_url: "",
    site: "linkedin",
    status: "applied",
    applied_at: todayYmd(),
    reminder_at: "",
    is_referred: false,
    referred_by_name: "",
    referred_by_profile_url: "",
    location: "",
    notes: "",
    job_leads: [emptyJobLeadForm()],
  }
}

/** Last substantive attempt determines stored `job_leads.status`; none → not_contacted. */
export function rollUpLeadAggregateStatus(args: {
  attemptsWithContent: Pick<LeadAttemptFormValues, "lead_status">[]
}): LeadStatus {
  const rows = args.attemptsWithContent
  if (rows.length === 0) return "not_contacted"
  return rows.at(-1)!.lead_status as LeadStatus
}

export function toJobInsertPayload(values: JobFormValues, userId: string) {
  const appliedRaw = values.applied_at?.trim()
  const applied_at = appliedRaw
    ? new Date(`${appliedRaw}T12:00:00`).toISOString()
    : null

  const reminderRaw = values.reminder_at?.trim()
  const reminder_at = reminderRaw
    ? new Date(`${reminderRaw}T12:00:00`).toISOString()
    : null

  return {
    user_id: userId,
    job_title: values.job_title.trim(),
    company_name: values.company_name.trim(),
    job_url: emptyToUndefined(values.job_url) ?? null,
    site: values.site,
    status: values.status,
    applied_at,
    reminder_at,
    is_referred: values.is_referred,
    referred_by_name: emptyToUndefined(values.referred_by_name) ?? null,
    referred_by_profile_url:
      emptyToUndefined(values.referred_by_profile_url) ?? null,
    location: emptyToUndefined(values.location) ?? null,
    notes: emptyToUndefined(values.notes) ?? null,
  }
}
