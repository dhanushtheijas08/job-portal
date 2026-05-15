"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ExternalLinkIcon, PlusIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useAuthSession } from "@/hooks/use-auth-session"
import { useUpdateUserProfileMutation } from "@/hooks/use-update-user-profile-mutation"
import { useUserProfileQuery } from "@/hooks/use-user-profile-query"
import {
  emptyResumeFormEntry,
  MAX_PROFILE_RESUMES,
  userSettingsFormSchema,
  type UserSettingsFormValues,
} from "@/lib/users/profile-schema"

function formatLastUsed(iso: string | null | undefined): string {
  if (!iso?.trim()) return "Not recorded yet"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d)
}

function ResumeFilePicker({
  inputId,
  inputClassName,
  onFileChange,
}: {
  inputId: string
  inputClassName: string
  onFileChange: (file: File | null) => void
}) {
  const [pickedName, setPickedName] = useState<string | null>(null)

  return (
    <>
      <Input
        id={inputId}
        type="file"
        className={inputClassName}
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null
          onFileChange(file)
          setPickedName(file?.name ?? null)
        }}
      />
      {pickedName ? (
        <p className="text-xs text-muted-foreground">Selected: {pickedName}</p>
      ) : null}
    </>
  )
}

export function SettingsForm() {
  const { data: session } = useAuthSession()
  const userId = session?.user.id
  const {
    data: profile,
    isPending: profileLoading,
    isError: profileError,
  } = useUserProfileQuery(userId)

  const updateProfile = useUpdateUserProfileMutation()
  const resumeFilesByResumeIdRef = useRef(new Map<string, File | null>())
  const storedResumeUrlsRef = useRef<string[]>([])
  const [openResumeAccordionIds, setOpenResumeAccordionIds] = useState<
    string[]
  >([])

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<UserSettingsFormValues>({
    resolver: zodResolver(userSettingsFormSchema),
    defaultValues: {
      linkedin_url: "",
      github_url: "",
      portfolio_url: "",
      resumes: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "resumes",
    keyName: "rhf_row_id",
  })

  const resumesWatch = useWatch({ control, name: "resumes" })

  useEffect(() => {
    if (profileLoading) return

    if (profile) {
      reset({
        linkedin_url: profile.linkedin_url ?? "",
        github_url: profile.github_url ?? "",
        portfolio_url: profile.portfolio_url ?? "",
        resumes: profile.resumes?.length
          ? profile.resumes.map((r) => ({
              id: r.id,
              name: r.name,
              url: r.url,
              last_used_at: r.last_used_at,
            }))
          : [],
      })
      storedResumeUrlsRef.current =
        profile.resumes?.map((r) => r.url).filter(Boolean) ?? []
      const firstId = profile.resumes?.[0]?.id
      queueMicrotask(() => {
        setOpenResumeAccordionIds(firstId ? [firstId] : [])
      })
    } else {
      reset({
        linkedin_url: "",
        github_url: "",
        portfolio_url: "",
        resumes: [],
      })
      storedResumeUrlsRef.current = []
      queueMicrotask(() => {
        setOpenResumeAccordionIds([])
      })
    }
    resumeFilesByResumeIdRef.current.clear()
  }, [profile, profileLoading, reset])

  const sessionMeta = session?.user.user_metadata as
    | { full_name?: string; name?: string }
    | undefined
  const displayName =
    profile?.user_name ??
    (sessionMeta?.full_name?.trim() ||
      sessionMeta?.name?.trim() ||
      session?.user.email?.split("@")[0] ||
      "—")

  const accountEmail = profile?.email ?? session?.user.email ?? "—"

  async function submitWithLatestFieldFiles(values: UserSettingsFormValues) {
    if (!userId) return
    const email = profile?.email ?? session?.user.email ?? ""
    if (!email.trim()) return

    const resumeFiles = values.resumes.map(
      (r) => resumeFilesByResumeIdRef.current.get(r.id) ?? null
    )

    const nextUrls = new Set(
      values.resumes.map((r) => r.url.trim()).filter(Boolean)
    )
    const removedStorageUrls = storedResumeUrlsRef.current.filter(
      (u) => !nextUrls.has(u)
    )

    try {
      await updateProfile.mutateAsync({
        values,
        resumeFiles,
        removedStorageUrls,
        userId,
        user_name: profile?.user_name ?? displayName,
        email,
      })
    } catch (e) {
      console.error(e)
    }
  }

  function onValid(values: UserSettingsFormValues) {
    void submitWithLatestFieldFiles(values)
  }

  if (!session?.user) {
    return null
  }

  if (profileLoading) {
    return (
      <div className="rounded-xl border border-border/80 bg-card p-8 text-sm text-muted-foreground shadow-xs ring-1 ring-foreground/5">
        Loading profile…
      </div>
    )
  }

  if (profileError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-card p-8 text-sm text-destructive">
        Could not load your profile. Check the `users` table and try again.
      </div>
    )
  }

  const disableSave =
    isSubmitting || updateProfile.isPending || !userId || !accountEmail

  const fileInputClassName =
    "h-10 cursor-pointer pb-1 text-muted-foreground file:me-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground"

  return (
    <form
      className="mx-auto max-w-5xl space-y-6"
      // eslint-disable-next-line react-hooks/refs
      onSubmit={handleSubmit(onValid)}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            Settings
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <Button type="submit" disabled={disableSave}>
            {updateProfile.isPending ? "Saving…" : "Save changes"}
          </Button>
          {updateProfile.isError ? (
            <p className="text-sm text-destructive">
              {updateProfile.error instanceof Error
                ? updateProfile.error.message
                : "Something went wrong while saving."}
            </p>
          ) : null}
          {updateProfile.isSuccess && !updateProfile.isPending ? (
            <p className="text-sm text-muted-foreground">Saved.</p>
          ) : null}
        </div>
      </div>
      <Card className="border-border/80 shadow-xs ring-1 ring-foreground/5">
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field className="min-w-0">
            <FieldLabel>Name</FieldLabel>
            <FieldContent>
              <Input value={displayName} disabled className="bg-muted/40" />
            </FieldContent>
          </Field>
          <Field className="min-w-0">
            <FieldLabel>Email</FieldLabel>
            <FieldContent>
              <Input value={accountEmail} disabled className="bg-muted/40" />
            </FieldContent>
          </Field>
          <Controller
            name="linkedin_url"
            control={control}
            render={({ field, fieldState }) => (
              <Field className="min-w-0" data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="settings-li">LinkedIn</FieldLabel>
                <FieldContent>
                  <Input
                    id="settings-li"
                    type="url"
                    inputMode="url"
                    placeholder="https://linkedin.com/in/…"
                    autoComplete="url"
                    {...field}
                  />
                  <FieldError errors={[fieldState.error]} />
                </FieldContent>
              </Field>
            )}
          />
          <Controller
            name="github_url"
            control={control}
            render={({ field, fieldState }) => (
              <Field className="min-w-0" data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="settings-gh">GitHub</FieldLabel>
                <FieldContent>
                  <Input
                    id="settings-gh"
                    type="url"
                    inputMode="url"
                    placeholder="https://github.com/…"
                    autoComplete="url"
                    {...field}
                  />
                  <FieldError errors={[fieldState.error]} />
                </FieldContent>
              </Field>
            )}
          />
          <Controller
            name="portfolio_url"
            control={control}
            render={({ field, fieldState }) => (
              <Field className="min-w-0" data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="settings-portfolio">Portfolio</FieldLabel>
                <FieldContent>
                  <Input
                    id="settings-portfolio"
                    type="url"
                    inputMode="url"
                    placeholder="https://…"
                    autoComplete="url"
                    {...field}
                  />
                  <FieldError errors={[fieldState.error]} />
                </FieldContent>
              </Field>
            )}
          />
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-xs ring-1 ring-foreground/5">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle>Resumes</CardTitle>
          <CardAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={fields.length >= MAX_PROFILE_RESUMES}
              onClick={() => {
                const entry = emptyResumeFormEntry()
                append(entry)
                setOpenResumeAccordionIds((prev) => [...prev, entry.id])
              }}
            >
              <PlusIcon className="size-4" aria-hidden />
              Add resume
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-5 pt-0">
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No resumes yet. Use &quot;Add resume&quot; above to upload a PDF
              or document.
            </p>
          ) : null}

          {fields.length > 0 ? (
            <Accordion
              type="multiple"
              className="w-full overflow-hidden rounded-lg border border-border bg-card shadow-xs"
              value={openResumeAccordionIds}
              onValueChange={setOpenResumeAccordionIds}
            >
              {fields.map((_, index) => {
                const resumeId = resumesWatch?.[index]?.id
                const label =
                  resumesWatch?.[index]?.name?.trim() || `Resume ${index + 1}`
                const urlSuffix = resumesWatch?.[index]?.url?.trim()
                if (!resumeId) return null
                return (
                  <AccordionItem
                    key={resumeId}
                    value={resumeId}
                    className="px-3 last:border-b-0 sm:px-4"
                  >
                    <div className="flex items-start">
                      <AccordionTrigger className="min-w-0 flex-1 items-start py-4 hover:no-underline">
                        <span className="flex min-w-0 flex-col gap-1 text-start">
                          <span className="truncate text-sm font-medium text-foreground">
                            {label}
                          </span>
                          <span className="max-w-[min(100vw-8rem,32rem)] truncate text-sm font-normal text-muted-foreground">
                            {urlSuffix
                              ? "File uploaded"
                              : "No file yet • add PDF or document below"}
                          </span>
                        </span>
                      </AccordionTrigger>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-5 h-8 shrink-0 gap-1 text-xs text-muted-foreground hover:text-destructive"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                        }}
                        onClick={() => {
                          resumeFilesByResumeIdRef.current.delete(resumeId)
                          setOpenResumeAccordionIds((prev) =>
                            prev.filter((openId) => openId !== resumeId)
                          )
                          remove(index)
                        }}
                      >
                        <Trash2Icon className="size-3.5 shrink-0" aria-hidden />
                        Remove
                      </Button>
                    </div>
                    <AccordionContent>
                      <div className="grid gap-x-6 gap-y-5 pb-2 md:grid-cols-2 md:items-start">
                        <Controller
                          name={`resumes.${index}.name`}
                          control={control}
                          render={({ field, fieldState }) => (
                            <Field
                              className="min-w-0"
                              data-invalid={fieldState.invalid}
                            >
                              <FieldLabel htmlFor={`resume-name-${resumeId}`}>
                                Name
                              </FieldLabel>
                              <FieldContent>
                                <Input
                                  id={`resume-name-${resumeId}`}
                                  placeholder="e.g. Backend — 2026"
                                  {...field}
                                />
                                <FieldError errors={[fieldState.error]} />
                              </FieldContent>
                            </Field>
                          )}
                        />

                        <Field className="min-w-0">
                          <FieldLabel htmlFor={`resume-file-${resumeId}`}>
                            File
                          </FieldLabel>
                          <FieldContent className="space-y-2">
                            <ResumeFilePicker
                              key={`${resumeId}-${resumesWatch?.[index]?.url ?? ""}`}
                              inputId={`resume-file-${resumeId}`}
                              inputClassName={fileInputClassName}
                              onFileChange={(file) => {
                                if (file) {
                                  resumeFilesByResumeIdRef.current.set(
                                    resumeId,
                                    file
                                  )
                                  setValue(
                                    `resumes.${index}.last_used_at`,
                                    new Date().toISOString(),
                                    { shouldDirty: true }
                                  )
                                } else {
                                  resumeFilesByResumeIdRef.current.delete(
                                    resumeId
                                  )
                                }
                              }}
                            />
                            <Controller
                              name={`resumes.${index}.url`}
                              control={control}
                              render={({ field }) => (
                                <>
                                  {field.value ? (
                                    <div className="flex flex-wrap items-center justify-between gap-2 px-2 text-xs text-muted-foreground">
                                      <Link
                                        href={field.value}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
                                      >
                                        Open uploaded file
                                        <ExternalLinkIcon
                                          className="size-3.5"
                                          aria-hidden
                                        />
                                      </Link>
                                      <p className="text-xs text-muted-foreground">
                                        Last used:{" "}
                                        <span className="text-foreground">
                                          {formatLastUsed(
                                            resumesWatch?.[index]?.last_used_at
                                          )}
                                        </span>
                                      </p>
                                    </div>
                                  ) : null}
                                </>
                              )}
                            />
                          </FieldContent>
                        </Field>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          ) : null}

          {errors.resumes?.message ? (
            <p className="text-sm text-destructive">{errors.resumes.message}</p>
          ) : null}
        </CardContent>
      </Card>
    </form>
  )
}
