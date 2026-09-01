import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { SIHA_AGENT_INSTRUCTIONS } from "@/lib/siha-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-2.1";
const VOICE = process.env.OPENAI_REALTIME_VOICE ?? "marin";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY가 설정되지 않았어요." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const forwardedFor = request.headers.get("x-forwarded-for") ?? "local";
  const safetyIdentifier = createHash("sha256")
    .update(`siha-ai-tutor:${forwardedFor.split(",")[0]}`)
    .digest("hex");

  const openAIResponse = await fetch(
    "https://api.openai.com/v1/realtime/client_secrets",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": safetyIdentifier,
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: MODEL,
          instructions: SIHA_AGENT_INSTRUCTIONS,
          output_modalities: ["audio"],
          audio: {
            input: {
              transcription: {
                model: "gpt-4o-mini-transcribe",
                prompt: "A Korean child mixing very easy Korean and English words.",
              },
              turn_detection: {
                type: "semantic_vad",
                eagerness: "low",
                create_response: true,
                interrupt_response: true,
              },
            },
            output: { voice: VOICE },
          },
        },
      }),
      cache: "no-store",
    },
  );

  const body = await openAIResponse.text();
  if (!openAIResponse.ok) {
    console.error("Realtime client secret error", openAIResponse.status, body);
    return NextResponse.json(
      { error: "영어 친구를 연결하지 못했어요." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
