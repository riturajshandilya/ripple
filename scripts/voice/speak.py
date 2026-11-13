"""Read private input from stdin; write audio to the caller's private temporary file."""
import json
import os
import sys

model_dir = os.path.abspath(sys.argv[1])
sys.path.insert(0, model_dir)
request = json.load(sys.stdin)
import torch
from mithi_tts import Mithi

torch.set_num_threads(4)
tts = Mithi(model_dir, device="cpu")
audio = tts.synthesize(request["text"], lang=request["lang"], voice="charvi")
tts.save(audio, request["output"])
