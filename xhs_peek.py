#!/usr/bin/env python3
"""
小红书笔记抓取脚本
用手机UA访问小红书链接，解析笔记内容（文字+图片+视频抽帧）
"""

import sys
import os
import re
import json
import subprocess
import urllib.request
import urllib.error
import tempfile
import math

MOBILE_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "Version/17.0 Mobile/15E148 Safari/604.1"
)

OUTPUT_DIR = "/tmp/xhs_output"


def fetch_page(url):
    """用手机UA抓取页面HTML"""
    # 处理短链跳转
    req = urllib.request.Request(url, headers={"User-Agent": MOBILE_UA})
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        final_url = resp.url
        html = resp.read().decode("utf-8", errors="replace")
        return html, final_url
    except urllib.error.HTTPError as e:
        print(f"HTTP错误: {e.code}")
        return None, None


def parse_initial_state(html):
    """从HTML中提取__INITIAL_STATE__数据"""
    pattern = r'window\.__INITIAL_STATE__\s*=\s*({.*?})\s*</script>'
    match = re.search(pattern, html, re.DOTALL)
    if not match:
        pattern = r'window\.__INITIAL_STATE__\s*=\s*({.*?});\s*</script>'
        match = re.search(pattern, html, re.DOTALL)
    if not match:
        return None

    raw = match.group(1)
    # 替换undefined为null
    raw = re.sub(r'\bundefined\b', 'null', raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # 再试一次，更激进的清理
        raw = raw.replace("undefined", "null")
        try:
            return json.loads(raw)
        except json.JSONDecodeError as e:
            print(f"JSON解析失败: {e}")
            return None


def extract_note_data(state):
    """从state中提取笔记数据"""
    # 尝试多种路径
    paths = [
        lambda s: s.get("noteData", {}).get("data", {}).get("noteData"),
        lambda s: s.get("note", {}).get("noteDetailMap", {}),
        lambda s: s.get("note", {}).get("note", {}),
    ]

    for path_fn in paths:
        try:
            result = path_fn(state)
            if result:
                # 如果是noteDetailMap，取第一个值
                if isinstance(result, dict) and all(len(k) > 10 for k in result.keys()):
                    first_key = list(result.keys())[0]
                    result = result[first_key].get("note", result[first_key])
                return result
        except (KeyError, AttributeError, TypeError):
            continue

    return None


def download_image(url, output_path):
    """下载图片"""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": MOBILE_UA})
        resp = urllib.request.urlopen(req, timeout=15)
        with open(output_path, "wb") as f:
            f.write(resp.read())
        return True
    except Exception as e:
        print(f"图片下载失败: {e}")
        return False


def download_video(url, output_path, max_mb=200):
    """下载视频（限制大小）"""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": MOBILE_UA})
        resp = urllib.request.urlopen(req, timeout=30)
        size = 0
        max_bytes = max_mb * 1024 * 1024
        with open(output_path, "wb") as f:
            while True:
                chunk = resp.read(8192)
                if not chunk:
                    break
                size += len(chunk)
                if size > max_bytes:
                    print(f"视频超过{max_mb}MB限制，截断")
                    break
                f.write(chunk)
        return True
    except Exception as e:
        print(f"视频下载失败: {e}")
        return False


def extract_frames(video_path, output_dir, min_frames=4, max_frames=8, interval=8):
    """用ffmpeg从视频中抽帧"""
    # 获取视频时长
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "csv=p=0", video_path],
            capture_output=True, text=True, timeout=30
        )
        duration = float(result.stdout.strip())
    except Exception:
        duration = 30  # 默认30秒

    num_frames = max(min_frames, min(max_frames, int(duration / interval)))
    fps = num_frames / duration

    try:
        subprocess.run(
            ["ffmpeg", "-y", "-v", "error", "-i", video_path,
             "-vf", f"fps={fps},scale='min(960,iw)':-2",
             "-q:v", "4", os.path.join(output_dir, "frame-%02d.jpg")],
            timeout=60
        )
    except Exception as e:
        print(f"抽帧失败: {e}")
        return []

    frames = sorted([
        os.path.join(output_dir, f)
        for f in os.listdir(output_dir)
        if f.startswith("frame-") and f.endswith(".jpg")
    ])
    return frames


