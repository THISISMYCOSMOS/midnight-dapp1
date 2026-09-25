"""대본(script.json)을 문장 단위로 합성해 narration.wav와 timeline.json을 만든다.

- 음성: sherpa-onnx + vits-mimic3-ko_KO-kss_low (오프라인 한국어 TTS)
- 검증: SenseVoice로 합성 음성을 다시 받아 적어 out/asr-check.txt에 남긴다
- 직접 녹음으로 바꾸려면 out/lines/<장면id>-<번호>.wav를 같은 이름으로 덮어쓰고
  `--reuse`로 실행한다. 길이는 파일에서 다시 잰다.
"""
import argparse
import json
import pathlib

import numpy as np
import soundfile as sf

HERE = pathlib.Path(__file__).parent
SR = 22050
LEAD_IN = 3.2      # 타이틀 카드 뒤 첫 문장까지
LINE_GAP = 0.35    # 같은 장면 안 문장 사이
SCENE_GAP = 0.9    # 장면 전환
TAIL = 3.4         # 마지막 문장 뒤 엔딩 카드


def load_tts(model_dir: pathlib.Path):
    import sherpa_onnx
    m = model_dir / "vits-mimic3-ko_KO-kss_low"
    cfg = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                model=str(m / "ko_KO-kss_low.onnx"),
                tokens=str(m / "tokens.txt"),
                data_dir=str(m / "espeak-ng-data"),
                noise_scale=0.3,    # 발음 흔들림을 줄인다 (SenseVoice CER 0.13 → 0.12)
                noise_scale_w=0.4,
            ),
            num_threads=4,
        )
    )
    return sherpa_onnx.OfflineTts(cfg)


def load_asr(model_dir: pathlib.Path):
    import sherpa_onnx
    d = model_dir / "sense-voice"
    if not d.exists():
        return None
    return sherpa_onnx.OfflineRecognizer.from_sense_voice(
        model=str(d / "model.int8.onnx"), tokens=str(d / "tokens.txt"),
        language="ko", use_itn=True, num_threads=4,
    )


def trim(x: np.ndarray, thresh=0.01, pad=0.04) -> np.ndarray:
    idx = np.where(np.abs(x) > thresh)[0]
    if len(idx) == 0:
        return x
    p = int(pad * SR)
    return x[max(0, idx[0] - p): idx[-1] + p]


def _ts(sec: float) -> str:
    ms = int(round(sec * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--speed", type=float, default=0.92)
    ap.add_argument("--models", default=str(HERE / ".models"))
    ap.add_argument("--reuse", action="store_true", help="out/lines의 기존 wav를 그대로 쓴다")
    args = ap.parse_args()

    script = json.loads((HERE / "script.json").read_text(encoding="utf-8"))
    out = HERE / "out"
    lines_dir = out / "lines"
    lines_dir.mkdir(parents=True, exist_ok=True)
    models = pathlib.Path(args.models)
    tts = None if args.reuse else load_tts(models)
    asr = load_asr(models)

    chunks, timeline, asr_log = [], {"scenes": []}, []
    t = LEAD_IN
    chunks.append(np.zeros(int(LEAD_IN * SR), dtype=np.float32))
    for si, scene in enumerate(script["scenes"]):
        if si > 0:
            chunks.append(np.zeros(int(SCENE_GAP * SR), dtype=np.float32))
            t += SCENE_GAP
        entry = {"id": scene["id"], "label": scene["label"], "start": t, "lines": []}
        for li, line in enumerate(scene["lines"]):
            if li > 0:
                chunks.append(np.zeros(int(LINE_GAP * SR), dtype=np.float32))
                t += LINE_GAP
            wav = lines_dir / f"{scene['id']}-{li + 1}.wav"
            if args.reuse and wav.exists():
                x, sr = sf.read(wav, dtype="float32")
                if x.ndim > 1:
                    x = x.mean(1)
                assert sr == SR, f"{wav}: {sr}Hz — {SR}Hz로 맞춰 주세요"
            else:
                a = tts.generate(line.get("say", line["text"]), sid=0, speed=args.speed)
                x = trim(np.asarray(a.samples, dtype=np.float32))
                sf.write(wav, x, SR)
            dur = len(x) / SR
            entry["lines"].append({"text": line["text"], "start": t, "end": t + dur})
            chunks.append(x)
            t += dur
            if asr is not None:
                s = asr.create_stream()
                s.accept_waveform(SR, x)
                asr.decode_stream(s)
                asr_log.append(f"[{scene['id']}-{li + 1}] {line['text']}\n    ASR: {s.result.text}")
        entry["end"] = t
        timeline["scenes"].append(entry)

    chunks.append(np.zeros(int(TAIL * SR), dtype=np.float32))
    t += TAIL
    audio = np.concatenate(chunks)
    peak = float(np.max(np.abs(audio))) or 1.0
    audio = audio * (0.89 / peak)
    sf.write(out / "narration.wav", audio, SR)
    timeline["duration"] = t
    timeline["title"] = script["title"]
    timeline["subtitle"] = script["subtitle"]
    (out / "timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=2), encoding="utf-8")
    srt = []
    for n, line in enumerate((l for sc in timeline["scenes"] for l in sc["lines"]), 1):
        srt.append(f"{n}\n{_ts(line['start'])} --> {_ts(line['end'] + 0.3)}\n{line['text']}\n")
    (out / "subtitles.srt").write_text("\n".join(srt), encoding="utf-8")
    if asr_log:
        (out / "asr-check.txt").write_text("\n".join(asr_log) + "\n", encoding="utf-8")
    print(f"duration {t:.2f}s, lines {sum(len(s['lines']) for s in timeline['scenes'])}")
    for s in timeline["scenes"]:
        print(f"  {s['id']:<9} {s['start']:7.2f} → {s['end']:7.2f}  ({s['end'] - s['start']:.1f}s)")


if __name__ == "__main__":
    main()
