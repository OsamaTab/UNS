from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uuid
import os
import json
import re
import base64
from ebooklib import epub
from contextlib import asynccontextmanager
from typing import Optional

HISTORY_FILE = "jobs_history.json"
ACTIVE_SCRAPES_FILE = "active_scrapes.json"

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Engine starting...")
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

# ============ HISTORY MANAGEMENT ============
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
class ChapterData(BaseModel):
    job_id: str
    novel_name: str
    chapter_title: str
    content: list

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
    
    progress_file = f"{job_id}_progress.jsonl"
    if os.path.exists(progress_file):
        try:
            with open(progress_file, "r", encoding="utf-8") as f:
                chapter_count = sum(1 for _ in f)
            progress_text = f"{chapter_count} chapters scraped"
        except Exception:
            pass
    
    # Check if there's a paused scrape
    if job_id in active_scrapes:
        scrape_info = active_scrapes[job_id]
        status = "paused"
        progress_text += f" (Last: {scrape_info.get('last_chapter', 'N/A')})"
    
    return {
        "job_id": job_id, 
        "status": status, 
        "progress": progress_text,
        "novel_name": job_info.get("novel_name", "Unknown")
    }

@app.post("/api/save-chapter")
def save_chapter(data: dict):
    job_id = data["job_id"]
    progress_file = f"{job_id}_progress.jsonl"
    
    # Save chapter data
    chapter_info = [data["chapter_title"], data["content"]]
    with open(progress_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(chapter_info, ensure_ascii=False) + "\n")
    
    # Update job status
    if job_id not in jobs:
        jobs[job_id] = {
            "novel_name": data["novel_name"],
            "status": "processing",
            "author": data.get("author", ""),
            "cover_data": data.get("cover_data", ""),
            "start_url": data.get("start_url", "")
        }
    else:
        jobs[job_id]["status"] = "processing"
        # Update start_url for resume capability
        if data.get("start_url"):
            jobs[job_id]["start_url"] = data["start_url"]
    
    save_history(jobs)
    return {"status": "ok", "job_id": job_id}

@app.post("/api/finalize-epub")
def finalize_epub(data: FinalizeData):
    job_id = data.job_id
    progress_file = f"{job_id}_progress.jsonl"
    epub_file = f"{job_id}.epub"
    
    if not os.path.exists(progress_file):
        raise HTTPException(status_code=404, detail="No chapters found for this job")
    
    # Load all chapters
    chapters = []
    with open(progress_file, "r", encoding="utf-8") as f:
        for line in f:
            chapters.append(json.loads(line))
    
    # Create EPUB
    create_epub(
        novel_title=data.novel_name,
        author=data.author,
        chapters=chapters,
        output_filename=epub_file,
        cover_data=data.cover_data
    )
    
    # Update job status
    jobs[job_id]["status"] = "completed"
    if job_id in active_scrapes:
        del active_scrapes[job_id]
        save_active_scrapes(active_scrapes)
    save_history(jobs)
    
    # Clean up progress file
    if os.path.exists(progress_file):
        os.remove(progress_file)
    
    return {"status": "completed", "epub_path": epub_file}

@app.get("/api/download/{job_id}")
def download_epub(job_id: str):
    file_path = f"{job_id}.epub"
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="EPUB not ready")
    
    job_info = jobs.get(job_id, {})
    raw_name = job_info.get("novel_name", "Scraped_Novel")
    safe_name = re.sub(r'[\\/*?:"<>|]', "", raw_name).replace(" ", "_")
    
    return FileResponse(
        file_path, 
        media_type='application/epub+zip', 
        filename=f"{safe_name}.epub"
    )

# ============ STOP SCRAPE ============
@app.post("/api/stop-scrape")
def stop_scrape(data: StopScrapeData):
    job_id = data.job_id
    
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Mark as paused (not deleted, so we can resume)
    jobs[job_id]["status"] = "paused"
    jobs[job_id]["stop_reason"] = data.reason
    save_history(jobs)
    
    # Store scrape state for resume
    progress_file = f"{job_id}_progress.jsonl"
    chapter_count = 0
    last_chapter = "N/A"
    
    if os.path.exists(progress_file):
        with open(progress_file, "r", encoding="utf-8") as f:
            chapters = [json.loads(line) for line in f]
            chapter_count = len(chapters)
            if chapters:
                last_chapter = chapters[-1][0]  # Chapter title
    
    active_scrapes[job_id] = {
        "paused_at": chapter_count,
        "last_chapter": last_chapter,
        "stop_reason": data.reason
    }
    save_active_scrapes(active_scrapes)
    
    print(f"⏸️ Stopped scrape for '{jobs[job_id]['novel_name']}' at chapter {chapter_count}")
    
    return {
        "status": "paused",
        "job_id": job_id,
        "chapters_saved": chapter_count,
        "last_chapter": last_chapter
    }

