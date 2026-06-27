from fastapi import FastAPI

app = FastAPI(title="Clarity API")


@app.get("/health")
def health():
    return {"status": "ok"}
