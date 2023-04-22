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

const PORT = process.env.PORT || 5000;

try {
  app.post("/send-message", async (req, res) => {
    try {
      const { messages, type } = req.body;

      if (type === "image") {
        const imageResponse = await openai.createImage({
          prompt: messages[messages.length - 1].content,
          n: 1,
          size: "256x256",
          response_format: "url",
        });

        const imageUrl = imageResponse.data.data[0].url;

        res.status(200).send({
          bot: imageUrl,
          type: "image",
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
          type: "text",
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
