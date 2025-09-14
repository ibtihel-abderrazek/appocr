# services/ocrmypdf_runner.py
import sys
import subprocess

# Forcer UTF-8 sur Windows pour les emojis
sys.stdout.reconfigure(encoding='utf-8')

if len(sys.argv) < 3:
    print("Usage: ocrmypdf_runner.py <input.pdf> <output.pdf> [options]")
    sys.exit(1)

input_pdf = sys.argv[1]
output_pdf = sys.argv[2]
options = sys.argv[3:]  # autres options

# Construire la commande CLI
cmd = ["ocrmypdf", "--force-ocr", input_pdf, output_pdf] + options

# Lancer la commande
try:
    subprocess.run(cmd, check=True)
    print(f"✅ PDF OCRisé créé : {output_pdf}")
except subprocess.CalledProcessError as e:
    print("❌ Erreur OCRmypdf :", e)
