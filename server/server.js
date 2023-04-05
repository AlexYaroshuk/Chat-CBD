import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { Configuration, OpenAIApi } from 'openai';

dotenv.config()
let conversation = [];

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get('/', async (req, res) => {
    res.status(200).send({ message: 'hello' });
});

app.post('/', async (req, res) => {
    try {
        const prompt = req.body.prompt;
        const chatHistory = req.body.chatHistory || [];


        // Combine chatHistory with the latest prompt
        const fullPrompt = `${chatHistory.join("\n")}\nUser: ${prompt}\nAI: `;

        const response = await openai.createCompletion({
            model: "text-davinci-003",
            prompt: fullPrompt,
            temperature: 0,
            max_tokens: 2000,
            top_p: 1,
            frequency_penalty: 0.5,
            presence_penalty: 0
        });

        const botResponse = response.data.choices[0].text.trim();

        // Store the user's message and the bot's response in the conversation array
        conversation.push(`User: ${prompt}`, `AI: ${botResponse}`);

        res.status(200).send({
            bot: botResponse
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({ error });
    }
});

app.listen(5000, () => console.log('Server is running on port http://localhost:5000'))
