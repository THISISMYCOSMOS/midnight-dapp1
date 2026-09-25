#!/usr/bin/env bash
# 영상 제작 도구 설치: 오프라인 한국어 TTS·검증용 음성인식 모델·폰트·렌더러
set -euo pipefail
cd "$(dirname "$0")"
pip3 install -q sherpa-onnx soundfile numpy imageio-ffmpeg "playwright==1.56.0"
mkdir -p .models fonts
REL=https://github.com/k2-fsa/sherpa-onnx/releases/download
[ -d .models/vits-mimic3-ko_KO-kss_low ] || curl -sSL "$REL/tts-models/vits-mimic3-ko_KO-kss_low.tar.bz2" | tar xj -C .models
if [ ! -d .models/sense-voice ]; then
  curl -sSL "$REL/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17.tar.bz2" | tar xj -C .models
  mv .models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17 .models/sense-voice
fi
if [ ! -f fonts/Pretendard-Bold.woff2 ]; then
  tmp=$(mktemp -d); (cd "$tmp" && npm pack pretendard@1.3.9 --silent >/dev/null && tar xzf pretendard-*.tgz)
  cp "$tmp"/package/dist/web/static/woff2/Pretendard-{Regular,Medium,SemiBold,Bold}.woff2 fonts/
  rm -rf "$tmp"
fi
# Playwright 브라우저: 미리 설치된 것이 없을 때만
python3 -c "from playwright.sync_api import sync_playwright as s; p=s().start(); p.chromium.launch().close(); p.stop()" 2>/dev/null \
  || python3 -m playwright install chromium
echo "ready"
