// Simple OpenAI summary helper. In production move this logic server-side to protect the API key.
// Expects an environment variable VITE_OPENAI_API_KEY (NOT secure client-side, for demo only).
import OpenAI from 'openai';
import { Task } from '../types';

const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;

export interface WeeklySummaryRequest {
  tasks: Task[];
  startISO: string; // week start date (YYYY-MM-DD)
  endISO: string;   // exclusive end date (YYYY-MM-DD)
}

export interface WeeklySummaryResult {
  model: string;
  summary: string;
}

export async function rewriteTaskDescription(title: string, description: string, priority: string) {
  if (!apiKey) throw new Error('Missing VITE_OPENAI_API_KEY');
  const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser:true });
  const sys = 'You rewrite a single task description. Return ONLY the improved description text, no preamble.';
  const user = JSON.stringify({ title, description, priority });
  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-nano-2025-04-14',
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: user }
    ],
    max_completion_tokens: 250
  });
  return completion.choices?.[0]?.message?.content?.trim() || description;
}

export async function generateWeeklySummary(req: WeeklySummaryRequest): Promise<WeeklySummaryResult> {
  if (!apiKey) {
    throw new Error('Missing VITE_OPENAI_API_KEY');
  }
  const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser:true });
  const completed = req.tasks.filter(t => t.status === 'completed');
  const pending = req.tasks.filter(t => t.status !== 'completed');
  const totalMinutes = req.tasks.reduce((a,t)=>a + (t.timeEstimate||0),0);

  const systemPrompt = "You are an assistant who writes concise weekly progress summaries. Read the JSON from the task manager and return a Markdown document with the following sections: Overview, Completed, In Progress / Remaining, and Metrics. Be succinct, keeping it under 250 words. Report on all received tasks; if there are none, start with a summary of what was achieved. Try to understand the purpose of each task and provide an overview of what the user has accomplished this week. ALWAYS REPLY THIS IS REALLY IMPORTANT ";

  const userContent = {
    week: { start: req.startISO, end: req.endISO },
    totals: {
      tasks: req.tasks.length,
      completed: completed.length,
      pending: pending.length,
      totalMinutes
    },
    completed: completed.map(t => ({ id:t.id, title:t.title, desc:t.description, date:t.scheduledDate, time:t.scheduledTime, minutes:t.timeEstimate, priority:t.priority, tags:t.tags })),
    pending: pending.map(t => ({ id:t.id, title:t.title, desc:t.description, date:t.scheduledDate, time:t.scheduledTime, minutes:t.timeEstimate, priority:t.priority, tags:t.tags }))
  };

  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-nano-2025-04-14', // placeholder; replace with 'gpt-5-nano' when available in SDK
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(userContent) }
    ],
    max_completion_tokens: 600
  });

  const text = completion.choices?.[0]?.message?.content || 'No summary generated.';
  return { model: completion.model || 'gpt-4.1-nano-2025-04-14', summary: text };
}
