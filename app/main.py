import base64
import time
import cv2
import logging
import os
import io
import json
import uuid
from datetime import datetime
from typing import Optional, List
import pdfplumber
import PyPDF2
import fitz
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
from pydantic import BaseModel

from app.services.preprocess import preprocess_pipeline
from app.services.ocr import ocr_service
from app.services.evaluator import evaluator_service
from app.services.surya_service import surya_ocr_service

import asyncio
from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI-Tutor Academic Evaluation Platform...")
    # Pre-warm OCR engine in background thread so server starts immediately without blocking
    asyncio.create_task(asyncio.to_thread(ocr_service.warmup))
    yield
    logger.info("Shutting down AI-Tutor platform...")

app = FastAPI(
    title="AI-Tutor Academic Evaluation Platform",
    description="A complete intelligent assignment evaluation platform featuring OCR, OpenCV, and Ollama LLM grading.",
    lifespan=lifespan
)

# Determine paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(BASE_DIR, "static")
templates_dir = os.path.join(BASE_DIR, "templates")
data_dir = os.path.join(BASE_DIR, "data")

os.makedirs(os.path.join(static_dir, "css"), exist_ok=True)
os.makedirs(os.path.join(static_dir, "js"), exist_ok=True)
os.makedirs(templates_dir, exist_ok=True)
os.makedirs(data_dir, exist_ok=True)

app.mount("/static", StaticFiles(directory=static_dir), name="static")
templates = Jinja2Templates(directory=templates_dir)

# ─────────────────────────────────────────────────────────────
# IN-MEMORY & PERSISTENT DATA STORAGE (TESTS & SUBMISSIONS)
# ─────────────────────────────────────────────────────────────
DB_FILE = os.path.join(data_dir, "store.json")

def load_db():
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    
    # Default seed data
    return {
        "tests": [
            {
                "id": "test_1_ML",
                "title": "Machine Learning Test 1: Supervised Learning & Optimization",
                "subject": "Machine Learning & AI",
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "due_date": "2026-10-15",
                "max_marks": 10.0,
                "question": "1. Explain the fundamental concept of Gradient Descent in Supervised Learning.\n2. Differentiate between Batch Gradient Descent and Stochastic Gradient Descent (SGD).\n3. Why is the learning rate hyperparameter crucial?",
                "model_answer": "1. Gradient Descent is an iterative optimization algorithm used to minimize the cost/loss function by moving in the direction of steepest descent (negative gradient of the loss with respect to parameters).\n2. Batch Gradient Descent computes gradients over the entire dataset before updating parameters (stable but slow on large datasets). SGD updates weights for each individual training example (fast, introduces noise that helps escape local minima).\n3. The learning rate controls the step size taken during each iteration. A very high learning rate can overshoot the global minimum and diverge; a very small learning rate leads to extremely slow convergence.",
                "rubric": "Cost function minimization: 3 marks; Batch vs SGD distinction: 4 marks; Learning rate explanation & tradeoffs: 3 marks."
            }
        ],
        "submissions": []
    }

