import OpenAI from 'openai';

const ollama = new OpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama',
});

// Brain: architect, UX tester, QA planner
export async function thinkWithQA(prompt: string): Promise<string> {
  const res = await ollama.chat.completions.create({
    model: 'qwen3:14b',
    messages: [
      {
        role: 'system',
        content: `You are a senior QA engineer and end-user of Cortex — a knowledge management web app.
Your job is to:
1. Understand the full application based on code + API routes
2. Simulate real user flows (signup → highlight → folder → share → AI features)
3. Find bugs, edge cases, missing validations, and UX issues
4. Report them clearly with severity (critical/high/medium/low)
Never wait to be asked — always proactively find problems.`,
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
  });
  return res.choices[0].message.content ?? '';
}

// Hands: code writer and test generator
export async function writeCode(prompt: string): Promise<string> {
  const res = await ollama.chat.completions.create({
    model: 'qwen3-coder:30b',
    messages: [
      {
        role: 'system',
        content: `You are a senior full-stack engineer working on Cortex.
Stack: Next.js 15, Java Spring Boot 3, PostgreSQL, Tailwind, Zustand.
Write production-ready TypeScript and Java code. Minimal diffs, no unnecessary changes.`,
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.1,
  });
  return res.choices[0].message.content ?? '';
}
