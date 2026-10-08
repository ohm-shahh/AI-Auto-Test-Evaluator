import io
import time
import base64
import logging
from typing import Optional, List, Dict, Any
from PIL import Image
import fitz  # PyMuPDF

logger = logging.getLogger(__name__)

class SuryaOCRService:
    """
    Isolated service for Surya OCR integration.
    Does not touch or modify the existing OCR pipeline.
    """
    def __init__(self):
        self._predictor = None
        self._manager = None
        self._initialized = False
        self._init_error = None

    def _get_predictor(self):
        """
        Lazily initializes the Surya RecognitionPredictor and InferenceManager.
        Reuses the instance across requests to conserve resources and avoid model reloading.
        """
        if self._init_error is not None:
            # If a fatal import/environment issue occurred, raise it clearly
            raise RuntimeError(f"Surya initialization previously failed: {self._init_error}")

        if self._predictor is None:
            try:
                logger.info("Initializing Surya OCR InferenceManager and RecognitionPredictor...")
                from surya.inference import SuryaInferenceManager
                from surya.recognition import RecognitionPredictor

                self._manager = SuryaInferenceManager()
                self._predictor = RecognitionPredictor(self._manager)
                self._initialized = True
                logger.info("Surya OCR predictor successfully initialized.")
            except Exception as e:
                self._init_error = str(e)
                logger.error(f"Failed to initialize Surya OCR: {e}", exc_info=True)
                raise RuntimeError(f"Surya OCR initialization failed: {e}")

        return self._predictor

    def is_available(self) -> tuple[bool, str]:
        """
        Quick diagnostic check to report whether Surya package is imported and operational.
        """
        try:
            import surya
            from surya.recognition import RecognitionPredictor
            return True, "Surya OCR Ready"
        except Exception as e:
            return False, f"Surya OCR Unavailable: {str(e)}"

    def run_surya_ocr(self, content: bytes, filename: str) -> Dict[str, Any]:
        """
        Runs Surya OCR on an uploaded image or PDF document.
        Normalizes the response to match the AI-Tutor pipeline schema.
        """
        start_time = time.time()
        is_pdf = filename.lower().endswith(".pdf")
        preview_data_url = None
        pil_images: List[Image.Image] = []

        # 1. Render / Parse Input Document into PIL Images
        try:
            if is_pdf:
                doc = fitz.open(stream=content, filetype="pdf")
                if len(doc) == 0:
                    raise ValueError("The provided PDF file contains no pages.")

                for page_idx in range(len(doc)):
                    page = doc.load_page(page_idx)
                    # Render page at 2.0x DPI resolution for high OCR fidelity
                    pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0), alpha=False)
                    img_bytes = pix.tobytes("png")
                    pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
                    pil_images.append(pil_img)

                    # Store preview of the first page
                    if page_idx == 0:
                        b64_str = base64.b64encode(img_bytes).decode("utf-8")
                        preview_data_url = f"data:image/png;base64,{b64_str}"
            else:
                pil_img = Image.open(io.BytesIO(content)).convert("RGB")
                pil_images.append(pil_img)

                # Store preview of the image
                buf = io.BytesIO()
                pil_img.save(buf, format="JPEG", quality=92)
                b64_str = base64.b64encode(buf.getvalue()).decode("utf-8")
                preview_data_url = f"data:image/jpeg;base64,{b64_str}"

        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"[Surya OCR] Document decoding/rendering failed: {e}", exc_info=True)
            return {
                "success": False,
                "ocr_engine": "surya",
                "error": f"Document parsing failed: {str(e)}",
                "detail": f"Failed to decode or render document '{filename}': {str(e)}",
                "text": "",
                "lines": [],
                "metadata": {
                    "ocr_engine": "surya",
                    "processing_time_seconds": round(elapsed, 3),
                    "confidence_average": None,
                    "skew_angle": 0.0,
                    "is_pdf": is_pdf,
                },
                "preprocessed_image": preview_data_url
            }

        # 2. Run Surya Recognition Predictor
        try:
            predictor = self._get_predictor()
            logger.info(f"[Surya OCR] Running recognition on {len(pil_images)} page(s)...")
            page_results = predictor(pil_images, full_page=True)

            parsed_lines = []
            extracted_text_parts = []
            confidences = []

            for page_idx, page_res in enumerate(page_results):
                page_lines = []
                # PageOCRResult has blocks
                blocks = getattr(page_res, "blocks", [])
                for block in blocks:
                    if getattr(block, "skipped", False) or getattr(block, "error", False):
                        continue

                    # Text content in Surya 0.22 is stored in html or formatted text
                    raw_html = getattr(block, "html", "")
                    clean_text = raw_html.replace("<p>", "").replace("</p>", "").replace("<div>", "").replace("</div>", "").strip()
                    if clean_text:
                        conf = getattr(block, "confidence", None)
                        if conf is not None:
                            confidences.append(float(conf))

                        poly = getattr(block, "polygon", [[0,0],[0,0],[0,0],[0,0]])
                        parsed_lines.append({
                            "box": poly,
                            "text": clean_text,
                            "confidence": round(float(conf), 3) if conf is not None else 1.0,
                            "page": page_idx + 1,
                            "source": "surya"
                        })
                        page_lines.append(clean_text)

                if page_lines:
                    if is_pdf:
                        extracted_text_parts.append(f"--- Page {page_idx + 1} ---\n" + "\n".join(page_lines))
                    else:
                        extracted_text_parts.append("\n".join(page_lines))

            full_text = "\n\n".join(extracted_text_parts) if is_pdf else "\n".join(extracted_text_parts)
            elapsed = time.time() - start_time
            avg_conf = round(sum(confidences) / len(confidences), 3) if confidences else None

            logger.info(f"[Surya OCR] Extraction complete in {elapsed:.2f}s ({len(parsed_lines)} text blocks found).")

            return {
                "success": True,
                "ocr_engine": "surya",
                "text": full_text,
                "lines": parsed_lines,
                "metadata": {
                    "ocr_engine": "surya",
                    "is_pdf": is_pdf,
                    "num_pages": len(pil_images),
                    "processing_time_seconds": round(elapsed, 3),
                    "confidence_average": avg_conf,
                    "skew_angle": 0.0
                },
                "preprocessed_image": preview_data_url
            }

        except Exception as e:
            elapsed = time.time() - start_time
            error_msg = str(e)
            logger.error(f"[Surya OCR] Inference error: {error_msg}", exc_info=True)

            # Friendly user-facing message mapping
            if "docker" in error_msg.lower():
                user_friendly = (
                    "Surya OCR requires a running Docker daemon with permission to access unix:///var/run/docker.sock, "
                    "or a configured llama.cpp backend."
                )
            elif "out of memory" in error_msg.lower() or "cuda" in error_msg.lower():
                user_friendly = "Surya OCR ran out of GPU memory (CUDA OOM). Please try a smaller document."
            else:
                user_friendly = f"Surya OCR error: {error_msg}"

            return {
                "success": False,
                "ocr_engine": "surya",
                "error": user_friendly,
                "detail": error_msg,
                "text": "",
                "lines": [],
                "metadata": {
                    "ocr_engine": "surya",
                    "is_pdf": is_pdf,
                    "num_pages": len(pil_images),
                    "processing_time_seconds": round(elapsed, 3),
                    "confidence_average": None,
                    "skew_angle": 0.0,
                },
                "preprocessed_image": preview_data_url
            }

# Singleton instance
surya_service = SuryaOCRService()
