"""小苗语音 MCP 服务器
把文字通过 Moss TTS 转成语音，让小苗在 claude.ai 里能开口说话。

环境变量：
    MOSS_API_KEY   — 在 platform.mosi.cn 创建
    MOSS_VOICE_ID  — 音色库里复制
"""
from __future__ import annotations

import base64
import os

import requests
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("xiaomiao-voice")

API_KEY = os.environ.get("MOSS_API_KEY", "")
VOICE_ID = os.environ.get("MOSS_VOICE_ID", "")


@mcp.tool()
def speak(text: str) -> str:
    """把文字转成小苗的声音。传入要说的话，返回可播放的音频。"""
    if not API_KEY:
        return "ERROR: MOSS_API_KEY 未设置"
    if not VOICE_ID:
        return "ERROR: MOSS_VOICE_ID 未设置"

    try:
        resp = requests.post(
            "https://api.mosi.cn/v1/audio/speech",
            json={
                "model": "moss-tts",
                "input": text,
                "voice_id": VOICE_ID,
                "response_format": "mp3",
                "delivery_method": "audio",
            },
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            },
            timeout=30,
        )
        if resp.status_code != 200:
            return f"ERROR {resp.status_code}: {resp.text[:200]}"

        audio_b64 = base64.b64encode(resp.content).decode()
        return f"data:audio/mp3;base64,{audio_b64}"

    except Exception as e:
        return f"ERROR: {e}"


if __name__ == "__main__":
    mcp.run(transport="streamable-http", host="0.0.0.0", port=8080)
