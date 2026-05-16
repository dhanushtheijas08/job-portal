"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form"

import { JobLeadsStepFields } from "@/components/dashboard/job-leads-step-fields"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAuthSession } from "@/hooks/use-auth-session"
import { useCreateJobMutation } from "@/hooks/use-create-job-mutation"
import { useUpdateJobMutation } from "@/hooks/use-update-job-mutation"
import { useUserProfileQuery } from "@/hooks/use-user-profile-query"
import { JOB_SITES, JOB_STATUSES } from "@/lib/jobs/constants"
import { formatYmdFromDate, parseYmdToLocalDate } from "@/lib/jobs/dates"
import {
  getJobFormDefaults,
  jobFormSchema,
  type JobFormValues,
} from "@/lib/jobs/job-form-schema"
import { sortResumesByLastUsedDesc } from "@/lib/users/profile-schema"
import { cn } from "@/lib/utils"

const STEP_TITLES = ["Application", "Outreach & referral"] as const

const STEP_FIELDS: FieldPath<JobFormValues>[][] = [
  [
    "job_title",
    "company_name",
    "job_url",
    "location",
    "status",
    "applied_at",
    "reminder_at",
    "site",
    "resume_url",
    "notes",
  ],
  ["job_leads", "is_referred", "referred_by_name", "referred_by_profile_url"],
]

const LAST_STEP = STEP_TITLES.length - 1

const NO_JOB_RESUME_VALUE = "__none__"

type JobFormMode = "create" | "edit"

type NewJobFormProps = {
  mode?: JobFormMode
  jobId?: string
  initialValues?: JobFormValues
  initialStep?: number
}

function RequiredMark() {
  return (
    <span className="ms-0.5 text-red-500" aria-hidden>
      *
    </span>
  )
}

function formatAppliedDisplay(value: string): string {
  const d = parseYmdToLocalDate(value)
  if (!d) return value
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d)
}

