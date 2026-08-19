# Nyaya Mitra — DoJ RAG Assistant (SIH1700)

This project is a grounded information assistant for the Department of Justice and official eCourts services. It retrieves only from `data/doj_sources.json`; it does not fabricate case status, hearing dates, judicial statistics, or legal advice.

## Architecture

- Corpus: manually reviewed official DoJ, eCourts, ePay, eFiling, and Tele-Law sources.
- Retrieval: local deterministic lexical TF-IDF-style index, 900-character chunks, 150-character overlap, top 3. No third-party embeddings or vector database are used.
- Metadata on every chunk: `source_url`, `section`, `last_verified_date`.
- Generation: extractive grounded response by default. If `GROQ_API_KEY` is configured, Groq receives only the retrieved context and the strict system prompt in `main.py`.
- Language: Hindi is detected from Devanagari input; English otherwise. Hinglish is currently treated as English.

## Run

```bash
cp .env.example .env
pip install -r requirements.txt
python ingest_doj.py
python -m uvicorn main:app --reload --port 8000
```

Open `http://localhost:8000/`.

## Safety

- `.env` is ignored and no API key is committed.
- User input is length-limited and instruction-override phrases are neutralized.
- Queries containing likely CNR numbers or Indian phone numbers are refused and never logged.
- The chat endpoint limits each client IP to 20 requests per minute per process.
- Case lookup returns the official eCourts portal instead of simulating results.

## Validation

```bash
python -m pytest -q
python evals/run_retrieval_eval.py
```

`evals/gold_set.json` tracks 30 SIH1700 retrieval questions. It is intentionally diagnostic, not a release gate; evaluate answer groundedness whenever the corpus, chunking, or prompt changes.
