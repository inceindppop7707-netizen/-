#!/usr/bin/env python3
"""
抖音视频抓取脚本
解析抖音链接，提取视频信息，下载视频并抽帧
"""

import sys
import os
import re
import json
import subprocess
import urllib.request
import urllib.error
import math

MOBILE_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "Version/17.0 Mobile/15E148 Safari/604.1"
)

DESKTOP_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

OUTPUT_DIR = "/tmp/douyin_output"


def get_ttwid():
    req = urllib.request.Request(
        "https://ttwid.bytedance.com/ttwid/union/register/",
        data=json.dumps({
            "region": "cn", "aid": 1128, "needFid": False,
            "service": "www.douyin.com",
            "migrate_info": {"ticket": "", "source": "node"},
            "cbUrlProtocol": "https", "union": True
        }).encode(),
        headers={"Content-Type": "application/json", "User-Agent": DESKTOP_UA},
        method="POST"
    )
    resp = urllib.request.urlopen(req, timeout=10)
    for header in resp.headers.get_all("Set-Cookie") or []:
        if "ttwid=" in header:
            return header.split("ttwid=")[1].split(";")[0]
    return None


def resolve_url(url):
    """解析短链接，提取视频ID"""
    # 如果已经是完整链接，直接提取
    match = re.search(r"/video/(\d+)", url)
    if match:
        return match.group(1)

    match = re.search(r"/note/(\d+)", url)
    if match:
        return match.group(1)

    # 短链接需要跟踪重定向
    req = urllib.request.Request(url, headers={"User-Agent": MOBILE_UA})
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        final_url = resp.url
        match = re.search(r"/video/(\d+)", final_url)
        if match:
            return match.group(1)
        match = re.search(r"/note/(\d+)", final_url)
        if match:
            return match.group(1)
        # 可能在HTML里
        html = resp.read().decode("utf-8", errors="replace")
        match = re.search(r"video/(\d+)", html)
        if match:
            return match.group(1)
    except Exception as e:
        print(f"解析链接失败: {e}")

    return None


def get_video_detail(video_id, ttwid):
    """通过API获取视频详情"""
    api_url = (
        f"https://www.douyin.com/aweme/v1/web/aweme/detail/"
        f"?aweme_id={video_id}&aid=1128&version_code=170400"
    )
    headers = {
        "User-Agent": DESKTOP_UA,
        "Referer": "https://www.douyin.com/",
        "Cookie": f"ttwid={ttwid}",
    }
    req = urllib.request.Request(api_url, headers=headers)
    resp = urllib.request.urlopen(req, timeout=15)
    return json.loads(resp.read().decode())


def download_file(url, output_path, max_mb=200):
    headers = {
        "User-Agent": MOBILE_UA,
        "Referer": "https://www.douyin.com/",
    }
    req = urllib.request.Request(url, headers=headers)
    try:
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
                    print(f"文件超过{max_mb}MB限制")
                    break
                f.write(chunk)
        return True
    except Exception as e:
        print(f"下载失败: {e}")
        return False


def extract_frames(video_path, output_dir, min_frames=4, max_frames=8, interval=8):
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "csv=p=0", video_path],
            capture_output=True, text=True, timeout=30
        )
        duration = float(result.stdout.strip())
    except Exception:
        duration = 30

    num_frames = max(min_frames, min(max_frames, int(duration / interval)))
    fps = num_frames / duration if duration > 0 else 1

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


def extract_video_url(detail):
    """从详情中提取视频URL"""
    video = detail.get("video", {})
    if not video:
        return None

    # play_addr
    play_addr = video.get("play_addr", {})
    url_list = play_addr.get("url_list", [])
    if url_list:
        return url_list[0]

    # bit_rate里找
    bit_rate = video.get("bit_rate", [])
    if bit_rate:
        play = bit_rate[0].get("play_addr", {})
        urls = play.get("url_list", [])
        if urls:
            return urls[0]

    return None


def extract_images(detail):
    """从图文笔记中提取图片"""
    images = detail.get("images", [])
    urls = []
    for img in images:
        url_list = img.get("url_list", [])
        if url_list:
            urls.append(url_list[-1])
    return urls


def main(url):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    # 清理旧文件
    for f in os.listdir(OUTPUT_DIR):
        os.remove(os.path.join(OUTPUT_DIR, f))

    print(f"正在解析: {url}")

    video_id = resolve_url(url)
    if not video_id:
        print("无法提取视频ID")
        return
    print(f"视频ID: {video_id}")

    print("获取ttwid...")
    ttwid = get_ttwid()
    if not ttwid:
        print("获取ttwid失败")
        return

    print("获取视频详情...")
    data = get_video_detail(video_id, ttwid)

    detail = data.get("aweme_detail")
    if not detail:
        filter_info = data.get("filter_detail", {})
        print(f"视频不可用: {filter_info.get('filter_reason', '未知原因')}")
        return

    # 基本信息
    desc = detail.get("desc", "")
    author = detail.get("author", {})
    nickname = author.get("nickname", "未知")
    uid = author.get("unique_id") or author.get("short_id", "?")
    stats = detail.get("statistics", {})
    digg = stats.get("digg_count", "?")
    comment_count = stats.get("comment_count", "?")
    share_count = stats.get("share_count", "?")
    collect = stats.get("collect_count", "?")

    # 判断类型
    images = detail.get("images")
    is_note = images is not None and len(images) > 0

    print("\n" + "=" * 50)
    print(f"描述: {desc}")
    print(f"作者: {nickname} (@{uid})")
    print(f"互动: {digg}赞 | {comment_count}评论 | {share_count}分享 | {collect}收藏")
    print(f"类型: {'图文' if is_note else '视频'}")
    print("=" * 50)

    if is_note:
        img_urls = extract_images(detail)
        print(f"\n共 {len(img_urls)} 张图片")
        for i, img_url in enumerate(img_urls):
            img_path = os.path.join(OUTPUT_DIR, f"img_{i+1}.jpg")
            if download_file(img_url, img_path):
                print(f"  图{i+1}: {img_path}")
    else:
        video_url = extract_video_url(detail)
        if video_url:
            print(f"\n视频URL: {video_url[:80]}...")
            video_path = os.path.join(OUTPUT_DIR, "video.mp4")
            if download_file(video_url, video_path):
                size_mb = os.path.getsize(video_path) / 1024 / 1024
                print(f"视频下载完成 ({size_mb:.1f}MB)，开始抽帧...")
                frames = extract_frames(video_path, OUTPUT_DIR)
                if frames:
                    print(f"抽取了 {len(frames)} 帧:")
                    for f in frames:
                        print(f"  {f}")
                os.remove(video_path)
        else:
            # 下载封面
            cover = detail.get("video", {}).get("cover", {})
            cover_urls = cover.get("url_list", [])
            if cover_urls:
                cover_path = os.path.join(OUTPUT_DIR, "cover.jpg")
                if download_file(cover_urls[-1], cover_path):
                    print(f"封面: {cover_path}")

    print(f"\n所有文件保存在: {OUTPUT_DIR}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python3 douyin_peek.py <抖音链接>")
        sys.exit(1)
    main(sys.argv[1])
