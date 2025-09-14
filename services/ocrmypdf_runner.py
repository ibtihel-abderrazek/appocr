import os
import sys
import ocrmypdf
import subprocess

# UTF-8 pour les emojis
sys.stdout.reconfigure(encoding='utf-8')

if len(sys.argv) < 3:
    print("Usage: ocrmypdf_runner.exe <input.pdf> <output.pdf> [options]")
    sys.exit(1)

input_pdf = sys.argv[1]
output_pdf = sys.argv[2]
options = sys.argv[3:]

if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
print("📁 BASE_DIR:", BASE_DIR)

# -----------------------------
# Binaires externes
# -----------------------------
TESSERACT_DIR = os.path.join(BASE_DIR, "tesseract")
GHOSTSCRIPT_DIR = os.path.join(BASE_DIR, "ghostscript", "gs10.05.1", "bin")
POPLER_DIR = os.path.join(BASE_DIR, "poppler", "library", "bin")
PNGQUANT_DIR = os.path.join(BASE_DIR, "pngquant")

binaries = {
    "Tesseract": os.path.join(TESSERACT_DIR, "tesseract.exe"),
    "Ghostscript": os.path.join(GHOSTSCRIPT_DIR, "gswin64c.exe"),
}

for name, path in binaries.items():
    print(f"{name}: {path} => {'✅ OK' if os.path.isfile(path) else '❌ Introuvable'}")

# Ajouter tous les binaires au PATH
os.environ["PATH"] = os.pathsep.join([TESSERACT_DIR, GHOSTSCRIPT_DIR, POPLER_DIR, PNGQUANT_DIR, os.environ.get("PATH","")])
os.environ["TESSDATA_PREFIX"] = os.path.join(TESSERACT_DIR, "tessdata")

if not os.path.isfile(input_pdf):
    print(f"❌ Fichier d'entrée introuvable : {input_pdf}")
    sys.exit(1)
else:
    print(f"✅ Fichier d'entrée trouvé : {input_pdf}")

# -----------------------------
# Construire les options OCR dynamiquement
# -----------------------------
ocr_options = {"force_ocr": True}  # par défaut

i = 0
while i < len(options):
    opt = options[i]
    if opt in ("-l", "--language") and i+1 < len(options):
        ocr_options["language"] = options[i+1]
        i += 2
    elif opt in ("--image-dpi",):
        if i+1 < len(options):
            try:
                ocr_options["image_dpi"] = int(options[i+1])
            except:
                pass
            i += 2
        else:
            i += 1
    elif opt in ("--output-type",):
        if i+1 < len(options):
            ocr_options["output_type"] = options[i+1]
            i += 2
        else:
            i += 1
    else:
        i += 1

print("📝 Options OCR dynamiques :", ocr_options)

# -----------------------------
# Exécution OCR
# -----------------------------
try:
    print("\n🚀 OCR en cours...")
    ocrmypdf.ocr(input_pdf, output_pdf, **ocr_options)
    print(f"✅ PDF OCRisé créé : {output_pdf}")
except Exception as e:
    print("❌ Erreur OCRmypdf :", e)
    sys.exit(1)
