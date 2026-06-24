import { schedule } from "@netlify/functions";

const handler = async () => {
  const baseUrl = (process.env.URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const cronSecret = process.env.CRON_SECRET || "";

  if (!baseUrl) {
    return new Response("Missing URL env var", { status: 500 });
  }

  try {
    const response = await fetch(`${baseUrl}/api/documents/drain`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}),
      },
    });

    const text = await response.text();
    console.log(`[${new Date().toISOString()}] drain status=${response.status} body=${text.slice(0, 500)}`);

    return new Response(text, {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${new Date().toISOString()}] drain error: ${message}`);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export default schedule("@every 5m", handler);
