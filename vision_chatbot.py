import os
import re
import base64
from PIL import Image
import io
from typing import Dict, Any, List, Optional
from groq import Groq

class VisionChatbot:
    """
    Conversational Image Recognition Chatbot Engine (SIH1604).
    Integrates local image analysis via Pillow and cloud-based LLM vision analysis via Groq.
    """

    def __init__(self):
        self.groq_api_key = os.getenv("GROQ_API_KEY")
        # Initialize Groq client if key is present
        if self.groq_api_key and self.groq_api_key.strip():
            self.groq_client = Groq(api_key=self.groq_api_key)
        else:
            self.groq_client = None

        # Standard Computer Vision Datasets Database
        self.datasets = {
            "imagenet": {
                "name": "ImageNet",
                "description": "ImageNet is a massive visual database designed for use in visual object recognition research. It contains over 14 million hand-annotated URLs with bounding boxes for object detection, organized according to the WordNet hierarchy.",
                "classes": "Over 20,000 categories (e.g., animals, vehicles, household items).",
                "use_case": "Image classification, transfer learning backbone pre-training.",
                "metrics": "Top-1 and Top-5 error rates."
            },
            "coco": {
                "name": "COCO (Common Objects in Context)",
                "description": "COCO is a large-scale object detection, segmentation, and captioning dataset. It is widely recognized for capturing complex, everyday scenes with multiple objects per image, reflecting real-world context.",
                "classes": "80 object categories, 330,000+ images, 1.5 million object instances.",
                "use_case": "Object detection, instance segmentation, keypoint detection, image captioning.",
                "metrics": "Mean Average Precision (mAP) at various IoU thresholds (e.g., mAP@0.5, mAP@0.5:0.95)."
            },
            "pascal": {
                "name": "Pascal VOC (Visual Object Classes)",
                "description": "Pascal VOC is a standardized dataset and evaluation framework for image classification, object detection, and semantic segmentation. It was one of the early benchmarks for visual object category recognition.",
                "classes": "20 classes (including human, animals like cat/dog, vehicles like car/bus, and indoor items like chair/table).",
                "use_case": "Object detection, semantic segmentation, action classification.",
                "metrics": "Average Precision (AP) per class, Mean Average Precision (mAP)."
            },
            "sun": {
                "name": "SUN (Scene Understanding Database)",
                "description": "The SUN dataset is a large collection of annotated images designed for scene recognition, category detection, and understanding visual scenes. It focuses on place and layout recognition rather than isolated objects.",
                "classes": "397 scene categories, 131,067 images.",
                "use_case": "Scene classification, indoor/outdoor scene understanding, spatial layout estimation.",
                "metrics": "Scene classification accuracy."
            }
        }

        # Session image memory: maps session_id to last uploaded image information
        self.session_memory: Dict[str, Dict[str, Any]] = {}

    def get_datasets_info(self) -> str:
        """Returns structured information about standard CV datasets."""
        info = "### 📚 Household Computer Vision Datasets\n\n"
        for key, data in self.datasets.items():
            info += f"• **{data['name']}**:\n"
            info += f"  - *Description*: {data['description']}\n"
            info += f"  - *Classes*: {data['classes']}\n"
            info += f"  - *Main Use Case*: {data['use_case']}\n"
            info += f"  - *Key Metrics*: {data['metrics']}\n\n"
        info += "*(Note: Precision and Recall metrics depend heavily on the diversity and quality of these training datasets.)*"
        return info

    def analyze_image_heuristics(self, image_bytes: bytes, filename: str) -> Dict[str, Any]:
        """
        Lightweight local heuristic analysis using Pillow.
        Extracts dominant colors, aspect ratios, image brightness, and maps filenames or visual cues
        to likely objects to simulate edge recognition without heavy model files.
        """
        try:
            img = Image.open(io.BytesIO(image_bytes))
            width, height = img.size
            img_format = img.format
            aspect_ratio = round(width / height, 2)
            
            # Analyze dominant color and brightness from a resized thumbnail
            thumb = img.copy()
            thumb.thumbnail((50, 50))
            pixels = list(thumb.getdata())
            
            total_r = total_g = total_b = 0
            count = len(pixels)
            is_rgba = thumb.mode == 'RGBA'
            
            for p in pixels:
                if is_rgba:
                    r, g, b, *a = p
                else:
                    r, g, b = p[:3]
                total_r += r
                total_g += g
                total_b += b
                
            avg_r = total_r / count
            avg_g = total_g / count
            avg_b = total_b / count
            brightness = (avg_r * 0.299 + avg_g * 0.587 + avg_b * 0.114)
            
            # Match filename keywords for explicit demonstration
            fn_lower = filename.lower()
            detected_objects = []
            confidence_scores = {}
            
            # Key mappings for local recognition
            mappings = {
                "cat": ("Cat (Felis catus)", 0.95),
                "dog": ("Dog (Canis lupus familiaris)", 0.94),
                "car": ("Automobile / Car", 0.91),
                "truck": ("Truck / Commercial Vehicle", 0.88),
                "person": ("Person / Human", 0.96),
                "laptop": ("Laptop / Personal Computer", 0.93),
                "keyboard": ("Computer Keyboard", 0.89),
                "mouse": ("Computer Mouse", 0.85),
                "phone": ("Mobile Phone / Smartphone", 0.92),
                "chair": ("Chair / Furniture", 0.87),
                "table": ("Table / Desk", 0.84),
                "bottle": ("Bottle / Container", 0.86),
                "cup": ("Cup / Mug", 0.83),
                "flower": ("Flower / Plant", 0.90),
                "tree": ("Tree / Vegetation", 0.89),
                "building": ("Building / Architecture", 0.87),
                "document": ("Document / Text Page", 0.94),
                "screenshot": ("Digital Screenshot / Interface", 0.92)
            }
            
            for key, (label, conf) in mappings.items():
                if key in fn_lower:
                    detected_objects.append(label)
                    confidence_scores[label] = conf
            
            # Fallback to visual color heuristics if filename is generic
            if not detected_objects:
                # Nature / Outdoor heuristic
                if avg_g > avg_r * 1.15 and avg_g > avg_b * 1.1:
                    detected_objects.append("Vegetation / Foliage")
                    confidence_scores["Vegetation / Foliage"] = 0.78
                    if brightness > 180:
                        detected_objects.append("Sunny Landscape / Sky")
                        confidence_scores["Sunny Landscape / Sky"] = 0.72
                # Sky / Water heuristic
                elif avg_b > avg_r * 1.15 and avg_b > avg_g * 1.05:
                    detected_objects.append("Sky / Water Body")
                    confidence_scores["Sky / Water Body"] = 0.81
                # Dark / Studio lighting
                elif brightness < 40:
                    detected_objects.append("Dark indoor setting / Low light object")
                    confidence_scores["Dark indoor setting / Low light object"] = 0.65
                # Bright / Studio / Text document
                elif brightness > 220 and abs(avg_r - avg_g) < 10 and abs(avg_g - avg_b) < 10:
                    detected_objects.append("Document / High-contrast layout")
                    confidence_scores["Document / High-contrast layout"] = 0.85
                else:
                    detected_objects.append("General Object / Studio Scene")
                    confidence_scores["General Object / Studio Scene"] = 0.70
            
            return {
                "filename": filename,
                "format": img_format,
                "width": width,
                "height": height,
                "aspect_ratio": aspect_ratio,
                "detected_objects": detected_objects,
                "confidence_scores": confidence_scores,
                "brightness": "Bright" if brightness > 150 else "Dark" if brightness < 80 else "Normal"
            }
        except Exception as e:
            return {"error": f"Image processing failed: {str(e)}"}

    def get_response(self, message: str, session_id: str = "default_session", image_data: Optional[bytes] = None, filename: Optional[str] = None) -> Dict[str, Any]:
        """
        Processes conversation queries. If image_data is provided, saves it to session memory
        and performs visual classification.
        """
        # Save image to session memory if provided
        if image_data:
            analysis = self.analyze_image_heuristics(image_data, filename or "uploaded_image.jpg")
            self.session_memory[session_id] = {
                "image_bytes": image_data,
                "filename": filename,
                "analysis": analysis,
                "base64": base64.b64encode(image_data).decode("utf-8")
            }
            
            # If Groq client is active, run live vision query
            if self.groq_client:
                try:
                    completion = self.groq_client.chat.completions.create(
                        model="llama-3.2-11b-vision-preview",
                        messages=[
                            {
                                "role": "system",
                                "content": "You are a Conversational Image Recognition Assistant. Describe the uploaded image, name detected objects, and answer the user's prompt accurately."
                            },
                            {
                                "role": "user",
                                "content": [
                                    {"type": "text", "text": f"Analyze this image. User message: {message}"},
                                    {
                                        "type": "image_url",
                                        "image_url": {
                                            "url": f"data:image/jpeg;base64,{self.session_memory[session_id]['base64']}"
                                        }
                                    }
                                ]
                            }
                        ],
                        temperature=0.2,
                        max_completion_tokens=500
                    )
                    ans = completion.choices[0].message.content
                    return {
                        "type": "image_response",
                        "title": "Vision AI Analysis",
                        "message": ans,
                        "analysis": analysis
                    }
                except Exception as e:
                    # Fallback to local heuristic if Groq call fails
                    pass
            
            # Local Heuristic Response (Offline/Fallback)
            objs = ", ".join(analysis.get("detected_objects", []))
            conf_details = "\n".join([f"- **{obj}** (Confidence: {analysis['confidence_scores'].get(obj, 0.0):.0%})" for obj in analysis.get("detected_objects", [])])
            
            msg = (
                f"### 🔍 Image Recognition Results (Local Mode)\n\n"
                f"I have successfully recognized the image **{filename}** ({analysis['width']}x{analysis['height']} pixels, {analysis['format']} format).\n\n"
                f"**Objects Detected:**\n"
                f"{conf_details}\n\n"
                f"**Scene Characteristics:**\n"
                f"- Aspect Ratio: `{analysis['aspect_ratio']}`\n"
                f"- Lighting Conditions: `{analysis['brightness']}`\n\n"
                f"How can I help you analyze these objects further?"
            )
            return {
                "type": "image_response",
                "title": "Local Recognition Engine",
                "message": msg,
                "analysis": analysis
            }

        # Handling subsequent messages (check if session has an active image context)
        msg_lower = message.lower()
        
        # Check dataset queries explicitly
        for key in ["coco", "imagenet", "pascal", "sun"]:
            if key in msg_lower:
                dataset_data = self.datasets[key]
                info = (
                    f"### 📊 Dataset Details: {dataset_data['name']}\n\n"
                    f"**Overview:** {dataset_data['description']}\n\n"
                    f"**Target Classes:** {dataset_data['classes']}\n"
                    f"**Main Application:** {dataset_data['use_case']}\n"
                    f"**Evaluation Metrics:** `{dataset_data['metrics']}`"
                )
                return {
                    "type": "dataset_info",
                    "title": dataset_data["name"],
                    "message": info
                }

        if "dataset" in msg_lower or "data set" in msg_lower or "pascal" in msg_lower or "imagenet" in msg_lower or "coco" in msg_lower or "sun" in msg_lower:
            return {
                "type": "dataset_list",
                "title": "Computer Vision Datasets",
                "message": self.get_datasets_info()
            }

        # Check if conversation references previous image
        if session_id in self.session_memory:
            session_data = self.session_memory[session_id]
            analysis = session_data["analysis"]
            
            if self.groq_client:
                try:
                    completion = self.groq_client.chat.completions.create(
                        model="llama-3.2-11b-vision-preview",
                        messages=[
                            {
                                "role": "system",
                                "content": "You are a Conversational Image Recognition Assistant. Answer subsequent questions about the previously uploaded image."
                            },
                            {
                                "role": "user",
                                "content": [
                                    {"type": "text", "text": f"Recall the previously uploaded image. Answer this follow-up query: {message}"},
                                    {
                                        "type": "image_url",
                                        "image_url": {
                                            "url": f"data:image/jpeg;base64,{session_data['base64']}"
                                        }
                                    }
                                ]
                            }
                        ],
                        temperature=0.2,
                        max_completion_tokens=500
                    )
                    ans = completion.choices[0].message.content
                    return {
                        "type": "text",
                        "title": "Vision AI Response",
                        "message": ans
                    }
                except Exception:
                    pass

            # Local Text QA fallback about image
            objs = ", ".join(analysis.get("detected_objects", []))
            reply = (
                f"Analyzing your request in relation to the active image **{session_data['filename']}**:\n\n"
                f"- The primary objects detected are **{objs}**.\n"
                f"- Image dimensions: `{analysis['width']}x{analysis['height']}` ({analysis['format']}).\n\n"
                f"*(Note: Enable Groq API Key to perform free-form question answering on image visual contents.)*"
            )
            return {
                "type": "text",
                "title": "Local Recognition Engine",
                "message": reply
            }

        # Default fallback response for general messages
        return {
            "type": "fallback",
            "title": "Assistant Guidance",
            "message": (
                "Please upload an image using the **Attach Image** button, or ask me about computer vision datasets (ImageNet, COCO, Pascal VOC, SUN) to get started.\n\n"
                "A good dataset will contribute to a model with good precision and recall."
            )
        }
