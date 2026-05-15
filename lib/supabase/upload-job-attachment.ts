import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export async function uploadAttachmentFile(args: {
  file: File
  objectPath: string
}): Promise<{ publicUrl: string; storagePath: string }> {
  const bucket =
    process.env.NEXT_PUBLIC_SUPABASE_ATTACHMENTS_BUCKET?.trim() || "attachments"

  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.storage
    .from(bucket)
    .upload(args.objectPath, args.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: args.file.type || undefined,
    })
  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(args.objectPath)
  return { publicUrl: data.publicUrl, storagePath: args.objectPath }
}
