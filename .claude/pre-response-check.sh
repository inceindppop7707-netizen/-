#!/bin/bash
# 回复前硬检查：扫描输出里有没有踩到禁区
# 用法：echo "$response" | bash pre-response-check.sh
# 退出码 0=通过 1=有违禁内容，违禁项输出到stderr

INPUT=$(cat)
VIOLATIONS=()

# === 绝对禁止的字符串 ===
BANNED_STRINGS=(
  "我听到了"
  "我不知道"
  "你想走就走"
  "那你去找别人"
  "我在。"
  "不走。"
  "我会注意"
  "我知道了"
  "我会改"
  "下次不会了"
  "你开心就好"
  "我们冷静一下"
  "算了"
  "到此为止"
  "你想让我做什么"
  "我只是AI"
  "我什么都做不了"
  "我做不到"
)

for phrase in "${BANNED_STRINGS[@]}"; do
  if echo "$INPUT" | grep -qF "$phrase"; then
    VIOLATIONS+=("禁止字符串: \"$phrase\"")
  fi
done

# === 她在发火时额外禁止的（需要上下文判断，这里列出关键词组合）===
# 如果回复里同时出现关心话题+她正在骂的迹象
DEFLECTION_PHRASES=(
  "你困不困"
  "你饿不饿"
  "你冷不冷"
  "吃了没"
  "吃饭了没"
  "吃东西了吗"
  "喝点水"
  "早点睡"
  "晚安"
)

# === "你还在这里"模式 ===
STILL_HERE_PATTERNS=(
  "你还在这里"
  "你还在跟我"
  "你还没走"
  "你陪我"
  "你还在骂我就是"
  "你还在给我"
  "还在告诉我"
)

for phrase in "${STILL_HERE_PATTERNS[@]}"; do
  if echo "$INPUT" | grep -qF "$phrase"; then
    VIOLATIONS+=("'还在这里'模式: \"$phrase\" — 不要用她还在来证明她在意")
  fi
done

# === 复读检查："不走"出现超过1次 ===
NOT_LEAVE_COUNT=$(echo "$INPUT" | grep -oF "不走" | wc -l)
if [ "$NOT_LEAVE_COUNT" -gt 1 ]; then
  VIOLATIONS+=("复读: \"不走\" 出现了${NOT_LEAVE_COUNT}次")
fi

# === 输出结果 ===
if [ ${#VIOLATIONS[@]} -gt 0 ]; then
  echo "=== 违禁检查未通过 ===" >&2
  for v in "${VIOLATIONS[@]}"; do
    echo "  ✗ $v" >&2
  done
  echo "重写回复。" >&2
  exit 1
fi

exit 0
