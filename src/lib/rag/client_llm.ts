/**
 * Client-Side LLM Dispatcher
 * Allows real-time generative RAG execution directly from the client browser
 * using OpenAI, Google Gemini, or Anthropic API keys when the local FastAPI server
 * is not running or when deployed to a static host like GitHub Pages/Vercel.
 */

export interface ClientLlmRequest {
  provider: 'openai' | 'anthropic' | 'google' | 'none';
  apiKey: string;
  query: string;
  evidence: Array<{ title: string; page: number | null; text: string }>;
  language?: 'en' | 'ta';
}

export interface ClientLlmResponse {
  answer: string;
  providerUsed: string;
  modelUsed: string;
}

export async function callClientLlm(req: ClientLlmRequest): Promise<ClientLlmResponse> {
  const { provider, apiKey, query, evidence, language = 'en' } = req;

  if (!apiKey || provider === 'none') {
    throw new Error('No API key provided for client-side LLM call.');
  }

  const contextStr = evidence
    .map(
      (e, idx) =>
        `[${idx + 1}] Document: "${e.title}"${e.page ? ` (Page ${e.page})` : ''}\nExcerpt: "${e.text}"`,
    )
    .join('\n\n');

  const systemPrompt = `You are KnowledgeX AI, an elite, evidence-grounded knowledge intelligence assistant.
Answer the user's question accurately using ONLY the provided evidence citations.
Every factual assertion must reference the citation marker, e.g., [1], [2].
If the evidence does not contain sufficient facts to answer the question, clearly state: "The provided documents do not contain sufficient evidence to answer this question."
Respond in ${language === 'ta' ? 'Tamil (தமிழ்)' : 'English'}.
Maintain high academic and analytical rigor.`;

  const userPrompt = `EVIDENCE PASSAGES:\n${contextStr}\n\nUSER QUESTION: ${query}\n\nGROUNDED ANSWER (with citations [1], [2]):`;

  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `OpenAI API returned status ${res.status}`);
    }

    const data = await res.json();
    const answer = data?.choices?.[0]?.message?.content || 'No response returned from OpenAI.';
    return {
      answer,
      providerUsed: 'OpenAI',
      modelUsed: 'gpt-4o-mini',
    };
  }

  if (provider === 'google') {
    const cleanKey = apiKey.trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${cleanKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
          },
        ],
        generationConfig: { temperature: 0.2 },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Google Gemini API returned status ${res.status}`);
    }

    const data = await res.json();
    const answer =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response returned from Google Gemini.';
    return {
      answer,
      providerUsed: 'Google Gemini',
      modelUsed: 'gemini-1.5-flash',
    };
  }

  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey.trim(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Anthropic API returned status ${res.status}`);
    }

    const data = await res.json();
    const answer = data?.content?.[0]?.text || 'No response returned from Anthropic Claude.';
    return {
      answer,
      providerUsed: 'Anthropic',
      modelUsed: 'claude-3-5-haiku',
    };
  }

  throw new Error(`Unsupported LLM provider: ${provider}`);
}
