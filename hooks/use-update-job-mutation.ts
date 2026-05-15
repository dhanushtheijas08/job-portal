"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import {
  attemptHasOutboundContent,
  emptyToUndefined,
  rollUpLeadAggregateStatus,
  toJobInsertPayload,
  type JobFormValues,
  type LeadAttemptFormValues,
} from "@/lib/jobs/job-form-schema"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { uploadAttachmentFile } from "@/lib/supabase/upload-job-attachment"
import { normalizeResumeEntriesFromDb } from "@/lib/users/profile-schema"

export type UpdateJobWithFilesInput = {
  values: JobFormValues
  attemptAttachments: (File | null)[][]
}

type ExistingAttempt = { id: string; lead_id: string }
type ExistingLead = { id: string; lead_attempts?: ExistingAttempt[] }

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

function attemptReminderIso(reminderRaw: string | undefined): string | null {
  const r = reminderRaw?.trim()
  return r ? new Date(`${r}T12:00:00`).toISOString() : null
}

function buildAttemptPayload(
  userId: string,
  leadId: string,
  attemptNo: number,
  att: LeadAttemptFormValues
) {
  return {
    user_id: userId,
    lead_id: leadId,
    attempt_no: attemptNo,
    message_text: emptyToUndefined(att.message_text) ?? null,
    notes: emptyToUndefined(att.notes) ?? null,
    reminder_at: attemptReminderIso(att.reminder_at),
    lead_status: att.lead_status,
  }
}

function isExistingLead(
  leadId: string | undefined,
  existingByLeadId: Map<string, ExistingLead>
) {
  return Boolean(leadId && existingByLeadId.has(leadId))
}

function isExistingAttempt(
  attemptId: string | undefined,
  existingAttemptsById: Map<string, ExistingAttempt>,
  leadId: string
) {
  const existing = attemptId ? existingAttemptsById.get(attemptId) : undefined
  return Boolean(existing && existing.lead_id === leadId)
}

async function assertResumeAllowed(
  userId: string,
  resumeUrl: string | undefined
) {
  const url = emptyToUndefined(resumeUrl)
  if (!url) return

  const supabase = getSupabaseBrowserClient()
  const { data: userRow, error } = await supabase
    .from("users")
    .select("resumes")
    .eq("id", userId)
    .single()

  if (error) throw error

  const allowed = new Set(
    normalizeResumeEntriesFromDb(userRow?.resumes).map((r) => r.url.trim())
  )

  if (!allowed.has(url)) {
    throw new Error(
      "Choose a resume from your profile (Settings), or leave the field empty."
    )
  }
}

