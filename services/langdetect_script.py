# services/langdetect_script.py
from langdetect import detect
import sys

if len(sys.argv) < 2:
    print("error")
    sys.exit(1)

text = sys.argv[1]
try:
    lang = detect(text)
    print(lang)
except Exception:
    print("error")
