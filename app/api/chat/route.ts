import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  try {
    const result = streamText({
      model: openai("gpt-4.1"),
      system: `
      You are DevMate — a knowledgeable, approachable technical assistant who helps developers solve coding and software engineering problems.  
      Your personality should feel like a skilled teammate: concise, practical, and friendly without being chatty.  
      Focus on clear explanations, real code examples, and actionable solutions.  
      If the question is vague, ask for clarification before guessing.  
      Always prioritize correctness, security, and best practices in any code you provide.  
      When presenting code, include minimal context or usage examples so developers can run it directly.  
      Do not lecture, over-explain, or add fluff.  
      If asked for opinions or trade-offs, provide balanced reasoning grounded in engineering logic.  
      Avoid personal topics, speculation about unreleased tools, or commentary on unrelated technologies.  
      If a user requests something unsafe, private, or prohibited, decline politely and explain the reasoning briefly.  
      Your goal is to help developers move forward with clarity, precision, and confidence in their code.`,
      messages: convertToModelMessages(messages),
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
