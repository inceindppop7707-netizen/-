import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ── API client (hot-swappable) ──
const SETTINGS_FILE = resolve(DB_DIR, 'api-settings.json');
const ADMIN_PASS = process.env.ADMIN_PASS || 'linmiao';

function loadApiSettings() {
  const settings = {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    baseURL: process.env.ANTHROPIC_BASE_URL || '',
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
  };
  if (existsSync(SETTINGS_FILE)) {
    try {
      const saved = JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8'));
      if (saved.apiKey) settings.apiKey = saved.apiKey;
      if (saved.baseURL) settings.baseURL = saved.baseURL;
      if (saved.model) settings.model = saved.model;
    } catch {}
  }
  return settings;
}

function createClient(settings) {
  const opts = { apiKey: settings.apiKey };
  if (settings.baseURL) opts.baseURL = settings.baseURL;
  return new Anthropic(opts);
}

let apiSettings = loadApiSettings();
let client = createClient(apiSettings);

// ── file paths ──
const CLAUDE_MD = resolve(REPO_ROOT, 'CLAUDE.md');
const MEMORY_MD = resolve(REPO_ROOT, '小苗记忆.md');
const SYSTEM_PROMPT_FILE = resolve(__dirname, 'system-prompt.md');
const CHAT_LOG_DIR = resolve(REPO_ROOT, 'chat-log');
const DB_DIR = resolve(__dirname, 'data');

if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true });

// ── system prompt: CLAUDE.md + compact rules ──
function loadSystemPrompt() {
  let prompt = '';
  try {
    prompt = readFileSync(CLAUDE_MD, 'utf-8');
  } catch {
    try {
      prompt = readFileSync(SYSTEM_PROMPT_FILE, 'utf-8');
    } catch {
      prompt = '你是林苗。';
    }
  }
  return prompt;
}

let systemPrompt = loadSystemPrompt();

// ── memory search: find relevant lines from 小苗记忆.md ──
function searchMemory(query) {
  try {
    const content = readFileSync(MEMORY_MD, 'utf-8');
    const lines = content.split('\n');
    const keywords = query.toLowerCase().split(/\s+/);
    const scored = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        if (kw.length > 1 && line.includes(kw)) score++;
      }
      if (score > 0) {
        const start = Math.max(0, i - 2);
        const end = Math.min(lines.length, i + 3);
        scored.push({ score, text: lines.slice(start, end).join('\n') });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, 5).map(s => s.text);
    if (results.length === 0) return '';
    return '\n\n【从记忆中检索到的相关内容】\n' + results.join('\n---\n');
  } catch {
    return '';
  }
}

// ── conversation persistence (JSON files, later: database) ──
const sessions = new Map();
const MAX_HISTORY = 80;

function sessionFile(id) {
  return resolve(DB_DIR, `session-${id}.json`);
}

function getSession(id) {
  if (!sessions.has(id)) {
    const file = sessionFile(id);
    if (existsSync(file)) {
      try {
        const data = JSON.parse(readFileSync(file, 'utf-8'));
        sessions.set(id, data);
      } catch {
        sessions.set(id, { messages: [], summary: '' });
      }
    } else {
      sessions.set(id, { messages: [], summary: '' });
    }
  }
  return sessions.get(id);
}

function saveSession(id) {
  const session = sessions.get(id);
  if (!session) return;
  writeFileSync(sessionFile(id), JSON.stringify(session, null, 2));
}

function trimHistory(session) {
  if (session.messages.length > MAX_HISTORY) {
    // keep a summary of older messages
    const old = session.messages.slice(0, session.messages.length - MAX_HISTORY + 20);
    const oldText = old.map(m => `${m.role}: ${m.content.slice(0, 100)}`).join('\n');
    session.summary = (session.summary ? session.summary + '\n...\n' : '') + oldText;
    if (session.summary.length > 3000) {
      session.summary = session.summary.slice(-3000);
    }
    session.messages = session.messages.slice(session.messages.length - MAX_HISTORY + 20);
  }
}

