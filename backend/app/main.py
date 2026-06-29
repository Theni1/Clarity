import numpy as np
import cv2
import easyocr
from ultralytics import YOLO
from fastapi import FastAPI, UploadFile

app = FastAPI(title="Clarity API")

# Load models once at startup, not per request
reader = easyocr.Reader(["en"])
detector = YOLO("yolo11x.pt")
DETECT_MIN_CONFIDENCE = 0.3  # drop detections below this (cuts false positives)


async def _decode(image: UploadFile):
    raw = await image.read()
    return cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)


def _read_text(img):
    # mag_ratio=2 upscales the image before OCR (better at small/hard-to-read text)
    return [
        {
            "text": text,
            "box": [[int(x), int(y)] for x, y in box],
            "confidence": float(conf),
        }
        for box, text, conf in reader.readtext(img, mag_ratio=2)
    ]


def _detect_objects(img):
    results = detector(img, conf=DETECT_MIN_CONFIDENCE, verbose=False)[0]
    return [
        {
            "label": detector.names[int(b.cls)],
            "box": [int(v) for v in b.xyxy[0].tolist()],
            "confidence": float(b.conf),
        }
        for b in results.boxes
    ]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/read-text")
async def read_text(image: UploadFile):
    img = await _decode(image)
    return {"detections": _read_text(img)}


@app.post("/detect")
async def detect(image: UploadFile):
    img = await _decode(image)
    return {"detections": _detect_objects(img)}


@app.post("/identify")
async def identify(image: UploadFile):
    img = await _decode(image)

    text_detections = _read_text(img)
    objects = _detect_objects(img)

    # Top-1 object only (most confident), or None if nothing detected.
    top = max(objects, key=lambda o: o["confidence"], default=None)

    return {
        "object": top["label"] if top else None,
        "object_box": top["box"] if top else None,
        "detections": text_detections,
    }