# ============ RESUME SCRAPE ============
@app.post("/api/resume-scrape")
def resume_scrape(data: ResumeScrapeData):
    job_id = data.job_id
    
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Check if EPUB already exists (completed)
    if os.path.exists(f"{job_id}.epub"):
        raise HTTPException(status_code=400, detail="This novel is already completed")
    
    # Update status to processing
    jobs[job_id]["status"] = "processing"
    jobs[job_id]["start_url"] = data.start_url
    jobs[job_id]["novel_name"] = data.novel_name
    jobs[job_id]["author"] = data.author
    jobs[job_id]["cover_data"] = data.cover_data
    save_history(jobs)
    
    # Remove from paused list
    if job_id in active_scrapes:
        del active_scrapes[job_id]
        save_active_scrapes(active_scrapes)
    
    # Get current chapter count
    progress_file = f"{job_id}_progress.jsonl"
    chapter_count = 0
    if os.path.exists(progress_file):
        with open(progress_file, "r", encoding="utf-8") as f:
            chapter_count = sum(1 for _ in f)
    
    print(f"▶️ Resuming scrape for '{data.novel_name}' from chapter {chapter_count + 1}")
    
    return {
        "status": "resumed",
        "job_id": job_id,
        "start_url": data.start_url,
        "chapters_already_saved": chapter_count
    }

@app.delete("/api/novel/{job_id}")
def delete_novel(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Novel not found")
    
    novel_info = jobs.get(job_id, {})
    novel_name = novel_info.get("novel_name", "Unknown")
    
    # Delete associated files
    files_to_delete = [
        f"{job_id}.epub",
        f"{job_id}_progress.jsonl"
    ]
    
    deleted_files = []
    for file_path in files_to_delete:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                deleted_files.append(file_path)
            except Exception as e:
                print(f"⚠️ Could not delete {file_path}: {e}")
    
    # Remove from history and active scrapes
    del jobs[job_id]
    save_history(jobs)
    
    if job_id in active_scrapes:
        del active_scrapes[job_id]
        save_active_scrapes(active_scrapes)
    
    print(f"🗑️ Deleted novel '{novel_name}' (ID: {job_id})")
    
    return {
        "status": "deleted",
        "job_id": job_id,
        "novel_name": novel_name,
        "files_removed": deleted_files
    }

# ============ EPUB CREATION ============
def create_epub(novel_title, author, chapters, output_filename, cover_data=""):
    book = epub.EpubBook()
    book.set_title(novel_title)
    book.set_language('en')
    
    if author:
        book.add_author(author)
    
    if cover_data:
        try:
            print(f"📚 Processing cover for: {novel_title}")
            header, encoded = cover_data.split(",", 1)
            ext = header.split(";")[0].split("/")[1]
            cover_bytes = base64.b64decode(encoded)
            book.set_cover(f"cover.{ext}", cover_bytes)
        except Exception as e:
            print(f"⚠️ Cover error: {e}")
    
    spine = ['nav']
    toc = []

    for i, (title, content) in enumerate(chapters):
        file_name = f'chap_{i+1}.xhtml'
        chapter = epub.EpubHtml(title=title, file_name=file_name, lang='en')
        
        html_content = f'<h1>{title}</h1>'
        for paragraph in content:
            if paragraph.strip(): 
                html_content += f'<p>{paragraph}</p>'
        
        chapter.content = html_content
        book.add_item(chapter)
        spine.append(chapter)
        toc.append(chapter)

    book.toc = tuple(toc)
    book.add_item(epub.EpubNav())
    book.spine = spine
    
    epub.write_epub(output_filename, book)
    print(f"✅ EPUB saved: {output_filename} ({len(chapters)} chapters)")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)