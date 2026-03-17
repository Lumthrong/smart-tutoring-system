import whisper
import sys
import json

model = whisper.load_model("tiny")

audio_file = sys.argv[1]

result = model.transcribe(audio_file)



segments = result["segments"]

print(json.dumps(segments))