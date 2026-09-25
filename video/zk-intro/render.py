"""scenes.html을 프레임 단위로 캡처하고 narration.wav와 합쳐 out/zk-midnight-intro.mp4를 만든다.

  python3 render.py --stills 5 12 40          # 해당 초의 정지 화면만 out/stills/에
  python3 render.py                           # 전체 렌더 (1920x1080, 30fps)
"""
import argparse
import json
import pathlib
import subprocess
import sys
from concurrent.futures import ProcessPoolExecutor

HERE = pathlib.Path(__file__).parent
OUT = HERE / "out"
W, H = 1920, 1080


def ffmpeg_bin() -> str:
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def open_page(pw):
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
    timeline = (OUT / "timeline.json").read_text(encoding="utf-8")
    page.add_init_script(f"window.TIMELINE = {timeline};")
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto((HERE / "scenes.html").as_uri())
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(300)
    if errors:
        raise RuntimeError("scenes.html 오류: " + "; ".join(errors))
    return browser, page


def shot(page, t: float, **kw) -> bytes:
    page.evaluate(f"renderAt({t:.4f})")
    return page.locator("#stage").screenshot(**kw)


def render_segment(args):
    idx, f0, f1, fps = args
    from playwright.sync_api import sync_playwright
    seg = OUT / f"seg-{idx:02d}.mp4"
    cmd = [ffmpeg_bin(), "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(fps), "-c:v", "mjpeg",
           "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", str(fps), str(seg)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    with sync_playwright() as pw:
        browser, page = open_page(pw)
        for f in range(f0, f1):
            proc.stdin.write(shot(page, f / fps, type="jpeg", quality=95))
        browser.close()
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError(f"ffmpeg 실패: segment {idx}")
    return str(seg)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stills", nargs="*", type=float)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--workers", type=int, default=4)
    args = ap.parse_args()
    timeline = json.loads((OUT / "timeline.json").read_text(encoding="utf-8"))

    if args.stills is not None:
        from playwright.sync_api import sync_playwright
        (OUT / "stills").mkdir(parents=True, exist_ok=True)
        with sync_playwright() as pw:
            browser, page = open_page(pw)
            for t in args.stills:
                p = OUT / "stills" / f"t{t:06.1f}.png"
                p.write_bytes(shot(page, t))
                print(p)
            browser.close()
        return

    total = int(timeline["duration"] * args.fps)
    n = args.workers
    bounds = [(i, total * i // n, total * (i + 1) // n, args.fps) for i in range(n)]
    with ProcessPoolExecutor(n) as ex:
        segs = list(ex.map(render_segment, bounds))
    lst = OUT / "segments.txt"
    lst.write_text("".join(f"file '{pathlib.Path(s).name}'\n" for s in segs))
    final = OUT / "zk-midnight-intro.mp4"
    subprocess.run([ffmpeg_bin(), "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst),
                    "-i", str(OUT / "narration.wav"), "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
                    "-shortest", "-movflags", "+faststart", str(final)], check=True)
    for s in segs:
        pathlib.Path(s).unlink()
    lst.unlink()
    print(final)


if __name__ == "__main__":
    sys.exit(main())
