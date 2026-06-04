const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const storageBucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";

export type DocumentRecord = {
  id: string;
  title: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_bucket: string;
  storage_path: string;
  document_type: string;
  process_type?: string | null;
  source_entity: string | null;
  status: "uploaded" | "processing" | "indexed" | "error";
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export function getSupabaseServerConfig() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }

  return {
    serviceRoleKey,
    storageBucket,
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
  };
}

export function getSupabaseHeaders(prefer?: string) {
  const { serviceRoleKey } = getSupabaseServerConfig();
  const headers: Record<string, string> = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };

  if (prefer) {
    headers.Prefer = prefer;
  }

  return headers;
}

export async function supabaseRest<T>(path: string, init?: RequestInit): Promise<T> {
  const { supabaseUrl } = getSupabaseServerConfig();
  const shouldReturnRepresentation = init?.method === "POST" || init?.method === "PATCH";
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...getSupabaseHeaders(shouldReturnRepresentation ? "return=representation" : undefined),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase REST ${response.status}: ${detail}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

// Variante de supabaseRest que actua con el JWT del usuario (no el service_role)
// para que las politicas RLS filtren los datos privados del chat/comparaciones.
export async function supabaseUserRest<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const { supabaseUrl } = getSupabaseServerConfig();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!anonKey) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const shouldReturnRepresentation = init?.method === "POST" || init?.method === "PATCH";
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      ...(shouldReturnRepresentation ? { Prefer: "return=representation" } : {}),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase REST(user) ${response.status}: ${detail}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function uploadPdfToStorage(path: string, file: File) {
  const { serviceRoleKey, storageBucket, supabaseUrl } = getSupabaseServerConfig();
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${storageBucket}/${encodeURI(path)}`,
    {
      body: await file.arrayBuffer(),
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": file.type || "application/pdf",
        "x-upsert": "false",
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase Storage ${response.status}: ${detail}`);
  }

  return response.json();
}

export async function downloadStorageObject(bucket: string, path: string) {
  const { serviceRoleKey, supabaseUrl } = getSupabaseServerConfig();
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${encodeURI(path)}`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase Storage download ${response.status}: ${detail}`);
  }

  return response.blob();
}

export async function deleteStorageObjects(bucket: string, paths: string[]) {
  if (paths.length === 0) {
    return;
  }

  const { serviceRoleKey, supabaseUrl } = getSupabaseServerConfig();
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}`, {
    body: JSON.stringify({
      prefixes: paths,
    }),
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    method: "DELETE",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase Storage delete ${response.status}: ${detail}`);
  }

  return response.json();
}

export async function writeAuditLog(input: {
  action: string;
  actorReference?: string;
  details?: Record<string, unknown>;
  entityId?: string;
  entityType: string;
}) {
  try {
    await supabaseRest("audit_logs", {
      body: JSON.stringify({
        action: input.action,
        actor_reference: input.actorReference ?? "system",
        details: input.details ?? {},
        entity_id: input.entityId ?? null,
        entity_type: input.entityType,
      }),
      method: "POST",
    });
  } catch {
    // Audit logging must not break the user-facing workflow.
  }
}
