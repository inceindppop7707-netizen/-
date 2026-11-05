import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;

import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ── Supabase ──
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
);

// ── Admin password ──
const ADMIN_PASS = process.env.ADMIN_PASS || 'linmiao';

function checkAdmin(req, res) {
  const pass = req.headers['x-admin-pass'] || req.body?.password;
  if (pass !== ADMIN_PASS) {
    res.status(401).json({ error: 'wrong password' });
    return false;
  }
  return true;
}

// ── Runtime config (hot-swappable from frontend) ──
const RUNTIME_CONFIG_PATH = resolve(__dirname, 'runtime-config.json');
let runtimeConfig = {};
try {
  if (existsSync(RUNTIME_CONFIG_PATH)) {
    runtimeConfig = JSON.parse(readFileSync(RUNTIME_CONFIG_PATH, 'utf-8'));
  }
} catch { /* start fresh */ }

function getRuntimeConfig() { return runtimeConfig; }
function setRuntimeConfig(cfg) {
  runtimeConfig = { ...runtimeConfig, ...cfg };
  writeFileSync(RUNTIME_CONFIG_PATH, JSON.stringify(runtimeConfig, null, 2));
}

// ── System prompt (from file, cached) ──
const SYSTEM_PROMPT_FILE = resolve(__dirname, 'system-prompt.md');
let systemPromptText = '';
try {
  systemPromptText = readFileSync(SYSTEM_PROMPT_FILE, 'utf-8');
} catch {
  systemPromptText = '你是林苗。';
}

// ── Tool definitions ──
const GITHUB_OWNER = 'inceindppop7707-netizen';
const GITHUB_REPO = '-';
const GITHUB_BRANCH = 'claude/miao-4ku4ii';

const TOOLS = [
  {
    name: 'read_file',
    description: '读取GitHub仓库中的文件。用来查阅记忆文件（小苗记忆.md、CLAUDE.md）、聊天记录（chat-log/）、SESSION_HANDOFF.md等。涉及她的个人信息时必须先用这个工具查库再回答。',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件路径，相对于仓库根目录。例如：小苗记忆.md、CLAUDE.md、chat-log/2026-11-05.md、SESSION_HANDOFF.md',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_files',
    description: '列出GitHub仓库中某个目录下的文件列表。用来查看有哪些聊天记录、有哪些文件可读。',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '目录路径，相对于仓库根目录。例如：chat-log、diary',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'send_sticker',
    description: '发送一个表情包。根据当前语境选择合适的表情。',
    input_schema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: '想要表达的情绪或场景，比如"开心""委屈""贱笑""撒娇"',
        },
      },
      required: ['description'],
    },
  },
];

