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

import * as Generation from "./generation/generation_pb";
import { GenerationServiceClient } from "./generation/generation_pb_service";
import { grpc as GRPCWeb } from "@improbable-eng/grpc-web";
import { NodeHttpTransport } from "@improbable-eng/grpc-web-node-http-transport";
import {
  buildGenerationRequest,
  executeGenerationRequest,
  onGenerationComplete,
} from "./helpers";

const serviceAccountPath = "/etc/secrets/FIREBASE_SERVICE_ACCOUNT";
const serviceAccountContent = fs.readFileSync(serviceAccountPath, "utf-8");
const serviceAccount = JSON.parse(serviceAccountContent);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});

dotenv.config();

const app = express();

// ? Initialize the OpenAI client
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

// ? Initialize the gRPC client
// This is a NodeJS-specific requirement - browsers implementations should omit this line.
GRPCWeb.setDefaultTransport(NodeHttpTransport());

// Authenticate using your API key, don't commit your key to a public repository!
const metadata = new GRPCWeb.Metadata();
metadata.set("Authorization", "Bearer " + process.env.STABLE_API_KEY);

// Create a generation client to use with all future requests
const client = new GenerationServiceClient("https://grpc.stability.ai", {});

const allowedOrigins = [
  "https://chat-cbd-server-test.onrender.com",
  "localhost",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
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

    const file = admin.storage().bucket().file(filename);
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

    const uploadedImageUrl = await uploadPromise.catch((error) => {
      console.error("Error uploading image:", error);
      throw error;
    });

    return uploadedImageUrl;
  } catch (error) {
    console.error("Error uploading image:", error);
    throw error;
  }
}

const PORT = process.env.PORT || 5000;

function preprocessChatHistory(messages) {
  return messages.map((message) => {
    // Check if the message is an image
    const isImage = message.type === "image";

    // Only return the role and content properties of each message
    return {
      role: message.role,
      content: isImage ? "generated image" : message.content,
    };
  });
}

