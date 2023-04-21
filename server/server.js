import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { Configuration, OpenAIApi } from "openai";

dotenv.config();

const app = express();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

app.use(cors());

/* const corsOptions = {
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

app.use(cors(corsOptions)); */
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get("/", async (req, res) => {
  res.status(200).send({ message: "hello" });
});

try {
  app.post("/send-message", async (req, res) => {
    try {
      const { messages, isImage } = req.body; // Receive the 'messages' object and 'isImage' flag
      console.log("Request payload:", req.body);

      if (isImage) {
        const imageResponse = await openai.createImageGeneration({
          prompt: messages[messages.length - 1].content,
          n: 1,
          size: "512x512",
          response_format: "url",
        });

        const imageUrl = imageResponse.data.data[0].url;

        res.status(200).send({
          bot: imageUrl,
          chatHistory: [
            ...messages,
            { role: "system", content: "", images: [imageUrl] },
          ],
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

        res.status(200).send({
          bot: botResponse,
          chatHistory: [...messages, { role: "system", content: botResponse }],
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
  console.error("Unhandled error:", error); // Log the unhandled error
  res.status(500).send({ error: "An unknown error occurred" });
}

app.listen(process.env.PORT || 5000, () =>
  console.log(
    `Server is running on port http://localhost:${process.env.PORT || 5000}`
  )
);
