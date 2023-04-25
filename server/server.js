import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { Configuration, OpenAIApi } from "openai";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");

import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

const serviceAccountPath = "/etc/secrets/FIREBASE_SERVICE_ACCOUNT";
const serviceAccountContent = fs.readFileSync(serviceAccountPath, "utf-8");
const serviceAccount = JSON.parse(serviceAccountContent);

dotenv.config();

const app = admin.initializeApp({
  projectId: "project-12d32",
  storageBucket: "default-bucket",
  credential: admin.credential.applicationDefault(),
});

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

const allowedOrigins = [
  "https://chat-cbd-test.vercel.app",
  "http://localhost:5173",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

async function uploadImageToFirebase(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    const buffer = await response.buffer();
    const uniqueId = uuidv4();
    const fileExtension = imageUrl.split(".").pop().split("?")[0];
    const filename = `${uniqueId}.${fileExtension}`;

    const file = storageBucket.file(filename);

    const writeStream = file.createWriteStream({
      metadata: {
        contentType: response.headers.get("content-type"),
      },
    });

    const uploadPromise = new Promise((resolve, reject) => {
      writeStream.on("error", (error) => reject(error));
      writeStream.on("finish", () => {
        file.getSignedUrl(
          {
            action: "read",
            expires: "03-17-2025",
          },
          (error, url) => {
            if (error) {
              reject(error);
            } else {
              resolve(url);
            }
          }
        );
      });
    });

    writeStream.end(buffer);

    const uploadedImageUrl = await uploadPromise;
    return uploadedImageUrl;
  } catch (error) {
    console.error("Error uploading image:", error);
    throw error;
  }
}

const PORT = process.env.PORT || 5000;

try {
  app.post("/send-message", async (req, res) => {
    try {
      const { messages, type, activeConversation } = req.body;

      if (type === "image") {
        const imageResponse = await openai.createImage({
          prompt: messages[messages.length - 1].content,
          n: 1,
          size: "256x256",
          response_format: "url",
        });

        const imageUrl = imageResponse.data.data[0].url;
        const uploadedImageUrl = await uploadImageToFirebase(imageUrl);

        const updatedChatHistory = [
          ...messages,
          {
            role: "system",
            content: "",
            images: [uploadedImageUrl],
            type: "image",
          },
        ];

        await saveConversationToFirebase({
          id: activeConversation,
          messages: updatedChatHistory,
        });

        res.status(200).send({
          bot: "",
          type: "image",
          images: [uploadedImageUrl],
          chatHistory: updatedChatHistory,
        });
      } else {
        const response = await openai.createChatCompletion({
          model: "gpt-3.5-turbo",
          messages: messages,
          temperature: 0.5,
          max_tokens: 2000,
          top_p: 1,
          frequency_penalty: 0.5,
          presence_penalty: 0,
        });

        console.log("OpenAI API response:", response);

        const botResponse = response.data.choices[0].message.content.trim();

        const updatedChatHistory = [
          ...messages,
          { role: "system", content: botResponse, type: "text" },
        ];

        await saveConversationToFirebase({
          id: activeConversation,
          messages: updatedChatHistory,
        });

        res.status(200).send({
          bot: botResponse,
          type: "text",
          chatHistory: updatedChatHistory,
        });
      }
    } catch (error) {
      console.error(error);
      const { response } = error;
      let errorMessage = "An unknown error occurred";

      if (response && response.data && response.data.error) {
        errorMessage = response.data.error.message;
      }

      res.status(500).send({ error: errorMessage });
    }
  });
} catch (error) {
  console.error(error);
  const { response } = error;
  let errorMessage = "An unknown error occurred";

  if (response && response.data && response.data.error) {
    errorMessage = response.data.error.message;
  }

  res.status(500).send({
    error: errorMessage,
    statusCode: response.status,
    statusText: response.statusText,
  }); // Add statusCode and statusText
}

async function saveConversationToFirebase(conversation) {
  try {
    const db = admin.firestore();
    const conversationsRef = db.collection("conversations");
    const docRef = conversationsRef.doc(conversation.id);

    await docRef.set(conversation);

    console.log(`Conversation ${conversation.id} saved to Firebase.`);
  } catch (error) {
    console.error("Error saving conversation to Firebase:", error);
  }
}

app.listen(process.env.PORT || 5000, () =>
  console.log(
    `Server is running on port http://localhost:${process.env.PORT || 5000}`
  )
);
