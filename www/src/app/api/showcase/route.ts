import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4.1-mini'),
    system:
      'You are a UI generator for walkie-talkie, a remote terminal tool. Generate a single React component that creates a terminal UI. The component should connect to a walkie-talkie server via WebSocket at ws://localhost:3456/ws. Use the walkie-talkie WebSocket protocol: send {type:\'auth\',token:\'TOKEN\'} to authenticate, then {type:\'terminal:create\',cols:80,rows:24} to create terminals, listen for {type:\'terminal:output\',terminalId,data} messages. Style the UI with inline styles using a dark theme (background #0d1117, text #e6edf3, accent #00d4aa). Output ONLY the React component code, no explanation.',
    messages,
  });

  return result.toDataStreamResponse();
}