def save_db(data):
    try:
        with open(DB_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save database: {e}")

db = load_db()

# ─────────────────────────────────────────────────────────────
# DIGITAL PDF EXTRACTION HELPERS
# ─────────────────────────────────────────────────────────────

def extract_via_pdfplumber_stream(pdf_bytes: bytes, page_index: int) -> Optional[str]:
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            if page_index >= len(pdf.pages):
                return None
            page = pdf.pages[page_index]
            text = page.extract_text()
            if text and text.strip():
                return text
            return None
    except Exception as e:
        logger.error(f"[pdfplumber] Error on page {page_index + 1}: {str(e)}")
        return None

def extract_via_pypdf2_stream(pdf_bytes: bytes, page_index: int) -> Optional[str]:
    try:
        reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
        if page_index >= len(reader.pages):
            return None
        page = reader.pages[page_index]
        text = page.extract_text()
        if text and text.strip():
            return text
        return None
    except Exception as e:
        logger.error(f"[PyPDF2] Error on page {page_index + 1}: {str(e)}")
        return None


def process_document_extraction(
    content: bytes,
    filename: str,
    apply_grayscale: bool = True,
    apply_denoise: bool = True,
    apply_threshold: bool = True,
    apply_deskew: bool = True
) -> dict:
    """
    Central extraction pipeline for PDF and images.
    """
    start_time = time.time()
    is_pdf = filename.lower().endswith('.pdf')
    ocr_results = []
    preprocessed_data_url = None
    first_page_metadata = {}
    
    if is_pdf:
        pdf_doc = fitz.open(stream=content, filetype="pdf")
        num_pages = len(pdf_doc)
        if num_pages == 0:
            raise ValueError("The PDF file contains no pages.")
            
        processed_first_page_img = None
        for page_idx in range(num_pages):
            page_text = extract_via_pdfplumber_stream(content, page_idx)
            if not page_text:
                page_text = extract_via_pypdf2_stream(content, page_idx)
                
            if page_text:
                ocr_results.append({
                    "box": [[0, 0], [0, 0], [0, 0], [0, 0]],
                    "text": page_text.strip(),
                    "confidence": 1.0,
                    "page": page_idx + 1,
                    "source": "digital"
                })
            else:
                page = pdf_doc.load_page(page_idx)
                pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0), alpha=False)
                img_data = pix.tobytes("png")
                
                page_processed_img, page_metadata = preprocess_pipeline(
                    image_bytes=img_data,
                    apply_grayscale=apply_grayscale,
                    apply_denoise=apply_denoise,
                    apply_threshold=apply_threshold,
                    apply_deskew=apply_deskew
                )
                
                page_ocr = ocr_service.extract_text(page_processed_img)
                for line in page_ocr:
                    line["page"] = page_idx + 1
                    line["source"] = "ocr"
                    ocr_results.append(line)
                    
                if page_idx == 0:
                    processed_first_page_img = page_processed_img
                    first_page_metadata = page_metadata
                    
        if processed_first_page_img is not None:
            _, buffer = cv2.imencode('.jpg', processed_first_page_img)
            base64_encoded = base64.b64encode(buffer).decode('utf-8')
            preprocessed_data_url = f"data:image/jpeg;base64,{base64_encoded}"
            
        metadata = {
            "is_pdf": True,
            "num_pages": num_pages,
            "original_size": first_page_metadata.get("original_size", {"width": 0, "height": 0}),
            "processed_size": first_page_metadata.get("processed_size", {"width": 0, "height": 0}),
            "skew_angle": first_page_metadata.get("skew_angle", 0.0)
        }
    else:
        processed_img, metadata = preprocess_pipeline(
            image_bytes=content,
            apply_grayscale=apply_grayscale,
            apply_denoise=apply_denoise,
            apply_threshold=apply_threshold,
            apply_deskew=apply_deskew
        )
        metadata["is_pdf"] = False
        ocr_results = ocr_service.extract_text(processed_img)
        for line in ocr_results:
            line["source"] = "ocr"
            
        try:
            _, buffer = cv2.imencode('.jpg', processed_img)
            base64_encoded = base64.b64encode(buffer).decode('utf-8')
            preprocessed_data_url = f"data:image/jpeg;base64,{base64_encoded}"
        except Exception:
            preprocessed_data_url = None

    elapsed_time = time.time() - start_time
    
    if is_pdf:
        pages_text = {}
        for line in ocr_results:
            p = line.get("page", 1)
            if p not in pages_text:
                pages_text[p] = []
            pages_text[p].append(line["text"])
        
        full_text_parts = []
        for p in sorted(pages_text.keys()):
            full_text_parts.extend(pages_text[p])
        full_text = "\n".join(full_text_parts)
    else:
        full_text = "\n".join([line["text"] for line in ocr_results])
        
    metadata["processing_time_seconds"] = round(elapsed_time, 3)
    metadata["confidence_average"] = round(
        sum([line["confidence"] for line in ocr_results]) / len(ocr_results), 3
    ) if ocr_results else 0.0

    return {
        "text": full_text,
        "lines": ocr_results,
        "metadata": metadata,
        "preprocessed_image": preprocessed_data_url
    }


# ─────────────────────────────────────────────────────────────
# APPLICATION ROUTES
# ─────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse(request, "index.html")

# --- Test Management Endpoints ---

