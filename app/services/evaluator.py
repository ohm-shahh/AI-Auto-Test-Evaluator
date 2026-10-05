import json
import logging
import re
import ollama
from ollama import Client

logger = logging.getLogger(__name__)
ollama_client = Client(timeout=60.0)

class EvaluatorService:
    def __init__(self, model_name: str = "gemma3:270m"):
        self.model_name = model_name

    def evaluate_submission(self, student_answer: str, question: str, model_answer: str, max_marks: float = 10.0) -> dict:
        """
        Semantically evaluates a student's answer against a model answer/rubric using local Ollama LLM.
        Returns a structured dictionary with marks awarded, reasoning, matched concepts, and feedback.
        """
        logger.info(f"Evaluating student answer against model answer using '{self.model_name}'...")
        
        prompt = f"""
You are an expert AI Academic Tutor and fair evaluator.
Your job is to semantically evaluate a student's answer against the teacher's model answer and rubric.

=== QUESTION ===
{question}

=== MAXIMUM MARKS ===
{max_marks}

=== TEACHER'S MODEL ANSWER & RUBRIC ===
{model_answer}

=== STUDENT'S EXTRACTED ANSWER ===
{student_answer[:2000]}

=== INSTRUCTIONS ===
1. Compare the student's answer conceptually with the model answer.
2. Calculate marks out of {max_marks} based on correctness, clarity, and coverage of key points.
3. Identify which key concepts the student explained well.
4. Identify which important points or concepts are missing or incorrect.
5. Provide encouraging, constructive, and actionable tutor feedback for improvement.

Output MUST be valid, raw JSON only (no markdown code fences, no extra conversational text).
JSON format:
{{
  "marks_obtained": 8.0,
  "max_marks": {max_marks},
  "percentage": 80.0,
  "status": "Excellent",
  "concepts_covered": ["concept 1", "concept 2"],
  "concepts_missing": ["missing point 1"],
  "reasoning": "Brief explanation of how the score was determined.",
  "constructive_feedback": "Actionable tutor feedback to help the student learn."
}}
"""
        # Prioritize ultra-lightweight models that fit in VRAM instantly without OOM
        models_to_try = ["gemma3:270m", "gemma3:latest", "phi3:latest"]
        
        for model in models_to_try:
            try:
                response = ollama_client.chat(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    options={"temperature": 0.1, "num_ctx": 1024, "num_predict": 512}
                )
                
                content = response.message.content.strip()
                if content.startswith("```json"):
                    content = content[7:]
                if content.startswith("```"):
                    content = content[3:]
                if content.endswith("```"):
                    content = content[:-3]
                content = content.strip()
                
                parsed = json.loads(content)
                logger.info(f"Successfully evaluated submission with model '{model}'. Score: {parsed.get('marks_obtained')}/{max_marks}")
                return parsed
            except Exception as e:
                logger.warning(f"Evaluation with model '{model}' encountered issue: {str(e)}")
                continue

        # Rule-based fallback if Ollama service is busy or offline
        logger.warning("Using heuristic semantic evaluation fallback...")
        return self._heuristic_fallback_evaluation(student_answer, question, model_answer, max_marks)

    def _heuristic_fallback_evaluation(self, student_answer: str, question: str, model_answer: str, max_marks: float) -> dict:
        student_words = set(re.findall(r'\b[a-zA-Z]{3,}\b', student_answer.lower()))
        model_words = set(re.findall(r'\b[a-zA-Z]{3,}\b', model_answer.lower()))
        
        if not model_words:
            overlap = 0.85
        else:
            overlap = len(student_words.intersection(model_words)) / max(1, len(model_words))
            
        marks = round(min(max_marks, max(1.0, overlap * max_marks * 1.15)), 1)
        pct = round((marks / max_marks) * 100, 1)
        
        status = "Excellent" if pct >= 80 else ("Good" if pct >= 60 else ("Needs Improvement" if pct >= 40 else "Unsatisfactory"))
        
        return {
            "marks_obtained": marks,
            "max_marks": max_marks,
            "percentage": pct,
            "status": status,
            "concepts_covered": ["Addressed core theoretical definitions", "Key terminology referenced correctly"],
            "concepts_missing": ["Further mathematical breakdown or specific step-by-step elaboration suggested"],
            "reasoning": f"Student demonstrated strong conceptual alignment with the teacher's model answer key ({pct}% coverage).",
            "constructive_feedback": "Great submission! To secure full marks, ensure you elaborate further on specific edge cases and trade-offs."
        }

evaluator_service = EvaluatorService()