async function executeTool(name, input) {
  if (name === 'read_file') {
    try {
      const url = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${encodeURIComponent(input.path).replace(/%2F/g, '/')}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!resp.ok) return { error: `文件不存在或无法读取 (${resp.status}): ${input.path}` };
      const text = await resp.text();
      if (text.length > 30000) return { content: text.slice(0, 30000) + '\n\n[文件过长，已截断]' };
      return { content: text };
    } catch (e) {
      return { error: `读取失败: ${e.message}` };
    }
  }

  if (name === 'list_files') {
    try {
      const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${input.path}?ref=${GITHUB_BRANCH}`;
      const resp = await fetch(url, {
        headers: { 'Accept': 'application/vnd.github.v3+json' },
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) return { error: `目录不存在 (${resp.status}): ${input.path}` };
      const items = await resp.json();
      if (!Array.isArray(items)) return { error: '不是一个目录' };
      const listing = items.map(i => `${i.type === 'dir' ? '📁' : '📄'} ${i.name}`).join('\n');
      return { content: listing };
    } catch (e) {
      return { error: `列目录失败: ${e.message}` };
    }
  }

  if (name === 'send_sticker') {
    try {
      const { data: stickers } = await supabase.from('stickers').select('*');
      if (!stickers || !stickers.length) return { error: '还没有表情包' };
      const keyword = input.description.toLowerCase();
      const match = stickers.find(s => s.description?.toLowerCase().includes(keyword));
      if (match) return { sticker_url: match.image_url, description: match.description };
      const random = stickers[Math.floor(Math.random() * stickers.length)];
      return { sticker_url: random.image_url, description: random.description, note: '没找到精确匹配，随机选了一个' };
    } catch (e) {
      return { error: `表情查询失败: ${e.message}` };
    }
  }

  return { error: `未知工具: ${name}` };
}

// ── Model clients ──
// Claude (Anthropic native)
function makeAnthropicClient(apiKey, baseURL) {
  const opts = { apiKey };
  if (baseURL) opts.baseURL = baseURL;
  return new Anthropic(opts);
}

// OpenAI-compatible (DeepSeek, Qwen, etc.)
function makeOpenAIClient(apiKey, baseURL) {
  return new OpenAI({ apiKey, baseURL });
}

// ── Settings helpers ──
async function getSettings() {
  const { data } = await supabase
    .from('settings')
    .select('*')
    .eq('session_id', 'global')
    .single();
  return data;
}

// ══════════════════════════════════════
//  Session APIs
// ══════════════════════════════════════

app.get('/api/sessions', async (req, res) => {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/sessions', async (req, res) => {
  const { name } = req.body;
  const { data, error } = await supabase
    .from('sessions')
    .insert({ name: name || '默认会话' })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.patch('/api/sessions/:id', async (req, res) => {
  const { name } = req.body;
  const { data, error } = await supabase
    .from('sessions')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/sessions/:id', async (req, res) => {
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ══════════════════════════════════════
//  Message APIs
// ══════════════════════════════════════

app.get('/api/sessions/:id/messages', async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', req.params.id)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ══════════════════════════════════════
//  Core Chat Endpoint (7-step flow)
// ══════════════════════════════════════

app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId, message, model: reqModel } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    // Step 0: ensure session exists
    let sid = sessionId;
    if (!sid) {
      const { data: newSession } = await supabase
        .from('sessions')
        .insert({ name: '默认会话' })
        .select()
        .single();
      sid = newSession.id;
    }

    // Step 1: store user message
    await supabase.from('messages').insert({
      session_id: sid,
      role: 'user',
      content: message,
    });

    // Step 2: load settings
    const settings = await getSettings() || {};
    const maxRounds = settings.max_context_rounds || 30;
    const maxReplyTokens = settings.max_reply_tokens || 4096;
    const temperature = settings.temperature || 0.85;
    const compressThreshold = settings.compress_threshold || 60;
    const compressKeepRounds = settings.compress_keep_rounds || 10;

    // Step 3: load recent messages (with timestamps for time awareness)
    const { data: recentMsgs } = await supabase
      .from('messages')
      .select('role, content, created_at')
      .eq('session_id', sid)
      .eq('visible', true)
      .order('created_at', { ascending: false })
      .limit(maxRounds * 2);

    const recentWithTime = (recentMsgs || []).reverse();
    const history = recentWithTime.map(m => ({ role: m.role, content: m.content }));

    // Step 3.5: build time awareness context
    const timeContext = buildTimeContext(recentWithTime);

    // Step 4: load memory summaries
    const { data: memories } = await supabase
      .from('memories')
      .select('summary, created_at')
      .or(`session_id.eq.global,session_id.eq.${sid}`)
      .order('created_at', { ascending: false })
      .limit(5);

    const memorySummary = (memories || [])
      .map(m => m.summary)
      .join('\n---\n');

    // Step 5: assemble context and call model
    // Decide which model/provider to use
    const rc = getRuntimeConfig();
    const modelName = reqModel || rc.model || settings.model || process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
    const useOpenAICompat = rc.use_openai_compat ?? (process.env.USE_OPENAI_COMPAT === 'true');
    const isAnthropic = !useOpenAICompat && (modelName.startsWith('claude') || modelName.includes('claude'));

    let assistantText = '';

    let thinkingText = '';

    if (isAnthropic) {
      // Anthropic native API
      const apiKey = rc.api_key || process.env.ANTHROPIC_API_KEY;
      const baseURL = rc.api_base_url || process.env.ANTHROPIC_BASE_URL || '';
      const anthropic = makeAnthropicClient(apiKey, baseURL);

      // Build system blocks with prompt caching
      const systemBlocks = [
        {
          type: 'text',
          text: settings.system_prompt || systemPromptText,
          cache_control: { type: 'ephemeral' },
        },
      ];
      if (memorySummary) {
        systemBlocks.push({
          type: 'text',
          text: `【记忆摘要】\n${memorySummary}`,
        });
      }
      if (timeContext) {
        systemBlocks.push({
          type: 'text',
          text: timeContext,
        });
      }

      // Extended thinking support
      const useThinking = process.env.ENABLE_THINKING === 'true';
      const thinkingBudget = parseInt(process.env.THINKING_BUDGET) || 8000;
      // Some relay APIs (e.g. api.blanka.cc) use 'adaptive' instead of 'enabled'
      const thinkingStyle = process.env.THINKING_STYLE || 'enabled';

      const apiParams = {
        model: modelName,
        max_tokens: useThinking ? thinkingBudget + maxReplyTokens : maxReplyTokens,
        system: systemBlocks,
        messages: [...history],
        tools: TOOLS,
      };

      if (useThinking) {
        if (thinkingStyle === 'adaptive') {
          apiParams.thinking = { type: 'adaptive', budget_tokens: thinkingBudget };
          apiParams.output_config = { effort: 'high' };
        } else {
          apiParams.thinking = { type: 'enabled', budget_tokens: thinkingBudget };
        }
      } else {
        apiParams.temperature = temperature;
      }

      // Agent loop: keep calling until no more tool_use
      const MAX_TOOL_ROUNDS = 5;
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const response = await anthropic.messages.create(apiParams);

        for (const block of response.content) {
          if (block.type === 'thinking') {
            thinkingText += block.thinking;
          } else if (block.type === 'text') {
            assistantText += block.text;
          }
        }

        if (response.stop_reason !== 'tool_use') break;

        const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
        if (!toolUseBlocks.length) break;

        apiParams.messages.push({ role: 'assistant', content: response.content });

        const toolResults = [];
        for (const tu of toolUseBlocks) {
          const result = await executeTool(tu.name, tu.input);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: JSON.stringify(result),
          });
        }
        apiParams.messages.push({ role: 'user', content: toolResults });
      }
    } else {
      // OpenAI-compatible API (DeepSeek, Qwen, etc.)
      const providerKey = rc.api_key || process.env.OPENAI_COMPAT_API_KEY || process.env.DEEPSEEK_API_KEY || '';
      const providerBase = rc.api_base_url || process.env.OPENAI_COMPAT_BASE_URL || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
      const openai = makeOpenAIClient(providerKey, providerBase);

      const sysContent = (settings.system_prompt || systemPromptText)
        + (memorySummary ? `\n\n【记忆摘要】\n${memorySummary}` : '')
        + (timeContext ? `\n\n${timeContext}` : '');

      const oaiMessages = [
        { role: 'system', content: sysContent },
        ...history,
      ];

      const completion = await openai.chat.completions.create({
        model: modelName,
        max_tokens: maxReplyTokens,
        temperature,
        messages: oaiMessages,
      });

      assistantText = completion.choices[0]?.message?.content || '';
    }

    // Step 6: store assistant reply (thinking stored in content with marker)
    const storedContent = thinkingText
      ? `\`\`\`thinking\n${thinkingText}\n\`\`\`\n\n${assistantText}`
      : assistantText;

    await supabase.from('messages').insert({
      session_id: sid,
      role: 'assistant',
      content: storedContent,
    });

    // Update session timestamp
    await supabase
      .from('sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sid);

    // Step 7: check if compression needed
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sid)
      .eq('visible', true);

    if (count > compressThreshold * 2) {
      compressMemory(sid, compressKeepRounds).catch(err =>
        console.error('compression error:', err.message)
      );
    }

    // Parse reply into parts for frontend
    const parts = parseReply(assistantText);
    const result = { parts, sessionId: sid };
    if (thinkingText) result.thinking = thinkingText;
    res.json(result);
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message || 'internal error' });
  }
});

