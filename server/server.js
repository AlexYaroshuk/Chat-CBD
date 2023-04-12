import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { Configuration, OpenAIApi } from "openai";

dotenv.config();
let conversation = [];

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get("/", async (req, res) => {
  res.status(200).send({ message: "hello" });
});

app.post("/", async (req, res) => {
  try {
    const prompt = req.body.prompt;
    const chatHistory = req.body.chatHistory || [];

    // Add the user's message to the chatHistory array
    chatHistory.push({ role: "user", content: prompt });

    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: chatHistory,
      temperature: 0.5,
      max_tokens: 2000,
      top_p: 1,
      frequency_penalty: 0.5,
      presence_penalty: 0,
    });

    const botResponse = response.data.choices[0].text.trim();

    res.status(200).send({
      bot: botResponse,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error });
  }
});

app.listen(process.env.PORT || 5000, () =>
  console.log(
    `Server is running on port http://localhost:${process.env.PORT || 5000}`
  )
);
