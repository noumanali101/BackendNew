// server.js
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const OpenAI = require('openai');
const cors = require('cors'); // Import cors

const openai = new OpenAI();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors()); // Use cors middleware
app.use(express.json());

const assistants = {}; // Store assistant and thread information

app.post('/property', async (req, res) => {
  try {
    const { query, userId } = req.body; // Include userId to identify users
    query= "You are a property assistance bot. Provide answers and assistance related to property inquiries. You are not allowed to answer irrelevant questions."+ query;
    if (!assistants[userId]) {
      const assistant = await openai.beta.assistants.create({
        name: "Property Assistant",
        instructions: "You are a property assistance bot. Provide answers and assistance related to property inquiries. You are not allowed to answer irrelevant questions.",
        tools: [{ type: "code_interpreter" }],
        model: "gpt-4o-mini"
      });

      const thread = await openai.beta.threads.create();

      assistants[userId] = { assistant, thread };
    }

    const { assistant, thread } = assistants[userId];

    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `I have a property-related question: ${query}`
    });

    let responseText = '';

    const run = openai.beta.threads.runs.stream(thread.id, {
      assistant_id: assistant.id
    })
      .on('textCreated', (text) => responseText += text.value)
      .on('textDelta', (textDelta) => responseText += textDelta.value)
      .on('toolCallCreated', (toolCall) => responseText += `\n${toolCall.type}\n`)
      .on('toolCallDelta', (toolCallDelta) => {
        if (toolCallDelta.type === 'code_interpreter') {
          if (toolCallDelta.code_interpreter.input) {
            responseText += toolCallDelta.code_interpreter.input;
          }
          if (toolCallDelta.code_interpreter.outputs) {
            responseText += "\noutput >\n";
            toolCallDelta.code_interpreter.outputs.forEach(output => {
              if (output.type === "logs") {
                responseText += `\n${output.logs}\n`;
              }
            });
          }
        }
      })
      .on('end', () => res.json({ response: responseText })) // Send response as JSON
      .on('error', (err) => {
        console.error('Stream error:', err);
        res.status(500).json({ error: 'Error processing the request' }); // Send error as JSON
      });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal Server Error' }); // Send error as JSON
  }
});

// Hello World endpoint
app.use("/", (req, res) => {
  res.send("Hello World ");
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