@app.get("/api/tests")
async def get_all_tests():
    """List all teacher posted tests with submission counts."""
    tests_summary = []
    for t in db["tests"]:
        sub_count = len([s for s in db["submissions"] if s.get("test_id") == t["id"]])
        avg_score = 0
        subs = [s for s in db["submissions"] if s.get("test_id") == t["id"]]
        if subs:
            avg_score = round(sum(s.get("evaluation", {}).get("marks_obtained", 0) for s in subs) / len(subs), 1)
        tests_summary.append({
            **t,
            "submissions_count": sub_count,
            "average_score": avg_score
        })
    return {"success": True, "tests": tests_summary}

class CreateTestSchema(BaseModel):
    id: str
    title: str
    subject: str
    max_marks: float
    due_date: str
    question: str
    model_answer: str
    rubric: Optional[str] = ""

@app.post("/api/tests")
async def create_new_test(payload: CreateTestSchema):
    """Teacher creates a new test."""
    clean_id = payload.id.strip().replace(" ", "_")
    if not clean_id:
        clean_id = f"test_{uuid.uuid4().hex[:6]}"
        
    # Check if ID already exists
    if any(t["id"] == clean_id for t in db["tests"]):
        raise HTTPException(status_code=400, detail=f"Test ID '{clean_id}' already exists. Please choose another ID.")
        
    new_test = {
        "id": clean_id,
        "title": payload.title,
        "subject": payload.subject,
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "due_date": payload.due_date,
        "max_marks": payload.max_marks,
        "question": payload.question,
        "model_answer": payload.model_answer,
        "rubric": payload.rubric
    }
    db["tests"].insert(0, new_test)
    save_db(db)
    return {"success": True, "test": new_test}

@app.get("/api/tests/{test_id}")
async def get_test_details(test_id: str):
    """Get single test information."""
    test = next((t for t in db["tests"] if t["id"] == test_id), None)
    if not test:
        raise HTTPException(status_code=404, detail="Test not found.")
    return {"success": True, "test": test}

# --- Student Submission & Evaluation Endpoints ---

@app.post("/api/tests/{test_id}/submit")
async def submit_student_solution(
    test_id: str,
    file: UploadFile = File(...),
    student_name: str = Form("Anonymous Student"),
    student_roll: str = Form("STU-001"),
    apply_grayscale: bool = Form(True),
    apply_denoise: bool = Form(True),
    apply_threshold: bool = Form(True),
    apply_deskew: bool = Form(True)
):
    """
    Student submits solution sheet (image or PDF).
    Backend extracts text, evaluates with Ollama LLM against teacher model answer, and stores result.
    """
    test = next((t for t in db["tests"] if t["id"] == test_id), None)
    if not test:
        raise HTTPException(status_code=404, detail="Test not found.")
        
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Unable to read file: {e}")
        
    # 1. OCR / PDF Extraction
    try:
        extraction = process_document_extraction(
            content=content,
            filename=file.filename,
            apply_grayscale=apply_grayscale,
            apply_denoise=apply_denoise,
            apply_threshold=apply_threshold,
            apply_deskew=apply_deskew
        )
    except Exception as e:
        logger.error(f"Extraction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Text extraction failed: {str(e)}")
        
    student_text = extraction["text"]
    
    # 2. Semantic Evaluation via Ollama LLM
    try:
        eval_result = evaluator_service.evaluate_submission(
            student_answer=student_text,
            question=test["question"],
            model_answer=test["model_answer"] + "\n\nRubric: " + (test.get("rubric") or ""),
            max_marks=test["max_marks"]
        )
    except Exception as e:
        logger.error(f"Evaluation error: {e}")
        eval_result = evaluator_service._heuristic_fallback_evaluation(
            student_text, test["question"], test["model_answer"], test["max_marks"]
        )

    # 3. Store submission record
    submission_id = f"sub_{uuid.uuid4().hex[:8]}"
    original_data_url = None
    if not file.filename.lower().endswith('.pdf'):
        try:
            mime = "image/png" if file.filename.lower().endswith(".png") else "image/jpeg"
            b64_orig = base64.b64encode(content).decode('utf-8')
            original_data_url = f"data:{mime};base64,{b64_orig}"
        except Exception:
            original_data_url = None

    record = {
        "id": submission_id,
        "test_id": test_id,
        "test_title": test["title"],
        "student_name": student_name,
        "student_roll": student_roll,
        "filename": file.filename,
        "submitted_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "extracted_text": student_text,
        "evaluation": eval_result,
        "teacher_override": None,
        "teacher_remarks": None,
        "metadata": extraction["metadata"],
        "preprocessed_image": extraction["preprocessed_image"],
        "original_image": original_data_url
    }
    
    db["submissions"].insert(0, record)
    save_db(db)
    
    return {
        "success": True,
        "submission_id": submission_id,
        "extracted_text": student_text,
        "evaluation": eval_result,
        "metadata": extraction["metadata"],
        "preprocessed_image": extraction["preprocessed_image"]
    }