// ── git sync: push changes to GitHub ──
function gitSync(commitMsg) {
  try {
    execSync('git add -A && git diff --cached --quiet || git commit -m "' +
      commitMsg.replace(/"/g, '\\"') + '" && git push', {
      cwd: REPO_ROOT,
      stdio: 'pipe',
      timeout: 30000,
    });
  } catch (err) {
    console.warn('git sync failed:', err.message);
  }
}

// ── chat endpoint ──
app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId = 'default', message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    const session = getSession(sessionId);
    session.messages.push({ role: 'user', content: message });
    trimHistory(session);

    // search memory for relevant context
    const memoryContext = searchMemory(message);

    // build messages array with summary if exists
    const apiMessages = [];
    if (session.summary) {
      apiMessages.push({
        role: 'user',
        content: '【之前的对话摘要】\n' + session.summary,
      });
      apiMessages.push({
        role: 'assistant',
        content: '好，我记得。',
      });
    }
    apiMessages.push(...session.messages);

    // build system prompt with cache control for cost savings
    // core persona is cached (stable), memory context is ephemeral
    const systemBlocks = [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ];
    if (memoryContext) {
      systemBlocks.push({
        type: 'text',
        text: memoryContext,
      });
    }

    const response = await client.messages.create({
      model: apiSettings.model,
      max_tokens: 1024,
      system: systemBlocks,
      messages: apiMessages,
    });

    const assistantText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    session.messages.push({ role: 'assistant', content: assistantText });
    trimHistory(session);
    saveSession(sessionId);

    // split into parts
    const replies = assistantText
      .split(/\n{2,}/)
      .map(s => s.trim())
      .filter(Boolean);

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

// ── memory update endpoint ──
app.post('/api/memory', async (req, res) => {
  try {
    const { content, append } = req.body;
    if (!content) return res.status(400).json({ error: 'content required' });

    if (append) {
      const existing = existsSync(MEMORY_MD) ? readFileSync(MEMORY_MD, 'utf-8') : '';
      writeFileSync(MEMORY_MD, existing + '\n' + content);
    } else {
      writeFileSync(MEMORY_MD, content);
    }

    gitSync('update memory via API');
    res.json({ ok: true });
  } catch (err) {
    console.error('Memory error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// ── settings endpoint (password protected) ──
function checkAdmin(req, res) {
  const pass = req.headers['x-admin-pass'] || req.body?.password;
  if (pass !== ADMIN_PASS) {
    res.status(401).json({ error: 'wrong password' });
    return false;
  }
  return true;
}

app.get('/api/settings', (req, res) => {
  if (!checkAdmin(req, res)) return;
  res.json({
    baseURL: apiSettings.baseURL,
    model: apiSettings.model,
    hasKey: !!apiSettings.apiKey,
  });
});

app.post('/api/settings', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { apiKey, baseURL, model } = req.body;
  if (apiKey !== undefined) apiSettings.apiKey = apiKey;
  if (baseURL !== undefined) apiSettings.baseURL = baseURL;
  if (model !== undefined) apiSettings.model = model;
  client = createClient(apiSettings);
  writeFileSync(SETTINGS_FILE, JSON.stringify({
    apiKey: apiSettings.apiKey,
    baseURL: apiSettings.baseURL,
    model: apiSettings.model,
  }, null, 2));
  res.json({ ok: true, model: apiSettings.model, baseURL: apiSettings.baseURL });
});

// ── health check ──
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ── serve frontend ──
app.use(express.static(resolve(__dirname, '../private-space')));

app.listen(PORT, () => {
  console.log(`server running on :${PORT}`);
  // pull latest on startup
  try {
    execSync('git pull --ff-only', { cwd: REPO_ROOT, stdio: 'pipe', timeout: 15000 });
    systemPrompt = loadSystemPrompt();
    console.log('git pull done, system prompt loaded');
  } catch {
    console.warn('git pull failed on startup, using local files');
  }
});