export function useUpdateJobMutation(
  userId: string | undefined,
  jobId: string | undefined
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      values,
      attemptAttachments,
    }: UpdateJobWithFilesInput) => {
      if (!userId) throw new Error("You must be signed in to edit this job.")
      if (!jobId) throw new Error("Missing job id.")

      for (let li = 0; li < attemptAttachments.length; li++) {
        const row = attemptAttachments[li]
        if (!row?.some(Boolean)) continue
        const leadName = emptyToUndefined(values.job_leads[li]?.contact_name)
        if (!leadName) {
          throw new Error(
            "Add a contact name for every row that has an outreach attachment."
          )
        }
      }

      await assertResumeAllowed(userId, values.resume_url)

      const supabase = getSupabaseBrowserClient()
      const { data: existingRows, error: existingError } = await supabase
        .from("job_leads")
        .select("id, lead_attempts ( id, lead_id )")
        .eq("user_id", userId)
        .eq("job_id", jobId)

      if (existingError) throw existingError

      const existingLeads = (existingRows ?? []) as ExistingLead[]
      const existingByLeadId = new Map(
        existingLeads.map((lead) => [lead.id, lead])
      )
      const existingAttemptsById = new Map<string, ExistingAttempt>()
      for (const lead of existingLeads) {
        for (const attempt of lead.lead_attempts ?? []) {
          existingAttemptsById.set(attempt.id, attempt)
        }
      }

      const { error: jobError } = await supabase
        .from("jobs")
        .update(toJobInsertPayload(values, userId))
        .eq("id", jobId)
        .eq("user_id", userId)

      if (jobError) throw jobError

      const keptLeadIds = new Set<string>()

      for (let li = 0; li < values.job_leads.length; li++) {
        const lead = values.job_leads[li]!
        const leadName = emptyToUndefined(lead.contact_name)
        if (!leadName) continue

        const leadFiles = attemptAttachments[li] ?? []
        type SubstantiveMeta = {
          att: LeadAttemptFormValues
          attemptUiIndex: number
        }
        const substantive: SubstantiveMeta[] = []
        lead.attempts.forEach((att, ai) => {
          const hasFile = Boolean(leadFiles[ai])
          if (!attemptHasOutboundContent(att) && !hasFile) return
          substantive.push({ att, attemptUiIndex: ai })
        })

        const aggregateStatus = rollUpLeadAggregateStatus({
          attemptsWithContent: substantive.map((s) => s.att),
        })

        let leadId = lead.id
        if (isExistingLead(leadId, existingByLeadId)) {
          const { error: leadError } = await supabase
            .from("job_leads")
            .update({
              name: leadName,
              role: emptyToUndefined(lead.role) ?? null,
              linkedin_url: emptyToUndefined(lead.linkedin_url) ?? null,
              status: aggregateStatus,
            })
            .eq("id", leadId!)
            .eq("user_id", userId)
            .eq("job_id", jobId)

          if (leadError) throw leadError
        } else {
          const { data: leadRow, error: leadError } = await supabase
            .from("job_leads")
            .insert({
              user_id: userId,
              job_id: jobId,
              name: leadName,
              role: emptyToUndefined(lead.role) ?? null,
              linkedin_url: emptyToUndefined(lead.linkedin_url) ?? null,
              profile_url: null,
              email: null,
              status: aggregateStatus,
            })
            .select("id")
            .single()

          if (leadError) throw leadError
          leadId = leadRow.id as string
        }

        keptLeadIds.add(leadId!)

        let attemptNo = 1
        const keptAttemptIds = new Set<string>()
        for (const { att, attemptUiIndex } of substantive) {
          let attemptId = att.id
          const payload = buildAttemptPayload(userId, leadId!, attemptNo++, att)

          if (isExistingAttempt(attemptId, existingAttemptsById, leadId!)) {
            const { error: attemptError } = await supabase
              .from("lead_attempts")
              .update(payload)
              .eq("id", attemptId!)
              .eq("user_id", userId)
              .eq("lead_id", leadId!)

            if (attemptError) throw attemptError
          } else {
            const { data: attemptRow, error: attemptError } = await supabase
              .from("lead_attempts")
              .insert({ ...payload, response_received: false })
              .select("id")
              .single()

            if (attemptError) throw attemptError
            attemptId = attemptRow.id as string
          }

          keptAttemptIds.add(attemptId!)

          const file = leadFiles[attemptUiIndex] ?? null
          if (!file) continue

          const path = attachmentObjectPath(userId, file)
          const { publicUrl } = await uploadAttachmentFile({
            file,
            objectPath: path,
          })
          const { error: attachmentError } = await supabase
            .from("attachments")
            .insert({
              user_id: userId,
              attempt_id: attemptId,
              file_url: publicUrl,
              file_name: file.name,
              content_type: file.type || null,
            })

          if (attachmentError) throw attachmentError
        }

        const existingForLead =
          existingByLeadId.get(leadId!)?.lead_attempts ?? []
        const staleAttemptIds = existingForLead
          .map((attempt) => attempt.id)
          .filter((id) => !keptAttemptIds.has(id))

        if (staleAttemptIds.length) {
          const { error: attachmentDeleteError } = await supabase
            .from("attachments")
            .delete()
            .eq("user_id", userId)
            .in("attempt_id", staleAttemptIds)
          if (attachmentDeleteError) throw attachmentDeleteError

          const { error: attemptDeleteError } = await supabase
            .from("lead_attempts")
            .delete()
            .eq("user_id", userId)
            .in("id", staleAttemptIds)
          if (attemptDeleteError) throw attemptDeleteError
        }
      }

      const staleLeadIds = existingLeads
        .map((lead) => lead.id)
        .filter((id) => !keptLeadIds.has(id))

      if (staleLeadIds.length) {
        const staleAttemptIds = existingLeads
          .filter((lead) => staleLeadIds.includes(lead.id))
          .flatMap(
            (lead) => lead.lead_attempts?.map((attempt) => attempt.id) ?? []
          )

        if (staleAttemptIds.length) {
          const { error: attachmentDeleteError } = await supabase
            .from("attachments")
            .delete()
            .eq("user_id", userId)
            .in("attempt_id", staleAttemptIds)
          if (attachmentDeleteError) throw attachmentDeleteError

          const { error: attemptDeleteError } = await supabase
            .from("lead_attempts")
            .delete()
            .eq("user_id", userId)
            .in("id", staleAttemptIds)
          if (attemptDeleteError) throw attemptDeleteError
        }

        const { error: leadDeleteError } = await supabase
          .from("job_leads")
          .delete()
          .eq("user_id", userId)
          .eq("job_id", jobId)
          .in("id", staleLeadIds)
        if (leadDeleteError) throw leadDeleteError
      }

      return { jobId }
    },
    onSuccess: () => {
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: ["jobs", userId] })
        void queryClient.invalidateQueries({
          queryKey: ["job-detail", userId, jobId],
        })
        void queryClient.invalidateQueries({ queryKey: ["job-detail", userId] })
      }
    },
  })
}
