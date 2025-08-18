import OpenAI from 'openai';

const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;

export interface ExtractedTask {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  timeEstimate?: number;
  tags?: string[];
}

export async function transcribeAudio(blob: Blob, model: 'whisper-1' | 'gpt-4o-mini-transcribe' | 'gpt-4o-transcribe' = 'whisper-1'): Promise<string> {
  if (!apiKey) throw new Error('Missing VITE_OPENAI_API_KEY');
  const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  const file = new File([blob], 'voice_note.webm', { type: blob.type || 'audio/webm' });
  // Whisper supports response_format: 'text'
  const res: any = await openai.audio.transcriptions.create({ file, model, response_format: 'text' as any });
  // SDK may return string or object depending on format; normalize
  const text: string = typeof res === 'string' ? res : res?.text || '';
  return (text || '').trim();
}

export async function extractTasksFromText(text: string): Promise<ExtractedTask[]> {
  if (!apiKey) throw new Error('Missing VITE_OPENAI_API_KEY');
  const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  const schema = `[
    {
      "title": string,
      "description"?: string,
      "priority"?: "low"|"medium"|"high",
      "timeEstimate"?: number, // minutes
      "tags"?: string[]
    }
  ]`;
  const sys = `You convert a raw voice note into a list of actionable tasks.
Return ONLY strict JSON matching this TypeScript-like schema (no backticks, no markdown):\n${schema}\nKeep titles short; infer priority if obvious (else omit).`;
  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-nano-2025-04-14',
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: text }
    ],
    max_completion_tokens: 400
  });
  const content = completion.choices?.[0]?.message?.content?.trim() || '[]';
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed as ExtractedTask[];
    return [];
  } catch {
    // Fallback: single task with full text in description
    return [{ title: 'Voice note', description: content }];
  }
}
