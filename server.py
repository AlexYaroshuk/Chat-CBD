
import os
import json
import firebase_admin
from firebase_admin import credentials, storage
import openai
import requests
import time
import random
import base64
from uuid import uuid4

from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


# Firebase setup
cred = credentials.Certificate("/etc/secrets/FIREBASE_SERVICE_ACCOUNT")
firebase_admin.initialize_app(cred, {'storageBucket': os.environ.get("FIREBASE_STORAGE_BUCKET")})
bucket = storage.bucket()

# OpenAI setup
openai.api_key = os.environ.get("OPENAI_API_KEY")

# Stability setup
stability_engine_id = "stable-diffusion-v1-5"
stability_api_host = os.environ.get("API_HOST", "https://api.stability.ai")
stability_api_key = os.environ.get("STABILITY_API_KEY")

allowed_origins = [
    "https://chat-cbd-test.vercel.app",
    "http://localhost:5173",
]

@app.after_request
def after_request(response):
    origin = request.headers.get("Origin")
    if origin in allowed_origins:
        response.headers.add("Access-Control-Allow-Origin", origin)
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
        response.headers.add("Access-Control-Allow-Methods", "GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS")
        response.headers.add("Access-Control-Allow-Credentials", "true")
    return response


@app.route('/upload', methods=['POST'])
def upload_image_to_firebase():
    try:
        image_input = request.json.get("imageInput")
        buffer = None
        content_type = None
        unique_id = str(uuid4())
        file_extension = ""

        if isinstance(image_input, str) and (image_input.startswith("http://") or image_input.startswith("https://")):
            response = requests.get(image_input)
            buffer = response.content
            content_type = response.headers.get("content-type", "image/png")
            file_extension = image_input.split(".")[-1].split("?")[0] if "?" in image_input else "png"
        else:
            base64_data = image_input.replace("data:image/{0};base64,".format(file_extension), "")
            buffer = base64.b64decode(base64_data)
            file_extension = "png" if not file_extension else file_extension
            content_type = f"image/{file_extension}"

        filename = f"{unique_id}.{file_extension}"
        blob = bucket.blob(filename)
        blob.upload_from_string(buffer, content_type=content_type)

        url = blob.generate_signed_url(expiration="2025-03-17T00:00:00Z")

        return jsonify({"uploadedImageUrl": url}), 200
    except Exception as e:
        print("Error uploading image:", e)
        return jsonify({"error": str(e)}), 500
      
def preprocess_chat_history(messages):
    return [
        {"role": message["role"], "content": "generated image" if message["type"] == "image" else message["content"]}
        for message in messages
    ]

@app.route('/send-message', methods=['POST'])
def send_message():
    try:
        data = request.json
        user_prompt = data.get("userPrompt")
        message_type = data.get("type")
        selected_image_size = data.get("selectedImageSize")
        selected_image_provider = data.get("selectedImageProvider")
        active_conversation = data.get("activeConversation")
        user_id = data.get("userId")

        conversation = None

        if active_conversation:
            conversation = get_conversation_from_database(active_conversation, user_id)

        def generate_unique_id():
            timestamp = int(time.time() * 1000)
            random_number = random.random()
            hexadecimal_string = hex(int(random_number * 16 ** 6))[2:]
            return f"id-{timestamp}-{hexadecimal_string}"

        if not conversation or conversation["id"] == "null":
            new_id = generate_unique_id()
            conversation = {"id": new_id, "messages": []}
            save_conversation_to_firebase(conversation, user_id)

        updated_messages = conversation["messages"] + [user_prompt]

        preprocessed_messages = preprocess_chat_history(updated_messages)

        new_message = {}

        if message_type == "image":
            if selected_image_provider == "DALL-E":
                image_response = openai.Image.create(
                    prompt=user_prompt["content"],
                    n=1,
                    size=selected_image_size,
                    response_format="url"
                )

                image_url = image_response.data[0]["url"]
                uploaded_image_url = upload_image_to_firebase(image_url)

                new_message = {
                    "role": "system",
                    "content": "",
                    "images": [uploaded_image_url],
                    "type": "image"
                }

                return jsonify({
                    "bot": "",
                    "type": "image",
                    "images": [uploaded_image_url]
                }), 200
            else:
                # STABLE DIF PROVIDER
                engine_id = "stable-diffusion-v1-5"
                width, height = map(int, selected_image_size.split("x"))

                image_response = requests.post(
                    f"{stability_api_host}/v1/generation/{stability_engine_id}/text-to-image",
                    headers={
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "Authorization": f"Bearer {stability_api_key}"
                    },
                    json={
                        "text_prompts": [{"text": user_prompt["content"], "weight": 0.5}],
                        "cfg_scale": 7,
                        "clip_guidance_preset": "FAST_BLUE",
                        "height": height,
                        "width": width,
                        "samples": 1,
                        "steps": 30
                    }
                )

                if not image_response.ok:
                    raise Exception(f"Non-200 response: {image_response.text}")

                response_json = image_response.json()
                uploaded_image_urls = []

                for index, image in enumerate(response_json["artifacts"]):
                    image_base64 = image["base64"]
                    uploaded_image_url = upload_image_to_firebase(image_base64)
                    uploaded_image_urls.append(uploaded_image_url)
                
                new_message = {
                    "role": "system",
                    "content": "",
                    "images": uploaded_image_urls,
                    "type": "image"
                }

                return jsonify({
                    "bot": "",
                    "type": "image",
                    "images": uploaded_image_urls
                }), 200
        else:
            response = openai.ChatCompletion.create(
                model="gpt-4",
                messages=preprocessed_messages,
                temperature=0.5,
                max_tokens=2000,
                top_p=1,
                frequency_penalty=0.5,
                presence_penalty=0
            )

            bot_response = response.choices[0].message["content"].strip()

            new_message = {
                "role": "system",
                "content": bot_response,
                "type": "text"
            }

            return jsonify({
                "bot": bot_response,
                "type": "text"
            }), 200

    except Exception as e:
        print("Error:", e)
        return jsonify({"error": str(e)}), 500
      
def get_conversation_from_database(active_conversation, user_id):
    try:
        db = firebase_admin.firestore.client()
        conversations_ref = db.collection(f"users/{user_id}/conversations")
        doc_ref = conversations_ref.document(active_conversation)

        doc = doc_ref.get()

        if doc.exists:
            return doc.to_dict()
        else:
            return None
    except Exception as e:
        print("Error getting conversation from Firebase:", e)
        raise e

def save_conversation_to_firebase(conversation, user_id):
    try:
        db = firebase_admin.firestore.client()
        conversations_ref = db.collection(f"users/{user_id}/conversations")
        doc_ref = conversations_ref.document(conversation["id"])

        doc_ref.set(conversation)
    except Exception as e:
        print("Error saving conversation to Firebase:", e)

@app.route('/ping', methods=['GET'])
def ping():
    return jsonify({"message": "pong"}), 200

import http.client

def self_ping():
    print("Pinging to keep the server awake...")
    connection = http.client.HTTPSConnection("chat-cbd.onrender.com")
    connection.request("GET", "/ping")
    response = connection.getresponse()
    print(f"Self-ping status: {response.status}")
    connection.close()

# Schedule the self-ping every 14 minutes
import threading

def self_ping_scheduler():
    self_ping()
    threading.Timer(14 * 60, self_ping_scheduler).start()

self_ping_scheduler()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