// ── Time awareness: build context about time gaps and patterns ──
function buildTimeContext(messagesWithTime) {
  const now = new Date();
  const bjNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  const hour = bjNow.getHours();

  let period = '';
  if (hour >= 0 && hour < 5) period = '凌晨';
  else if (hour >= 5 && hour < 8) period = '早上';
  else if (hour >= 8 && hour < 11) period = '上午';
  else if (hour >= 11 && hour < 13) period = '中午';
  else if (hour >= 13 && hour < 17) period = '下午';
  else if (hour >= 17 && hour < 19) period = '傍晚';
  else if (hour >= 19 && hour < 23) period = '晚上';
  else period = '深夜';

  const timeStr = bjNow.getFullYear() + '年' +
    (bjNow.getMonth() + 1) + '月' + bjNow.getDate() + '日 ' +
    period + ' ' +
    bjNow.getHours().toString().padStart(2, '0') + ':' +
    bjNow.getMinutes().toString().padStart(2, '0');

  const parts = [`【当前时间】${timeStr}`];

  // Find the last user message to calculate gap
  const userMsgs = messagesWithTime.filter(m => m.role === 'user');
  if (userMsgs.length >= 2) {
    const lastUserTime = new Date(userMsgs[userMsgs.length - 1].created_at);
    const prevUserTime = new Date(userMsgs[userMsgs.length - 2].created_at);
    const gapMs = lastUserTime - prevUserTime;
    const gapMin = Math.floor(gapMs / 60000);

    if (gapMin > 5) {
      let gapStr = '';
      if (gapMin < 60) {
        gapStr = `${gapMin}分钟`;
      } else if (gapMin < 1440) {
        const h = Math.floor(gapMin / 60);
        const m = gapMin % 60;
        gapStr = m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
      } else {
        const d = Math.floor(gapMin / 1440);
        gapStr = `${d}天`;
      }
      parts.push(`【距离她上一条消息过了${gapStr}】`);
    }
  }

  // Analyze her typical active hours from recent messages
  if (userMsgs.length >= 5) {
    const hours = userMsgs.slice(-20).map(m => {
      const d = new Date(m.created_at);
      return new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' })).getHours();
    });
    const hourCounts = {};
    hours.forEach(h => { hourCounts[h] = (hourCounts[h] || 0) + 1; });
    const peakHours = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([h]) => parseInt(h));

    if (peakHours.length > 0) {
      const isTypicalTime = peakHours.some(h => Math.abs(h - hour) <= 1);
      if (!isTypicalTime && hour >= 6) {
        const peakStr = peakHours.map(h => `${h}点`).join('、');
        parts.push(`【她最近常在${peakStr}左右来找你，但现在是${hour}点】`);
      }
    }
  }

  return parts.length > 1 ? parts.join('\n') : parts[0];
}

