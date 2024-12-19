const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { HfInference } = require("@huggingface/inference");
const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const { startPolling } = require("./commands/freegame.js");

dotenv.config();

// Initialize Hugging Face Client
const huggingface_client = new HfInference(process.env.HUGGINGFACE_TOKEN);

// Initialize Google Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash-exp",
  systemInstruction:
    "Dirikamu adalah elysia, kamu AI canggih tapi berperilaku seperti manusia. Jawab pesan dengan singkat tapi informatif dan gunakan bahasa sehari-hari layaknya orang normal jaman sekarang.",
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

// Directory for storing conversation histories
const CONVERSATION_DIR = path.join(__dirname, "conversation");

// Create directory if it doesn't exist
if (!fs.existsSync(CONVERSATION_DIR)) {
  fs.mkdirSync(CONVERSATION_DIR);
}

// Function to generate a unique conversation ID for each user in each context
const generateConversationId = (userId, groupId = null) => {
  return groupId ? `${userId}-${groupId}` : userId;
};

// Function to load chat history from JSON file
const loadChatHistory = (conversationId) => {
  const filePath = path.join(CONVERSATION_DIR, `${conversationId}.json`);
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data);
  }
  return [];
};

// Function to save chat history to JSON file
const saveChatHistory = (conversationId, history) => {
  const filePath = path.join(CONVERSATION_DIR, `${conversationId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(history, null, 2), "utf-8");
};

// Function to get response from Hugging Face
const chatCompletionFromHuggingFace = async (message, conversationId) => {
  try {
    const chatHistory = loadChatHistory(conversationId);
    const recentHistory = chatHistory.slice(-10); // Maintain sliding window

    const messages = [
      {
        role: "system",
        content:
          "Dirikamu adalah elysia, kamu AI canggih tapi berperilaku seperti manusia. Jawab pesan dengan singkat tapi informatif dan gunakan bahasa sehari-hari layaknya orang normal jaman sekarang.",
      },
      ...recentHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: "user", content: message },
    ];

    const response = await huggingface_client.chatCompletion({
      model: "Qwen/Qwen2.5-72B-Instruct",
      messages,
      temperature: 0.5,
      max_tokens: 2048,
      top_p: 0.7,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error fetching response from Hugging Face:", error.message);
    return null; // Return null to indicate failure and fallback to Gemini
  }
};

// Function to get response from Google Gemini (if Hugging Face fails)
const chatCompletionFromGemini = async (message, conversationId) => {
  try {
    const chatHistory = loadChatHistory(conversationId); // Load Gemini chat history
    const recentHistory = chatHistory.slice(-10); // Maintain sliding window

    const chatSession = model.startChat({
      generationConfig,
      history: [
        {
          role: "user",
          parts: [{ text: message }],
        },
        ...recentHistory.map((msg) => ({
          role: msg.role,
          parts: [{ text: msg.content }],
        })),
      ],
    });

    const result = await chatSession.sendMessage(message);
    const assistantMessage = result.response.text();

    // Save the Gemini response to the history
    chatHistory.push(
      { role: "user", content: message, timestamp: Date.now() },
      { role: "model", content: assistantMessage, timestamp: Date.now() }
    );

    // Save updated history
    saveChatHistory(conversationId, chatHistory);

    return assistantMessage;
  } catch (error) {
    console.error("Error fetching response from Gemini:", error.message);
    return "Maaf, aku sedang tidak bisa menjawab sekarang.";
  }
};

// Function to process incoming messages
const processMessage = async (message, conversationId) => {
  let response = await chatCompletionFromHuggingFace(message, conversationId);

  // If Hugging Face fails, fallback to Gemini
  if (!response) {
    console.log("Falling back to Gemini...");
    response = await chatCompletionFromGemini(message, conversationId);
  }

  return response;
};

// Initialize WhatsApp Client
const client = new Client({
  authStrategy: new LocalAuth(),
});

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Ready!");

  const groupId = "120363347289234979@g.us"; // Ganti dengan ID grup sebenarnya
  startPolling(client, groupId);
});

// Handle incoming messages
client.on("message", async (message) => {
  // Console log to debug
  console.log(`Pesan: [${message.body}] [${message.author}]`);
  console.log("Pesan Grup:", message.from);

  // Generate unique conversation ID based on context
  const userId = message.author || message.from; // Use author for group messages, from for direct messages
  const groupId = message.fromGroup ? message.from : null;
  const conversationId = generateConversationId(userId, groupId);

  let hasReplied = false;

  // Handle commands with prefix "/"
  const prefix = "/";
  if (message.body.startsWith(prefix)) {
    const command = message.body.slice(prefix.length).split(" ")[0];
    const args = message.body.slice(prefix.length + command.length).trim();

    try {
      const commandFile = require(`./commands/${command}.js`);
      const reply = await commandFile(client, message, args);

      if (!hasReplied && reply) {
        message.reply(reply);
        hasReplied = true;
      }
    } catch (error) {
      if (!hasReplied) {
        message.reply(
          `Perintah "${command}" tidak dikenali. Ketik /help untuk bantuan.`
        );
        hasReplied = true;
      }
    }
  } else {
    // Use AI for non-command messages
    const reply = await processMessage(message.body, conversationId);

    if (!hasReplied && reply) {
      message.reply(reply);
      hasReplied = true;
    }
  }
});

// Start the bot
client.initialize();