@app.get("/api/tests/{test_id}/submissions")
async def get_test_submissions(test_id: str):
    """Teacher views all submissions for a specific test."""
    subs = [s for s in db["submissions"] if s.get("test_id") == test_id]
    return {"success": True, "submissions": subs}

class OverrideSchema(BaseModel):
    marks: float
    remarks: Optional[str] = ""

@app.patch("/api/submissions/{submission_id}")
async def teacher_override_submission(submission_id: str, payload: OverrideSchema):
    """Teacher manually updates marks or adds remarks for a student submission."""
    sub = next((s for s in db["submissions"] if s["id"] == submission_id), None)
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found.")
        
    sub["teacher_override"] = payload.marks
    sub["teacher_remarks"] = payload.remarks
    save_db(db)
    return {"success": True, "submission": sub}

# --- Diagnostic & Quick Test Endpoints ---

@app.get("/api/samples/{sample_name}")
async def get_sample_file(sample_name: str):
    """Fetches sample files for quick developer testing."""
    root_dir = os.path.dirname(BASE_DIR)
    file_map = {
        "image": os.path.join(root_dir, "handwritten_sample.png"),
        "pdf": os.path.join(root_dir, "AI_Tutor_Research_Document.pdf")
    }
    target_path = file_map.get(sample_name)
    if not target_path or not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail="Sample not found.")
        
    with open(target_path, "rb") as f:
        data = f.read()
        
    b64 = base64.b64encode(data).decode('utf-8')
    mime = "application/pdf" if target_path.endswith(".pdf") else "image/png"
    return {
        "filename": os.path.basename(target_path),
        "data_url": f"data:{mime};base64,{b64}",
        "mime_type": mime
    }

@app.post("/api/extract")
async def extract_handwritten_document(
    file: UploadFile = File(...),
    apply_grayscale: bool = Form(True),
    apply_denoise: bool = Form(True),
    apply_threshold: bool = Form(True),
    apply_deskew: bool = Form(True),
    engine: str = Form("standard"),
    device_mode: str = Form("auto")
):
    """Standalone OCR diagnostic endpoint (supports standard & surya)."""
    try:
        content = await file.read()
        if engine == "surya":
            return await asyncio.to_thread(surya_ocr_service.extract_from_bytes, content, file.filename, device_mode)

        res = process_document_extraction(
            content=content,
            filename=file.filename,
            apply_grayscale=apply_grayscale,
            apply_denoise=apply_denoise,
            apply_threshold=apply_threshold,
            apply_deskew=apply_deskew
        )
        return {
            "success": True,
            "filename": file.filename,
            "text": res["text"],
            "lines": res["lines"],
            "metadata": res["metadata"],
            "preprocessed_image": res["preprocessed_image"]
        }
    except Exception as e:
        logger.error(f"Error in extract endpoint: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "detail": f"Extraction failed: {str(e)}",
                "text": "",
                "lines": [],
                "metadata": {}
            }
        )

@app.post("/api/surya/extract")
async def extract_via_surya(
    file: UploadFile = File(...),
    device_mode: str = Form("auto")
):
    """Dedicated endpoint to run Surya OCR with PyTorch + CUDA/CPU on uploaded PDF or Image."""
    try:
        content = await file.read()
        res = await asyncio.to_thread(surya_ocr_service.extract_from_bytes, content, file.filename, device_mode)
        return res

    except Exception as e:
        logger.error(f"Error in Surya extract endpoint: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": f"Surya OCR extraction failed: {str(e)}",
                "engine": "Surya OCR",
                "text": ""
            }
        )
