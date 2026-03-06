from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import json
import re
import base64
import sys
import ebooklib
from ebooklib import epub
from contextlib import asynccontextmanager
from typing import Optional
import urllib.parse

# ============ PATH SETUP ============
# Electron will pass the 'userData' path as the first argument
BASE_OUTPUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.getcwd(), "output")

# Define subdirectories for organized storage
HISTORY_DIR = os.path.join(BASE_OUTPUT, "history")
JOBS_DIR = os.path.join(BASE_OUTPUT, "jobs")
EPUB_DIR = os.path.join(BASE_OUTPUT, "epubs")

# Create directories if they don't exist
for folder in [HISTORY_DIR, JOBS_DIR, EPUB_DIR]:
    os.makedirs(folder, exist_ok=True)

HISTORY_FILE = os.path.join(HISTORY_DIR, "jobs_history.json")
ACTIVE_SCRAPES_FILE = os.path.join(HISTORY_DIR, "active_scrapes.json")

# Helper functions for path management
def get_progress_file(job_id):
    return os.path.join(JOBS_DIR, f"{job_id}_progress.jsonl")

def get_epub_file(job_id):
    return os.path.join(EPUB_DIR, f"{job_id}.epub")

# ============ ENGINE LOGIC ============

@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"🚀 Engine starting... Data home: {BASE_OUTPUT}")
    yield
    print("💤 Engine shutting down...")

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def load_history():
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_history(history_data):
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history_data, f, ensure_ascii=False, indent=2)