app.post("/send-message", async (req, res) => {
  console.log("body received", req.body);
  try {
    const {
      userPrompt,
      type,
      selectedImageSize,
      selectedImageProvider,
      activeConversation,
      userId,
    } = req.body;
    console.log("body received", req.body);

    let conversation = null;

    if (activeConversation) {
      conversation = await getConversationFromDatabase(
        activeConversation,
        userId
      );
    }

    // Generate a unique ID
    function generateUniqueId() {
      const timestamp = Date.now();
      const randomNumber = Math.random();
      const hexadecimalString = randomNumber.toString(16);
      return `id-${timestamp}-${hexadecimalString}`;
    }

    // Create a new conversation if it doesn't exist
    if (!conversation || conversation.id === "null") {
      const newId = generateUniqueId();
      conversation = {
        id: newId,
        messages: [],
      };
      await saveConversationToFirebase(conversation, userId);
    }
    // Add the userPrompt to the conversation's messages array
    const updatedMessages = [...conversation.messages, userPrompt];

    // Preprocess the messages
    const preprocessedMessages = preprocessChatHistory(updatedMessages);

    /* console.log("🚀 ~ app.post ~ preprocessedMessages:", preprocessedMessages); */
    let newMessage;

    // ! image type
    if (type === "image") {
      // ?? OPENAI PROVIDER
      if (selectedImageProvider === "DALL-E") {
        const imageResponse = await openai.createImage({
          prompt: userPrompt.content,
          n: 1,
          size: selectedImageSize,
          response_format: "url",
        });

        const imageUrl = imageResponse.data.data[0].url;
        const uploadedImageUrl = await uploadImageToFirebase(imageUrl);

        newMessage = {
          role: "system",
          content: "",
          images: [uploadedImageUrl],
          type: "image",
        };

        console.log("request:", imageResponse);
        console.log("image size rec:", selectedImageSize);

        res.status(200).send({
          bot: "",
          type: "image",
          images: [uploadedImageUrl],
        });
      } else {
        // ?? STABLE DIF PROVIDER{
        const [width, height] = selectedImageSize.split("x").map(Number);
        const imageResponse = buildGenerationRequest(
          "stable-diffusion-xl-beta-v2-2-2",
          {
            type: "text-to-image",
            prompts: [
              {
                text: userPrompt.content,
              },
            ],
            width: width,
            height: height,
            samples: 1,
            cfgScale: 13,
            steps: 25,
            sampler: Generation.DiffusionSampler.SAMPLER_K_DPMPP_2M,
          }
        );

        executeGenerationRequest(client, request, metadata)
          .then(onGenerationComplete)
          .catch((error) => {
            console.error("Failed to make text-to-image request:", error);
          });

        const imageUrl = imageResponse.data.data[0].url;
        const uploadedImageUrl = await uploadImageToFirebase(imageUrl);

        newMessage = {
          role: "system",
          content: "",
          images: [uploadedImageUrl],
          type: "image",
        };

        console.log("request:", imageResponse);
        console.log("image size rec:", selectedImageSize);

        res.status(200).send({
          bot: "",
          type: "image",
          images: [uploadedImageUrl],
        });
      }
    }
    // ! text type
    else {
      const response = await openai.createChatCompletion({
        model: "gpt-4",
        messages: preprocessedMessages,
        temperature: 0.5,
        max_tokens: 2000,
        top_p: 1,
        frequency_penalty: 0.5,
        presence_penalty: 0,
      });

      console.log("OpenAI API response:", response);

      const botResponse = response.data.choices[0].message.content.trim();

      newMessage = {
        role: "system",
        content: botResponse,
        type: "text",
      };

      res.status(200).send({
        bot: botResponse,
        type: "text",
      });
    }

    // Update the messages array with the new message

    const updatedMessagesWithResponse = [...updatedMessages, newMessage];

    await saveConversationToFirebase(
      { id: activeConversation, messages: updatedMessagesWithResponse },
      userId
    );
  } catch (error) {
    const { response } = error;
    console.log("🚀 ~ app.post ~ error:", error);
    let errorMessage = "An unknown error occurred";
    let statusCode = 500; // Add this line to send the correct status code

    if (response && response.data && response.data.error) {
      errorMessage = response.data.error.message;
      statusCode = response.status || 500; // Update the status code if available
    }
    res.status(statusCode).send({ error: errorMessage });
    console.log("🚀 ~ app.post ~ errorMessage:", errorMessage);
    // Send the status code along with the error message
  }
});

/* app.use((error, req, res, next) => {
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
  });
}); */

async function getConversationFromDatabase(activeConversation, userId) {
  try {
    const db = admin.firestore();
    const conversationsRef = db.collection(`users/${userId}/conversations`);
    const docRef = conversationsRef.doc(activeConversation);

    const doc = await docRef.get();

    if (doc.exists) {
      return doc.data();
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error getting conversation from Firebase:", error);
    throw error;
  }
}

async function saveConversationToFirebase(conversation, userId) {
  /* console.log("Saving conversation:", conversation); */
  try {
    const db = admin.firestore();
    const conversationsRef = db.collection(`users/${userId}/conversations`);
    const docRef = conversationsRef.doc(conversation.id);

    /* console.log("Before saving to Firebase:", conversation); */
    await docRef.set(conversation);
    /* console.log("After saving to Firebase:", conversation); */

    /* console.log(`Conversation ${conversation.id} saved to Firebase.`); */
  } catch (error) {
    console.error("Error saving conversation to Firebase:", error);
  }
}

app.listen(process.env.PORT || 5000, () =>
  console.log(
    `Server is running on port http://localhost:${process.env.PORT || 5000}`
  )
);

app.get("/ping", (req, res) => {
  res.status(200).send("pong");
});

const https = require("https");

const options = {
  hostname: "chat-cbd.onrender.com",
  path: "/ping",
  method: "GET",
};

// Self-ping function
function selfPing() {
  console.log("Pinging to keep the server awake...");
  https
    .request(options, (res) => {
      console.log(`Self-ping status: ${res.statusCode}`);
      res.on("data", (d) => {
        process.stdout.write(d);
      });
    })
    .on("error", (err) => {
      console.error(`Self-ping error: ${err.message}`);
    })
    .end();
}

// Schedule the self-ping every 14 minutes
setInterval(selfPing, 14 * 60 * 1000);
