import numpy as np
import cv2
import easyocr
from fastapi import FastAPI, UploadFile

app = FastAPI(title="Clarity API")

# Load the OCR model once at startup, not per request
reader = easyocr.Reader(["en"])


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
