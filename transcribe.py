import whisper
import sys
import json
import os

# fix ffmpeg path
os.environ["PATH"] += os.pathsep + "/usr/bin"

try:
    model = whisper.load_model("tiny", device="cpu")

    audio_file = sys.argv[1]

    result = model.transcribe(audio_file)

    segments = result.get("segments", [])

    print(json.dumps(segments))

except Exception as e:
    print(json.dumps({"error": str(e)}))