def load_active_scrapes():
    if os.path.exists(ACTIVE_SCRAPES_FILE):
        with open(ACTIVE_SCRAPES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_active_scrapes(data):
    with open(ACTIVE_SCRAPES_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

jobs = load_history()
active_scrapes = load_active_scrapes()

# ============ MODELS ============
class FinalizeData(BaseModel):
    job_id: str
    novel_name: str
    author: str = ""
    cover_data: str = ""

class StopScrapeData(BaseModel):
    job_id: str
    reason: str = "user_requested"

class ResumeScrapeData(BaseModel):
    job_id: str
    start_url: str
    novel_name: str
    author: str = ""
    cover_data: str = ""

# ============ ENDPOINTS ============

@app.get("/api/history")
def get_history():
    return jobs

@app.get("/api/status/{job_id}")
def check_status(job_id: str):
    job_info = jobs.get(job_id, {"status": "not found", "novel_name": "Unknown"})
    status = job_info.get("status", "not found")
    progress_text = "0 chapters scraped"
    
    progress_file = get_progress_file(job_id)
    if os.path.exists(progress_file):
        try:
            with open(progress_file, "r", encoding="utf-8") as f:
                chapter_count = sum(1 for _ in f)
            progress_text = f"{chapter_count} chapters scraped"
        except Exception:
            pass
    
    if job_id in active_scrapes:
        status = "paused"
        progress_text += f" (Last: {active_scrapes[job_id].get('last_chapter', 'N/A')})"
    
    return {
        "job_id": job_id, 
        "status": status, 
        "progress": progress_text,
        "chapters_count": chapter_count,
        "novel_name": job_info.get("novel_name", "Unknown")
    }

@app.post("/api/save-chapter")
def save_chapter(data: dict):
    job_id = data.get("job_id")
    if not job_id:
        raise HTTPException(status_code=400, detail="Missing job_id")
        
    progress_file = get_progress_file(job_id)
    
    # 1. Prepare Chapter Data
    chapter_title = data.get("chapter_title", "Untitled")
    content = data.get("content", [])
    chapter_info = [chapter_title, content]
    
   # 2. Append to progress file (.jsonl)
    with open(progress_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(chapter_info, ensure_ascii=False) + "\n")
        
    # 👇 NEW: Count the total lines we currently have
    with open(progress_file, "r", encoding="utf-8") as f:
        current_count = sum(1 for _ in f)
    
    # 3. Update the Bookmark in memory (jobs dictionary)
    next_chapter_url = data.get("next_url") or data.get("start_url")

    if job_id not in jobs:
        jobs[job_id] = {
            "novel_name": data.get("novel_name", "Unknown Novel"),
            "status": "processing",
            "author": data.get("author", "Unknown"),
            "cover_data": data.get("cover_data", ""),
            "start_url": next_chapter_url,
            "chapters_count": current_count, # 👇 NEW: Save the count
            "last_updated": str(os.path.getmtime(progress_file)) if os.path.exists(progress_file) else ""
        }
    else:
        jobs[job_id]["status"] = "processing"
        jobs[job_id]["chapters_count"] = current_count # 👇 NEW: Update the count
        
        if next_chapter_url:
            jobs[job_id]["start_url"] = next_chapter_url
            
    # 4. Persistence: Force save to the .json file immediately
    save_history(jobs)
    
    print(f"📖 Saved: {chapter_title} | Bookmark set to: {next_chapter_url}")
    
    return {
        "status": "ok", 
        "job_id": job_id, 
        "bookmark_saved": next_chapter_url
    }

@app.post("/api/early-finalize")
def early_finalize(data: FinalizeData):
    job_id = data.job_id
    progress_file = get_progress_file(job_id)
    epub_file = get_epub_file(job_id)
    
    if not os.path.exists(progress_file):
        raise HTTPException(status_code=404, detail="No chapters found to create EPUB.")
    
    chapters = []
    with open(progress_file, "r", encoding="utf-8") as f:
        for line in f:
            chapters.append(json.loads(line))
    
    create_epub(
        novel_title=data.novel_name,
        author=data.author,
        chapters=chapters,
        output_filename=epub_file,
        cover_data=data.cover_data
    )
    
    # Remove from history instead of marking as completed
    if job_id in jobs: del jobs[job_id]
    if job_id in active_scrapes: del active_scrapes[job_id]
    
    save_history(jobs)
    save_active_scrapes(active_scrapes)
    
    # Clean up the progress file
    if os.path.exists(progress_file):
        os.remove(progress_file)
    
    return {"status": "completed", "epub_path": epub_file}

@app.post("/api/finalize-epub")
def finalize_epub(data: FinalizeData):
    job_id = data.job_id
    progress_file = get_progress_file(job_id)
    epub_file = get_epub_file(job_id)
    
    if not os.path.exists(progress_file):
        raise HTTPException(status_code=404, detail="No chapters found")
    
    chapters = []
    with open(progress_file, "r", encoding="utf-8") as f:
        for line in f:
            chapters.append(json.loads(line))
    
    create_epub(
        novel_title=data.novel_name,
        author=data.author,
        chapters=chapters,
        output_filename=epub_file,
        cover_data=data.cover_data
    )
    
    jobs[job_id]["status"] = "completed"
    jobs[job_id]["chapters_count"] = len(chapters)
    if job_id in active_scrapes:
        del active_scrapes[job_id]
        save_active_scrapes(active_scrapes)
    save_history(jobs)
    
    if os.path.exists(progress_file):
        os.remove(progress_file)
    
    return {"status": "completed", "epub_path": epub_file}


@app.get("/api/library")
def get_library():
    epubs = []
    if os.path.exists(EPUB_DIR):
        for file in os.listdir(EPUB_DIR):
            if file.endswith(".epub"):
                filepath = os.path.join(EPUB_DIR, file)
                
                # Default fallback names
                title = file.replace(".epub", "").replace("_", " ")
                author = "Unknown Author"
                
                # Extract the real Title and Author from the EPUB metadata
                try:
                    book = epub.read_epub(filepath)
                    title_meta = book.get_metadata('DC', 'title')
                    if title_meta: title = title_meta[0][0]
                    
                    author_meta = book.get_metadata('DC', 'creator')
                    if author_meta: author = author_meta[0][0]
                except Exception as e:
                    pass # If reading metadata fails, just use the fallback
                    
                epubs.append({
                    "filename": file, 
                    "title": title,
                    "author": author
                })
    return epubs

# 👇 NEW: Delete from Library Endpoint
@app.delete("/api/library/{filename}")
def delete_from_library(filename: str):
    clean_filename = urllib.parse.unquote(filename)
    file_path = os.path.join(EPUB_DIR, clean_filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        return {"status": "deleted"}
    raise HTTPException(status_code=404, detail="File not found")

# 👇 NEW: Export/Download Endpoint (renames it from job_id back to Novel Title)
@app.get("/api/library/download/{filename}")
def download_from_library(filename: str):
    clean_filename = urllib.parse.unquote(filename)
    file_path = os.path.join(EPUB_DIR, clean_filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    download_name = clean_filename
    try:
        book = epub.read_epub(file_path)
        title_meta = book.get_metadata('DC', 'title')
        if title_meta:
            raw_name = title_meta[0][0]
            # Strip invalid filename characters
            safe_name = re.sub(r'[\\/*?:"<>|]', "", raw_name).replace(" ", "_")
            download_name = f"{safe_name}.epub"
    except:
        pass
        
    return FileResponse(file_path, media_type='application/epub+zip', filename=download_name)

@app.get("/api/cover/{filename}")
def get_cover(filename: str):
    # 1. Ensure the filename is perfectly URL-decoded (fixes the %2C comma issue)
    clean_filename = urllib.parse.unquote(filename)
    epub_path = os.path.join(EPUB_DIR, clean_filename)
    
    if not os.path.exists(epub_path):
        raise HTTPException(status_code=404, detail="Not found")
    
    try:
        book = epub.read_epub(epub_path)
        
        # 2. Foolproof extraction: Find ANY image inside the EPUB
        # Since our scraper only adds the cover image, this works perfectly!
        for item in book.get_items():
            if item.media_type and item.media_type.startswith('image/'):
                return Response(content=item.get_content(), media_type=item.media_type)
                
    except Exception as e:
        print(f"Error reading cover for {clean_filename}: {e}")
        
    # Return a 404 if the EPUB literally has no images inside it
    raise HTTPException(status_code=404, detail="No cover found")

@app.get("/api/download/{job_id}")
def download_epub(job_id: str):
    file_path = get_epub_file(job_id)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="EPUB not ready")
    
    job_info = jobs.get(job_id, {})
    raw_name = job_info.get("novel_name", "Scraped_Novel")
    safe_name = re.sub(r'[\\/*?:"<>|]', "", raw_name).replace(" ", "_")
    
    return FileResponse(file_path, media_type='application/epub+zip', filename=f"{safe_name}.epub")

@app.post("/api/stop-scrape")
def stop_scrape(data: StopScrapeData):
    job_id = data.job_id
    
    # 🔥 FIX: If the user stops before the first chapter saves, just acknowledge it.
    if job_id not in jobs:
        return {"status": "paused", "job_id": job_id, "note": "Stopped before first save"}
    
    jobs[job_id]["status"] = "paused"
    save_history(jobs)
    
    progress_file = get_progress_file(job_id)
    chapter_count = 0
    last_chapter = "N/A"
    
    if os.path.exists(progress_file):
        with open(progress_file, "r", encoding="utf-8") as f:
            lines = f.readlines()
            chapter_count = len(lines)
            if lines:
                last_chapter = json.loads(lines[-1])[0]
    
    active_scrapes[job_id] = {"paused_at": chapter_count, "last_chapter": last_chapter}
    save_active_scrapes(active_scrapes)
    return {"status": "paused", "job_id": job_id}

@app.delete("/api/novel/{job_id}")
def delete_novel(job_id: str):
    files = [get_epub_file(job_id), get_progress_file(job_id)]
    for f in files:
        if os.path.exists(f): os.remove(f)
    
    if job_id in jobs: del jobs[job_id]
    if job_id in active_scrapes: del active_scrapes[job_id]
    save_history(jobs)
    save_active_scrapes(active_scrapes)
    return {"status": "deleted"}

def create_epub(novel_title, author, chapters, output_filename, cover_data=""):
    book = epub.EpubBook()
    book.set_title(novel_title)
    if author: book.add_author(author)
    
    if cover_data:
        try:
            header, encoded = cover_data.split(",", 1)
            ext = header.split(";")[0].split("/")[1]
            book.set_cover(f"cover.{ext}", base64.b64decode(encoded))
        except: pass
    
    spine = ['nav']
    toc = []
    for i, (title, content) in enumerate(chapters):
        chapter = epub.EpubHtml(title=title, file_name=f'chap_{i+1}.xhtml')
        chapter.content = f'<h1>{title}</h1>' + "".join([f'<p>{p}</p>' for p in content if p.strip()])
        book.add_item(chapter)
        spine.append(chapter)
        toc.append(chapter)

    book.toc = tuple(toc)
    book.add_item(epub.EpubNav())
    book.spine = spine
    epub.write_epub(output_filename, book)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    # Use port 8000 by default
    uvicorn.run(app, host="127.0.0.1", port=8000)