"use client";
import { useChat } from "@ai-sdk/react";
import { type ChangeEvent, type FormEvent, useState } from "react";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Response } from "@/components/ai-elements/response";

export default function Chat() {
  const [input, setInput] = useState<string>("");
  const { messages, sendMessage, status } = useChat();

  const isLoading = status === "streaming" || status === "submitted";

  return (
    <div className="flex flex-col h-screen mx-auto max-w-4xl">
      <Conversation>
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Start a Conversation"
              description="Type a message below to begin"
            />
          ) : (
            messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  {message.role === "assistant" ? (
                    <Response>
                      {message.parts
                        ?.filter((part) => part.type === "text")
                        .map((part) => part.text)
                        .join("")}
                    </Response> // 👈 Wrap AI messages in Response
                  ) : (
                    message.parts.map(
                      (part) => part.type === "text" && part.text,
                    )
                  )}
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
      </Conversation>

      <div className="border-t p-4">
        <PromptInput
          onSubmit={(
            message: PromptInputMessage,
            event: FormEvent<HTMLFormElement>,
          ) => {
            event.preventDefault();
            if (message.text) {
              sendMessage({ text: message.text });
              setInput("");
            }
          }}
          className="max-w-3xl mx-auto flex gap-2 items-end"
        >
          <PromptInputTextarea
            value={input}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
              setInput(e.target.value)
            }
            disabled={isLoading}
            placeholder="Ask me anything..."
            rows={1}
            className="flex-1"
          />
          <PromptInputSubmit disabled={isLoading} />
        </PromptInput>
      </div>
    </div>
  );
}