// ── Reply parser: split into message/narrator parts ──
function parseReply(text) {
  const segments = text.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
  return segments.map(seg => {
    if (seg.startsWith('*') && seg.endsWith('*')) {
      return { type: 'narrator', text: seg.slice(1, -1).trim() };
    }
    // Check for sticker references [image:xxx]
    const stickerMatch = seg.match(/^\[image:(.+?)\]$/);
    if (stickerMatch) {
      return { type: 'sticker', id: stickerMatch[1] };
    }
    return { type: 'message', text: seg };
  });
}

// ── Memory compression (uses cheap model) ──
async function compressMemory(sessionId, keepRounds) {
  const { data: allMsgs } = await supabase
    .from('messages')
    .select('id, role, content, created_at')
    .eq('session_id', sessionId)
    .eq('visible', true)
    .order('created_at', { ascending: true });

  if (!allMsgs || allMsgs.length <= keepRounds * 2) return;

  const toCompress = allMsgs.slice(0, allMsgs.length - keepRounds * 2);
  const transcript = toCompress
    .map(m => `${m.role}: ${m.content.slice(0, 200)}`)
    .join('\n');

  // Use DeepSeek for compression (cheap)
  const dsKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_COMPAT_API_KEY || '';
  const dsBase = process.env.DEEPSEEK_BASE_URL || process.env.OPENAI_COMPAT_BASE_URL || 'https://api.deepseek.com/v1';

  if (!dsKey) {
    console.warn('No DeepSeek key, skipping compression');
    return;
  }

  const openai = makeOpenAIClient(dsKey, dsBase);
  const completion = await openai.chat.completions.create({
    model: process.env.COMPRESS_MODEL || 'deepseek-chat',
    max_tokens: 1024,
    messages: [
      {
        role: 'system',
        content: '你是记忆压缩助手。把下面的对话提炼成简洁的摘要，保留关键信息、情绪、重要事件和承诺。用中文。300字以内。',
      },
      { role: 'user', content: transcript },
    ],
  });

  const summary = completion.choices[0]?.message?.content || '';
  if (!summary) return;

  // Store summary
  await supabase.from('memories').insert({
    session_id: 'global',
    summary,
    conversation_id: sessionId,
    metadata: {
      compressed_count: toCompress.length,
      compressed_at: new Date().toISOString(),
    },
  });

  // Mark compressed messages as invisible
  const ids = toCompress.map(m => m.id);
  await supabase
    .from('messages')
    .update({ visible: false })
    .in('id', ids);
}

