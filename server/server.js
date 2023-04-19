import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { Configuration, OpenAIApi } from "openai";

dotenv.config();

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

try {
  app.post("/send-message", async (req, res) => {
    try {
      const { messages } = req.body; // Receive the 'messages' object
      console.log("Request payload:", req.body);

      const response = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: messages, // Use the 'messages' object directly
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
