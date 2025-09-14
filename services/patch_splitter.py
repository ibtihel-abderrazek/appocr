import sys
import fitz 
import cv2
import numpy as np
import os
import json
from pyzbar.pyzbar import decode

def detect_patch(image, debug=False):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 50, 255, cv2.THRESH_BINARY_INV)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        aspect_ratio = w / h
        area = w * h
        if 0.5 <= aspect_ratio <= 2.0 and area > 500:
            if debug:
                print(f"Patch détecté : x={x}, y={y}, w={w}, h={h}, area={area}")
            return True
    return False

def detect_barcode(image, debug=False):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
    codes = decode(gray)
    if debug and codes:
        for code in codes:
            print(f"Code-barres détecté : {code.data.decode()} type={code.type}")
    return len(codes) > 0

def split_pdf(pdf_path, mode=None, debug=False):
    doc = fitz.open(pdf_path)
    output_files = []
    current_doc = fitz.open()
    file_index = 1

    for i, page in enumerate(doc):
        pix = page.get_pixmap()
        img = cv2.imdecode(
            np.frombuffer(pix.tobytes("png"), dtype=np.uint8),
            cv2.IMREAD_COLOR
        )

        separate = False
        if mode == "patch":
            separate = detect_patch(img, debug=debug)
        elif mode == "barcode":
            separate = detect_barcode(img, debug=debug)
        else:  
            separate = detect_patch(img, debug=debug) or detect_barcode(img, debug=debug)

        if debug:
            print(f"Page {i+1} séparée ? {separate}")

        if separate:
            if len(current_doc) > 0:
                out_path = f"{os.path.splitext(pdf_path)[0]}_part{file_index}.pdf"
                current_doc.save(out_path)
                output_files.append(out_path)
                current_doc.close()
                current_doc = fitz.open()
                file_index += 1
            continue

        current_doc.insert_pdf(doc, from_page=i, to_page=i)

    if len(current_doc) > 0:
        out_path = f"{os.path.splitext(pdf_path)[0]}_part{file_index}.pdf"
        current_doc.save(out_path)
        output_files.append(out_path)
        current_doc.close()

    return output_files

if __name__ == "__main__":
    pdf_path = sys.argv[1]
    user_mode = None
    if len(sys.argv) > 2:
        if sys.argv[2].lower() in ["patch", "barcode"]:
            user_mode = sys.argv[2].lower()

    files = split_pdf(pdf_path, mode=user_mode, debug=False) 
    print(json.dumps(files))
