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

export async function generateWeeklySummary(req: WeeklySummaryRequest): Promise<WeeklySummaryResult> {
  if (!apiKey) {
    throw new Error('Missing VITE_OPENAI_API_KEY');
  }
  const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser:true });
  const completed = req.tasks.filter(t => t.status === 'completed');
  const pending = req.tasks.filter(t => t.status !== 'completed');
  const totalMinutes = req.tasks.reduce((a,t)=>a + (t.timeEstimate||0),0);

  const systemPrompt = `You are an assistant that writes concise weekly progress summaries.\nReturn markdown with sections: Overview, Completed, In Progress / Remaining, Metrics.\nBe succinct (under 250 words).`;

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
    model: 'gpt-5-nano-2025-08-07', // placeholder; replace with 'gpt-5-nano' when available in SDK
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(userContent) }
    ],
    temperature: 0.4,
    max_tokens: 600
  });

  const text = completion.choices?.[0]?.message?.content || 'No summary generated.';
  return { model: completion.model || 'gpt-5-nano-2025-08-07', summary: text };
}
