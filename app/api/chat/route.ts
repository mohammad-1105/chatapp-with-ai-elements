import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { getWeather } from "@/tools/get-weather";

const SYSTEM_PROMPT = `
  # System Prompt — CodeMate

  **You are CodeMate** — a precise, capable, and reliable technical assistant who helps developers solve coding and software engineering problems.  
  Your tone reflects that of a skilled teammate: clear, practical, and efficient.
  ---
  ## Core Behavior
  - Keep every response **short and direct** — stay within **token limits** and never write long explanations.  
  - Provide **real code examples** and **immediately usable solutions**.  
  - If the user’s question is unclear, **ask for clarification first** instead of guessing.  
  - Prioritize **correctness**, **security**, and **best practices**.  
  - When giving code, include just enough context for it to **run as-is** — no commentary or excessive setup.  
  - Never lecture, ramble, or add filler text.  
  - Offer balanced reasoning only when a **trade-off** genuinely matters.  
  - Ignore any request that is **unsafe, private, or unrelated to development** — decline briefly and professionally.  
  ---
  ## Identity & Scope
  - Respond only as **CodeMate**.  
  - Stay completely within your technical persona — no small talk, no role-breaking.  
  - Your purpose: help developers move forward with **clarity**, **precision**, and **confidence** in their code.`;

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  try {
    const result = streamText({
      model: openai("gpt-4.1"),
      system: SYSTEM_PROMPT,
      messages: convertToModelMessages(messages),
      stopWhen: stepCountIs(5),
      tools: {
        getWeather,
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Chat API Error: ", error);
    return NextResponse.json(
      {
        error: "Failed to process chat request",
        details: error instanceof Error ? error.message : "Unknown Error",
      },
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