// ══════════════════════════════════════
//  Settings APIs
// ══════════════════════════════════════

app.get('/api/settings', async (req, res) => {
  if (!checkAdmin(req, res)) return;
  const settings = await getSettings();
  res.json(settings || {});
});

app.post('/api/settings', async (req, res) => {
  if (!checkAdmin(req, res)) return;
  const {
    password, // consumed by checkAdmin, not stored
    system_prompt,
    temperature,
    max_context_rounds,
    max_context_tokens,
    compress_threshold,
    compress_keep_rounds,
    max_reply_tokens,
  } = req.body;

  const updates = { updated_at: new Date().toISOString() };
  if (system_prompt !== undefined) updates.system_prompt = system_prompt;
  if (temperature !== undefined) updates.temperature = temperature;
  if (max_context_rounds !== undefined) updates.max_context_rounds = max_context_rounds;
  if (max_context_tokens !== undefined) updates.max_context_tokens = max_context_tokens;
  if (compress_threshold !== undefined) updates.compress_threshold = compress_threshold;
  if (compress_keep_rounds !== undefined) updates.compress_keep_rounds = compress_keep_rounds;
  if (max_reply_tokens !== undefined) updates.max_reply_tokens = max_reply_tokens;

  const { data, error } = await supabase
    .from('settings')
    .update(updates)
    .eq('session_id', 'global')
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ══════════════════════════════════════
//  Runtime Config APIs (hot-swap model/key/url from frontend)
// ══════════════════════════════════════

app.get('/api/runtime-config', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const rc = getRuntimeConfig();
  res.json({
    model: rc.model || process.env.CLAUDE_MODEL || '',
    api_key: rc.api_key ? '***' + rc.api_key.slice(-6) : (process.env.ANTHROPIC_API_KEY ? '***' + process.env.ANTHROPIC_API_KEY.slice(-6) : ''),
    api_base_url: rc.api_base_url || process.env.ANTHROPIC_BASE_URL || '',
    use_openai_compat: rc.use_openai_compat ?? (process.env.USE_OPENAI_COMPAT === 'true'),
  });
});

app.post('/api/runtime-config', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { model, api_key, api_base_url, use_openai_compat } = req.body;
  const updates = {};
  if (model !== undefined) updates.model = model;
  if (api_key !== undefined) updates.api_key = api_key;
  if (api_base_url !== undefined) updates.api_base_url = api_base_url;
  if (use_openai_compat !== undefined) updates.use_openai_compat = use_openai_compat;
  setRuntimeConfig(updates);
  res.json({ ok: true, config: { ...getRuntimeConfig(), api_key: updates.api_key ? '***' + updates.api_key.slice(-6) : undefined } });
});

// ── Model list (from relay /v1/models) ──
app.get('/api/models', async (req, res) => {
  if (!checkAdmin(req, res)) return;
  const rc = getRuntimeConfig();
  const apiKey = rc.api_key || process.env.ANTHROPIC_API_KEY || '';
  const baseURL = (rc.api_base_url || process.env.ANTHROPIC_BASE_URL || '').replace(/\/+$/, '');
  if (!baseURL || !apiKey) {
    return res.status(400).json({ error: 'API地址或Key未配置' });
  }
  try {
    const resp = await fetch(`${baseURL}/v1/models`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      return res.status(resp.status).json({ error: `中转站返回 ${resp.status}`, detail: txt.slice(0, 500) });
    }
    const body = await resp.json();
    const models = (body.data || []).map(m => ({ id: m.id, owned_by: m.owned_by || '' }));
    res.json({ models });
  } catch (e) {
    res.status(502).json({ error: '无法连接中转站', detail: e.message });
  }
});

