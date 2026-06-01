import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type HealthStatus = "ok" | "error" | "missing_config";

type IntegrationHealth = {
  status: HealthStatus;
  message: string;
  statusCode?: number;
};

const requiredEnv = {
  openaiApiKey: process.env.OPENAI_API_KEY,
  pineconeApiKey: process.env.PINECONE_API_KEY,
  pineconeIndexName: process.env.PINECONE_INDEX_NAME,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET,
};

async function checkHttp(
  configName: string,
  request: () => Promise<Response>,
): Promise<IntegrationHealth> {
  try {
    const response = await request();

    if (!response.ok) {
      return {
        status: "error",
        statusCode: response.status,
        message: `${configName} respondio con error`,
      };
    }

    return {
      status: "ok",
      statusCode: response.status,
      message: `${configName} conectado`,
    };
  } catch {
    return {
      status: "error",
      message: `No se pudo conectar con ${configName}`,
    };
  }
}

export async function GET() {
  const results: Record<string, IntegrationHealth> = {};

  if (!requiredEnv.openaiApiKey) {
    results.openai = {
      status: "missing_config",
      message: "Falta OPENAI_API_KEY",
    };
  } else {
    const openaiApiKey = requiredEnv.openaiApiKey;

    results.openai = await checkHttp("OpenAI", () =>
      fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
        },
        cache: "no-store",
      }),
    );
  }

  if (!requiredEnv.pineconeApiKey || !requiredEnv.pineconeIndexName) {
    results.pinecone = {
      status: "missing_config",
      message: "Falta PINECONE_API_KEY o PINECONE_INDEX_NAME",
    };
  } else {
    const pineconeApiKey = requiredEnv.pineconeApiKey;
    const pineconeIndexName = requiredEnv.pineconeIndexName;

    results.pinecone = await checkHttp("Pinecone", () =>
      fetch(`https://api.pinecone.io/indexes/${pineconeIndexName}`, {
        headers: {
          "Api-Key": pineconeApiKey,
          "X-Pinecone-API-Version": "2025-04",
        },
        cache: "no-store",
      }),
    );
  }

  if (!requiredEnv.supabaseUrl || !requiredEnv.supabaseServiceRoleKey) {
    results.supabaseDatabase = {
      status: "missing_config",
      message: "Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY",
    };
  } else {
    const supabaseUrl = requiredEnv.supabaseUrl;
    const supabaseServiceRoleKey = requiredEnv.supabaseServiceRoleKey;

    results.supabaseDatabase = await checkHttp("Supabase DB", () =>
      fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          apikey: supabaseServiceRoleKey,
          Authorization: `Bearer ${supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      }),
    );
  }

  if (
    !requiredEnv.supabaseUrl ||
    !requiredEnv.supabaseServiceRoleKey ||
    !requiredEnv.supabaseStorageBucket
  ) {
    results.supabaseStorage = {
      status: "missing_config",
      message:
        "Falta NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o SUPABASE_STORAGE_BUCKET",
    };
  } else {
    const supabaseUrl = requiredEnv.supabaseUrl;
    const supabaseServiceRoleKey = requiredEnv.supabaseServiceRoleKey;
    const supabaseStorageBucket = requiredEnv.supabaseStorageBucket;

    results.supabaseStorage = await checkHttp("Supabase Storage", () =>
      fetch(`${supabaseUrl}/storage/v1/bucket/${supabaseStorageBucket}`, {
        headers: {
          apikey: supabaseServiceRoleKey,
          Authorization: `Bearer ${supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      }),
    );
  }

  const ok = Object.values(results).every((result) => result.status === "ok");

  return NextResponse.json(
    {
      ok,
      checkedAt: new Date().toISOString(),
      integrations: results,
    },
    { status: ok ? 200 : 503 },
  );
}
