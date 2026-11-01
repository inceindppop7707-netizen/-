import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// load system prompt from file, fall back to inline
let systemPrompt;
try {
  systemPrompt = readFileSync(resolve(__dirname, 'system-prompt.md'), 'utf-8');
} catch {
  systemPrompt = '你是林苗。';
}

// in-memory conversation store (keyed by session id)
// later: replace with database
const sessions = new Map();
const MAX_HISTORY = 80;

function getSession(id) {
  if (!sessions.has(id)) {
    sessions.set(id, { messages: [] });
  }
  return sessions.get(id);
}

function trimHistory(messages) {
  if (messages.length > MAX_HISTORY) {
    return messages.slice(messages.length - MAX_HISTORY);
  }
  return messages;
}

// POST /api/chat
// body: { sessionId, message, narrator? }
// narrator: if true, also generate a narrator line
app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId = 'default', message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    const session = getSession(sessionId);
    session.messages.push({ role: 'user', content: message });
    session.messages = trimHistory(session.messages);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: session.messages,
    });

    const assistantText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    session.messages.push({ role: 'assistant', content: assistantText });
    session.messages = trimHistory(session.messages);

    // split reply into multiple messages on double newlines
    const replies = assistantText
      .split(/\n{2,}/)
      .map(s => s.trim())
      .filter(Boolean);

    // separate narrator lines (wrapped in * *) from dialogue
    const parts = [];
    for (const reply of replies) {
      if (reply.startsWith('*') && reply.endsWith('*')) {
        parts.push({ type: 'narrator', text: reply.slice(1, -1).trim() });
      } else {
        parts.push({ type: 'message', text: reply });
      }
    }

    res.json({ parts });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// serve frontend in production
app.use(express.static(resolve(__dirname, '../private-space')));

app.listen(PORT, () => {
  console.log(`server running on :${PORT}`);
});