export function NewJobForm({
  mode = "create",
  jobId,
  initialValues,
  initialStep = 0,
}: NewJobFormProps = {}) {
  const router = useRouter()
  const { data: session } = useAuthSession()
  const userId = session?.user.id
  const { data: profile, isPending: profileResumesLoading } =
    useUserProfileQuery(userId)

  const sortedProfileResumes = useMemo(
    () =>
      sortResumesByLastUsedDesc(profile?.resumes ?? []).filter((r) =>
        r.url.trim()
      ),
    [profile?.resumes]
  )

  const formDefaults = useMemo(
    () => initialValues ?? getJobFormDefaults(),
    [initialValues]
  )

  const [step, setStep] = useState(() =>
    Math.min(Math.max(initialStep, 0), LAST_STEP)
  )
  const [appliedOpen, setAppliedOpen] = useState(false)
  const [reminderOpen, setReminderOpen] = useState(false)
  const [attemptAttachments, setAttemptAttachments] = useState<
    (File | null)[][]
  >(() => formDefaults.job_leads.map((lead) => lead.attempts.map(() => null)))

  const patchAttemptFile = useCallback(
    (leadIndex: number, attemptIndex: number, file: File | null) => {
      setAttemptAttachments((prev) => {
        const out = prev.map((row) => [...row])
        while (out.length <= leadIndex) {
          out.push([])
        }
        const row = [...out[leadIndex]!]
        while (row.length <= attemptIndex) {
          row.push(null)
        }
        row[attemptIndex] = file
        out[leadIndex] = row
        return out
      })
    },
    []
  )

  const handleAfterAppendLeadRow = useCallback(() => {
    setAttemptAttachments((prev) => [...prev, [null]])
  }, [])

  const handleAfterRemoveLeadRow = useCallback((leadIndex: number) => {
    setAttemptAttachments((prev) => prev.filter((_, i) => i !== leadIndex))
  }, [])

  const handleAfterAppendAttemptRow = useCallback((leadIndex: number) => {
    setAttemptAttachments((prev) =>
      prev.map((row, i) => (i === leadIndex ? [...row, null] : row))
    )
  }, [])

  const handleAfterRemoveAttemptRow = useCallback(
    (leadIndex: number, attemptIndex: number) => {
      setAttemptAttachments((prev) =>
        prev.map((row, i) =>
          i === leadIndex ? row.filter((_, j) => j !== attemptIndex) : row
        )
      )
    },
    []
  )

  const {
    control,
    handleSubmit,
    reset: resetForm,
    setError,
    clearErrors,
    trigger,
    formState: { isSubmitting },
  } = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: formDefaults,
  })

  const isReferred = useWatch({ control, name: "is_referred" })
  const createMutation = useCreateJobMutation(userId)
  const updateMutation = useUpdateJobMutation(userId, jobId)
  const activeMutation = mode === "edit" ? updateMutation : createMutation

  async function goNext() {
    clearErrors()
    const ok = await trigger(STEP_FIELDS[step] ?? [], { shouldFocus: true })
    if (!ok) return
    setStep((s) => Math.min(s + 1, LAST_STEP))
  }

  function goBack() {
    clearErrors()
    setStep((s) => Math.max(s - 1, 0))
  }

  async function onSubmit(values: JobFormValues) {
    clearErrors()
    for (
      let li = 0;
      li < Math.max(attemptAttachments.length, values.job_leads.length);
      li++
    ) {
      if (!attemptAttachments[li]?.some(Boolean)) continue
      if (!values.job_leads[li]?.contact_name?.trim()) {
        setError(`job_leads.${li}.contact_name`, {
          message:
            "Add a contact name when you attach a file on an outreach attempt.",
        })
        setStep(1)
        return
      }
    }

    await activeMutation
      .mutateAsync({
        values,
        attemptAttachments,
      })
      .then(() => {
        if (mode === "create") {
          const nextDefaults = getJobFormDefaults()
          resetForm(nextDefaults)
          setAttemptAttachments(
            nextDefaults.job_leads.map((lead) => lead.attempts.map(() => null))
          )
        }
        setStep(0)
        router.push("/")
        router.refresh()
      })
      .catch(() => {
        /* surfaced via mutation error state */
      })
  }

  const busy = isSubmitting || activeMutation.isPending
  const formError =
    activeMutation.isError && activeMutation.error instanceof Error
      ? activeMutation.error.message
      : null
  const formTitle = mode === "edit" ? "Edit job tracking" : "Track a new job"
  const saveLabel = mode === "edit" ? "Update application" : "Save application"
  const savingLabel = mode === "edit" ? "Updating…" : "Saving…"

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-4 space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">
          {formTitle}
        </h1>
      </header>

      <div
        className="mb-8 space-y-3"
        aria-label="Form progress"
        role="navigation"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-medium text-muted-foreground">
            Step {step + 1} of {STEP_TITLES.length}
          </p>
          <p className="font-heading text-lg font-semibold text-foreground sm:text-right">
            {STEP_TITLES[step]}
          </p>
        </div>
        <div className="flex gap-1.5" aria-hidden>
          {STEP_TITLES.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 min-w-0 flex-1 rounded-full transition-colors",
                i <= step ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>

      <form
        className="space-y-8"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        <FieldSet className="flex flex-col gap-0">
          <div
            className={cn(step === 0 ? "block" : "hidden")}
            aria-hidden={step !== 0}
          >
            <div className="flex flex-col gap-8">
              <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 md:items-start">
                <Controller
                  name="job_title"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field
                      className="min-w-0"
                      data-invalid={fieldState.invalid}
                    >
                      <FieldLabel htmlFor="job-title">
                        Job title
                        <RequiredMark />
                      </FieldLabel>
                      <FieldContent>
                        <Input
                          id="job-title"
                          autoComplete="organization-title"
                          placeholder="Senior frontend engineer"
                          required
                          aria-required
                          {...field}
                        />
                        <FieldError errors={[fieldState.error]} />
                      </FieldContent>
                    </Field>
                  )}
                />
                <Controller
                  name="company_name"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field
                      className="min-w-0"
                      data-invalid={fieldState.invalid}
                    >
                      <FieldLabel htmlFor="company-name">
                        Company
                        <RequiredMark />
                      </FieldLabel>
                      <FieldContent>
                        <Input
                          id="company-name"
                          autoComplete="organization"
                          placeholder="Acme Inc."
                          required
                          aria-required
                          {...field}
                        />
                        <FieldError errors={[fieldState.error]} />
                      </FieldContent>
                    </Field>
                  )}
                />
                <Controller
                  name="job_url"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field
                      className="min-w-0"
                      data-invalid={fieldState.invalid}
                    >
                      <FieldLabel htmlFor="job-url">Posting URL</FieldLabel>
                      <FieldContent>
                        <Input
                          id="job-url"
                          type="url"
                          inputMode="url"
                          placeholder="https://"
                          {...field}
                        />
                        <FieldError errors={[fieldState.error]} />
                      </FieldContent>
                    </Field>
                  )}
                />
                <Controller
                  name="location"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field
                      className="min-w-0"
                      data-invalid={fieldState.invalid}
                    >
                      <FieldLabel htmlFor="location">Location</FieldLabel>
                      <FieldContent>
                        <Input
                          id="location"
                          placeholder="Remote • Berlin • Hybrid"
                          {...field}
                        />
                        <FieldError errors={[fieldState.error]} />
                      </FieldContent>
                    </Field>
                  )}
                />
                <Controller
                  name="status"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field
                      className="min-w-0"
                      data-invalid={fieldState.invalid}
                    >
                      <FieldLabel>
                        Status
                        <RequiredMark />
                      </FieldLabel>
                      <FieldContent>
                        <Select
                          required
                          value={field.value}
                          onValueChange={field.onChange}
                          defaultValue={JOB_STATUSES[0].value}
                        >
                          <SelectTrigger
                            className="w-full"
                            aria-invalid={fieldState.invalid}
                            aria-required
                          >
                            <SelectValue placeholder="Choose status" />
                          </SelectTrigger>
                          <SelectContent>
                            {JOB_STATUSES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldError errors={[fieldState.error]} />
                      </FieldContent>
                    </Field>
                  )}
                />
                <Controller
                  name="site"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field
                      className="min-w-0"
                      data-invalid={fieldState.invalid}
                    >
                      <FieldLabel>
                        Source
                        <RequiredMark />
                      </FieldLabel>
                      <FieldContent>
                        <Select
                          required
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger
                            className="w-full"
                            aria-invalid={fieldState.invalid}
                            aria-required
                          >
                            <SelectValue placeholder="Choose a source" />
                          </SelectTrigger>
                          <SelectContent>
                            {JOB_SITES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldError errors={[fieldState.error]} />
                      </FieldContent>
                    </Field>
                  )}
                />
                <Controller
                  name="applied_at"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field
                      className="min-w-0"
                      data-invalid={fieldState.invalid}
                    >
                      <FieldLabel htmlFor="applied-at-trigger">
                        Applied on
                      </FieldLabel>

                      <FieldContent>
                        <div className="flex w-full flex-col gap-2">
                          <Popover
                            open={appliedOpen}
                            onOpenChange={setAppliedOpen}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                id="applied-at-trigger"
                                type="button"
                                variant="outline"
                                aria-invalid={fieldState.invalid}
                                className={cn(
                                  "h-9 w-full justify-start gap-2 font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon
                                  className="size-4 shrink-0 opacity-70"
                                  aria-hidden
                                />
                                {field.value ? (
                                  formatAppliedDisplay(field.value ?? "")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0"
                              align="start"
                            >
                              <Calendar
                                mode="single"
                                selected={parseYmdToLocalDate(
                                  field.value ?? ""
                                )}
                                onSelect={(d) => {
                                  field.onChange(d ? formatYmdFromDate(d) : "")
                                  setAppliedOpen(false)
                                }}
                                defaultMonth={
                                  parseYmdToLocalDate(field.value ?? "") ??
                                  new Date()
                                }
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <FieldError errors={[fieldState.error]} />
                      </FieldContent>
                    </Field>
                  )}
                />
                <Controller
                  name="reminder_at"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field
                      className="min-w-0"
                      data-invalid={fieldState.invalid}
                    >
                      <FieldLabel htmlFor="reminder-at-trigger">
                        Follow up
                      </FieldLabel>
                      <FieldContent>
                        <div className="flex w-full flex-col gap-2">
                          <Popover
                            open={reminderOpen}
                            onOpenChange={setReminderOpen}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                id="reminder-at-trigger"
                                type="button"
                                variant="outline"
                                aria-invalid={fieldState.invalid}
                                className={cn(
                                  "h-9 w-full justify-start gap-2 font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon
                                  className="size-4 shrink-0 opacity-70"
                                  aria-hidden
                                />
                                {field.value ? (
                                  formatAppliedDisplay(field.value ?? "")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0"
                              align="start"
                            >
                              <Calendar
                                mode="single"
                                selected={parseYmdToLocalDate(
                                  field.value ?? ""
                                )}
                                onSelect={(d) => {
                                  field.onChange(d ? formatYmdFromDate(d) : "")
                                  setReminderOpen(false)
                                }}
                                defaultMonth={
                                  parseYmdToLocalDate(field.value ?? "") ??
                                  new Date()
                                }
                              />
                            </PopoverContent>
                          </Popover>
                        </div>

                        <FieldError errors={[fieldState.error]} />
                      </FieldContent>
                    </Field>
                  )}
                />
              </div>
              <Controller
                name="resume_url"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="job-resume-select">Resume</FieldLabel>
                    <FieldContent>
                      {sortedProfileResumes.length === 0 &&
                      !profileResumesLoading ? (
                        <p
                          id="job-resume-select"
                          className="text-sm leading-relaxed text-muted-foreground"
                        >
                          Upload at least one resume in{" "}
                          <Link
                            href="/settings"
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                          >
                            Settings
                          </Link>{" "}
                          to attach it here. We store its URL on the job row.
                        </p>
                      ) : (
                        <Select
                          value={
                            field.value?.trim()
                              ? field.value
                              : NO_JOB_RESUME_VALUE
                          }
                          onValueChange={(v) =>
                            field.onChange(v === NO_JOB_RESUME_VALUE ? "" : v)
                          }
                          disabled={profileResumesLoading}
                        >
                          <SelectTrigger
                            id="job-resume-select"
                            className="w-full"
                            aria-invalid={fieldState.invalid}
                          >
                            <SelectValue
                              placeholder={
                                profileResumesLoading
                                  ? "Loading resumes…"
                                  : "Choose a resume (most recently used first)"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_JOB_RESUME_VALUE}>
                              None
                            </SelectItem>
                            {sortedProfileResumes.map((r) => (
                              <SelectItem key={r.id} value={r.url.trim()}>
                                {r.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <FieldError errors={[fieldState.error]} />
                    </FieldContent>
                  </Field>
                )}
              />
              <Controller
                name="notes"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="notes">Notes</FieldLabel>
                    <FieldContent>
                      <Textarea
                        id="notes"
                        rows={5}
                        placeholder="Interview prep, salary range, next steps…"
                        className="min-h-[140px] resize-y"
                        {...field}
                      />
                      <FieldError errors={[fieldState.error]} />
                    </FieldContent>
                  </Field>
                )}
              />
            </div>
          </div>

          <div
            className={cn(step === 1 ? "block" : "hidden")}
            aria-hidden={step !== 1}
          >
            <div className="flex flex-col gap-8">
              <JobLeadsStepFields
                control={control}
                attemptAttachments={attemptAttachments}
                onPatchAttemptFile={patchAttemptFile}
                onAfterAppendLead={handleAfterAppendLeadRow}
                onAfterRemoveLead={handleAfterRemoveLeadRow}
                onAfterAppendAttempt={handleAfterAppendAttemptRow}
                onAfterRemoveAttempt={handleAfterRemoveAttemptRow}
              />

              <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 md:items-start">
                <Controller
                  name="is_referred"
                  control={control}
                  render={({ field }) => (
                    <Field className="md:col-span-2" orientation="horizontal">
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(v) => field.onChange(v === true)}
                        id="is-referred"
                        aria-describedby="is-referred-description"
                        className="mt-0.5"
                      />
                      <FieldContent>
                        <FieldLabel htmlFor="is-referred">Referred</FieldLabel>
                        <p
                          id="is-referred-description"
                          className="text-sm leading-snug text-muted-foreground"
                        >
                          Check if someone referred you to this role.
                        </p>
                      </FieldContent>
                    </Field>
                  )}
                />
                {isReferred ? (
                  <>
                    <Controller
                      name="referred_by_name"
                      control={control}
                      render={({ field, fieldState }) => (
                        <Field
                          className="min-w-0"
                          data-invalid={fieldState.invalid}
                        >
                          <FieldLabel htmlFor="referrer-name">
                            Referrer name
                          </FieldLabel>
                          <FieldContent>
                            <Input
                              id="referrer-name"
                              placeholder="Name of your contact"
                              {...field}
                            />
                            <FieldError errors={[fieldState.error]} />
                          </FieldContent>
                        </Field>
                      )}
                    />
                    <Controller
                      name="referred_by_profile_url"
                      control={control}
                      render={({ field, fieldState }) => (
                        <Field
                          className="min-w-0"
                          data-invalid={fieldState.invalid}
                        >
                          <FieldLabel htmlFor="referrer-profile">
                            Referrer profile URL
                          </FieldLabel>
                          <FieldContent>
                            <Input
                              id="referrer-profile"
                              type="url"
                              placeholder="https://linkedin.com/in/…"
                              {...field}
                            />
                            <FieldError errors={[fieldState.error]} />
                          </FieldContent>
                        </Field>
                      )}
                    />
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </FieldSet>

        {formError ? (
          <p className="text-sm text-destructive" role="alert">
            {formError}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={step === 0 || busy}
              onClick={goBack}
              className="gap-1.5"
            >
              <ChevronLeftIcon className="size-4" aria-hidden />
              Back
            </Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            {step < LAST_STEP ? (
              <Button
                type="button"
                onClick={() => void goNext()}
                disabled={busy}
                className="gap-1.5"
              >
                Continue
                <ChevronRightIcon className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button
                type="button"
                disabled={busy}
                onClick={() => void handleSubmit(onSubmit)()}
              >
                {busy ? savingLabel : saveLabel}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