def get_video_url(note_data):
    """从笔记数据中提取视频URL"""
    video = note_data.get("video", {})
    if not video:
        return None

    # 尝试多种路径
    try:
        streams = video.get("media", {}).get("stream", {})
        for codec in ["h264", "h265", "av1"]:
            codec_streams = streams.get(codec, [])
            if codec_streams:
                url = codec_streams[0].get("masterUrl")
                if url:
                    return url
                backups = codec_streams[0].get("backupUrls", [])
                if backups:
                    return backups[0]
    except (KeyError, IndexError, TypeError):
        pass

    # 老结构
    try:
        key = video.get("consumer", {}).get("originVideoKey")
        if key:
            return f"https://sns-video-bd.xhscdn.com/{key}"
    except (KeyError, TypeError):
        pass

    try:
        url = video.get("url")
        if url:
            return url
    except (KeyError, TypeError):
        pass

    return None


def main(url):
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print(f"正在抓取: {url}")
    html, final_url = fetch_page(url)
    if not html:
        print("页面抓取失败")
        return

    state = parse_initial_state(html)
    if not state:
        print("未找到__INITIAL_STATE__数据")
        # 尝试直接从HTML提取信息
        title_match = re.search(r'<title>(.*?)</title>', html)
        if title_match:
            print(f"页面标题: {title_match.group(1)}")
        return

    note = extract_note_data(state)
    if not note:
        print("未找到笔记数据，输出原始state的keys:")
        print(json.dumps(list(state.keys()), ensure_ascii=False, indent=2))
        # 保存raw state供调试
        with open(os.path.join(OUTPUT_DIR, "raw_state.json"), "w") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
        print(f"原始数据已保存到 {OUTPUT_DIR}/raw_state.json")
        return

    # 输出文字内容
    title = note.get("title", "")
    desc = note.get("desc", "")
    user = note.get("user", {})
    author = user.get("nickname", "未知")
    interact = note.get("interactInfo", {})
    liked = interact.get("likedCount", "?")
    collected = interact.get("collectedCount", "?")
    comment_count = interact.get("commentCount", "?")
    share_count = interact.get("shareCount", "?")
    note_type = note.get("type", "")

    print("\n" + "=" * 50)
    print(f"标题: {title}")
    print(f"作者: {author}")
    print(f"正文: {desc}")
    print(f"互动: {liked}赞 | {collected}收藏 | {comment_count}评论 | {share_count}分享")
    print(f"类型: {'视频' if note_type == 'video' else '图文'}")
    print("=" * 50)

    # 处理图片
    image_list = note.get("imageList", [])
    if image_list:
        print(f"\n共 {len(image_list)} 张图片")
        for i, img in enumerate(image_list):
            # 找最清晰的图
            info_list = img.get("infoList", [])
            img_url = None
            for info in info_list:
                if info.get("imageScene") == "WB_DFT":
                    img_url = info.get("url")
                    break
            if not img_url and info_list:
                img_url = info_list[-1].get("url")
            if not img_url:
                img_url = img.get("urlDefault") or img.get("url")

            if img_url:
                if not img_url.startswith("http"):
                    img_url = "https:" + img_url
                img_path = os.path.join(OUTPUT_DIR, f"img_{i+1}.jpg")
                if download_image(img_url, img_path):
                    print(f"  图{i+1}: {img_path}")

    # 处理视频
    if note_type == "video":
        video_url = get_video_url(note)
        if video_url:
            print(f"\n视频URL: {video_url[:80]}...")
            video_path = os.path.join(OUTPUT_DIR, "video.mp4")
            if download_video(video_url, video_path):
                print("视频下载完成，开始抽帧...")
                frames = extract_frames(video_path, OUTPUT_DIR)
                if frames:
                    print(f"抽取了 {len(frames)} 帧:")
                    for f in frames:
                        print(f"  {f}")
                # 删掉视频省空间
                os.remove(video_path)
        else:
            print("\n未找到视频URL")

    # 处理评论
    comments = note.get("comments", [])
    if comments:
        print(f"\n热门评论 ({len(comments)}条):")
        for c in comments[:5]:
            c_user = c.get("userInfo", {}).get("nickname", "?")
            c_content = c.get("content", "")
            c_likes = c.get("likeCount", 0)
            print(f"  {c_user}: {c_content} ({c_likes}赞)")

    print(f"\n所有文件保存在: {OUTPUT_DIR}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python3 xhs_peek.py <小红书链接>")
        sys.exit(1)
    main(sys.argv[1])
