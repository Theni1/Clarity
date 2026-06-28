import numpy as np
import cv2
import easyocr
from ultralytics import YOLO
from fastapi import FastAPI, UploadFile

app = FastAPI(title="Clarity API")

# Load models once at startup, not per request
reader = easyocr.Reader(["en"])
detector = YOLO("yolo11n.pt")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/read-text")
async def read_text(image: UploadFile):
    raw = await image.read()
    img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)

    results = reader.readtext(img)

    detections = [
        {
            "text": text,
            "box": [[int(x), int(y)] for x, y in box],
            "confidence": float(conf),
        }
        for box, text, conf in results
    ]
    return {"detections": detections}


@app.post("/detect")
async def detect(image: UploadFile):
    raw = await image.read()
    img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)

    results = detector(img)[0]  # one image in → take its result

    detections = []
    for b in results.boxes:
        x1, y1, x2, y2 = b.xyxy[0].tolist()
        detections.append(
            {
                "label": detector.names[int(b.cls)],
                "box": [int(x1), int(y1), int(x2), int(y2)],
                "confidence": float(b.conf),
            }
        )
    return {"detections": detections}