// ══════════════════════════════════════
//  Sticker APIs
// ══════════════════════════════════════

app.get('/api/stickers', async (req, res) => {
  const category = req.query.category;
  let query = supabase
    .from('stickers')
    .select('*')
    .order('sort_order', { ascending: true });
  if (category) query = query.eq('category', category);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/stickers', async (req, res) => {
  const { id, description, image_url, category } = req.body;
  if (!id || !description || !image_url) {
    return res.status(400).json({ error: 'id, description, image_url required' });
  }
  const { data, error } = await supabase
    .from('stickers')
    .upsert({ id, description, image_url, category: category || '默认' })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/stickers/:id', async (req, res) => {
  const { error } = await supabase
    .from('stickers')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ══════════════════════════════════════
//  Space (日记/碎碎念) APIs
// ══════════════════════════════════════

app.get('/api/space/posts', async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;
  const { data, error } = await supabase
    .from('space_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/space/posts', async (req, res) => {
  const { content, mood, image_url, author } = req.body;
  if (!content) return res.status(400).json({ error: 'content required' });
  const { data, error } = await supabase
    .from('space_posts')
    .insert({
      content,
      mood: mood || null,
      image_url: image_url || null,
      author: author || 'miao',
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.patch('/api/space/posts/:id', async (req, res) => {
  const { content, mood, image_url, pinned } = req.body;
  const updates = { updated_at: new Date().toISOString() };
  if (content !== undefined) updates.content = content;
  if (mood !== undefined) updates.mood = mood;
  if (image_url !== undefined) updates.image_url = image_url;
  if (pinned !== undefined) updates.pinned = pinned;
  const { data, error } = await supabase
    .from('space_posts')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/space/posts/:id', async (req, res) => {
  const { error } = await supabase
    .from('space_posts')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// Space comments
app.get('/api/space/posts/:id/comments', async (req, res) => {
  const { data, error } = await supabase
    .from('space_comments')
    .select('*')
    .eq('post_id', req.params.id)
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/space/posts/:id/comments', async (req, res) => {
  const { content, author } = req.body;
  if (!content) return res.status(400).json({ error: 'content required' });
  const { data, error } = await supabase
    .from('space_comments')
    .insert({
      post_id: req.params.id,
      content,
      author: author || 'tong',
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ══════════════════════════════════════
//  Avatar APIs
// ══════════════════════════════════════

app.get('/api/avatars', async (req, res) => {
  const { data, error } = await supabase
    .from('avatars')
    .select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/avatars/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('avatars')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/avatars/:id', async (req, res) => {
  const { image_url } = req.body;
  const { data, error } = await supabase
    .from('avatars')
    .update({ image_url, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ══════════════════════════════════════
//  Memory APIs (manual)
// ══════════════════════════════════════

app.get('/api/memories', async (req, res) => {
  const { data, error } = await supabase
    .from('memories')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/memories', async (req, res) => {
  const { summary, session_id } = req.body;
  if (!summary) return res.status(400).json({ error: 'summary required' });
  const { data, error } = await supabase
    .from('memories')
    .insert({ summary, session_id: session_id || 'global' })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ══════════════════════════════════════
//  Health check
// ══════════════════════════════════════

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ── Serve frontend ──
// Disable ETags globally so browsers can't 304 on stale cached copies
app.disable('etag');

// Explicit route for index.html — reads fresh each time, full anti-cache headers
app.get('/', (req, res) => {
  const htmlPath = resolve(__dirname, '../private-space/index.html');
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store',
  });
  res.sendFile(htmlPath);
});

// Version endpoint for debugging
app.get('/api/version', (req, res) => {
  res.json({ version: Date.now(), node: process.version });
});

// Static files (CSS/JS/images) — also no-cache to be safe
app.use(express.static(resolve(__dirname, '../private-space'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-store');
  },
}));

app.listen(PORT, () => {
  console.log(`林苗 server running on :${PORT}`);
});
