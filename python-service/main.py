"""
spaCy NER sidecar for brand-extractor.

Run:
    pip install -r requirements.txt
    python -m spacy download en_core_web_sm
    uvicorn main:app --port 8000

POST /extract  { "text": "...", "title": "...", "url": "..." }
  -> { "brand": "...", "candidates": [{"name": "...", "count": N}, ...] }
"""
from collections import Counter
from urllib.parse import urlparse

import spacy
from fastapi import FastAPI
from pydantic import BaseModel

nlp = spacy.load("en_core_web_sm")
app = FastAPI()


class ExtractRequest(BaseModel):
    text: str = ""
    title: str = ""
    url: str = ""


def domain_root(url: str) -> str:
    if not url:
        return ""
    host = urlparse(url).hostname or ""
    host = host.removeprefix("www.")
    return host.split(".")[0].lower() if host else ""


@app.post("/extract")
def extract(req: ExtractRequest):
    # Cap input — spaCy small model handles ~1M chars but we don't need that.
    counts: Counter[str] = Counter()
    for chunk in (req.title, req.text[:200_000]):
        if not chunk:
            continue
        for ent in nlp(chunk).ents:
            if ent.label_ in ("ORG", "PRODUCT", "WORK_OF_ART"):
                name = " ".join(ent.text.split())
                if 2 <= len(name) <= 60 and not name.isdigit():
                    counts[name] += 1

    root = domain_root(req.url)

    def score(item):
        name, count = item
        s = count
        # Boost names that match the domain root
        if root and root in name.lower().replace(" ", ""):
            s += 50
        # Boost names that appear in <title>
        if req.title and name.lower() in req.title.lower():
            s += 20
        return s

    ranked = sorted(counts.items(), key=score, reverse=True)
    candidates = [{"name": n, "count": c} for n, c in ranked[:10]]
    brand = candidates[0]["name"] if candidates else ""

    return {"brand": brand, "candidates": candidates}


@app.get("/health")
def health():
    return {"ok": True}
