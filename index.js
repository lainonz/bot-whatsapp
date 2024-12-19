const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const { HfInference } = require("@huggingface/inference");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { startPolling } = require("./commands/freegame.js");
dotenv.config();

// Initialize Hugging Face Client
const huggingface_client = new HfInference(process.env.HUGGINGFACE_TOKEN);
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

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
    const chatHistory = loadChatHistory(conversationId); // Load history
    const recentHistory = chatHistory.slice(-10); // Menyimpan riwayat pesan terbaru

    // Format pesan untuk Hugging Face
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
      { role: "user", content: message.body },
    ];

    const response = await huggingface_client.chatCompletion({
      model: "Qwen/Qwen2.5-72B-Instruct",
      messages,
      temperature: 0.5,
      max_tokens: 2048,
      top_p: 0.7,
    });

    const assistantMessage = response.choices[0].message.content;

    // Menambahkan pesan ke dalam history
    chatHistory.push(
      { role: "user", content: message.body, timestamp: Date.now() },
      { role: "assistant", content: assistantMessage, timestamp: Date.now() }
    );

    // Simpan chat history setelah update
    saveChatHistory(conversationId, chatHistory);

    return assistantMessage;
  } catch (error) {
    console.error(
      "Error saat mendapatkan respons dari Hugging Face:",
      error.message
    );
    return "Maaf, aku sedang tidak bisa menjawab sekarang.";
  }
};

// Function to get response from Gemini
const chatCompletionFromGemini = async (message, conversationId) => {
  try {
    const chatHistory = loadChatHistory(conversationId); // Load history
    const recentHistory = chatHistory.slice(-10); // Menyimpan riwayat pesan terbaru

    // Mengirim pesan ke Gemini dan mendapatkan respons
    const chatSession = genAI
      .getGenerativeModel({
        model: "gemini-2.0-flash-exp",
        systemInstruction:
          "Dirikamu adalah elysia, kamu AI canggih tapi berperilaku seperti manusia. Jawab pesan dengan singkat tapi informatif dan gunakan bahasa sehari-hari layaknya orang normal jaman sekarang.",
      })
      .startChat({
        generationConfig: {
          temperature: 1,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 8192,
          responseMimeType: "text/plain",
        },
        history: [
          {
            role: "user",
            parts: [{ text: message.body }],
          },
          ...recentHistory.map((msg) => ({
            role: msg.role,
            parts: [{ text: msg.content }],
          })),
        ],
      });

    const result = await chatSession.sendMessage(message.body);
    const assistantMessage = result.response.text();

    // Menambahkan pesan ke dalam history
    chatHistory.push(
      { role: "user", content: message.body, timestamp: Date.now() },
      { role: "model", content: assistantMessage, timestamp: Date.now() }
    );

    // Simpan chat history setelah update
    saveChatHistory(conversationId, chatHistory);

    return assistantMessage;
  } catch (error) {
    console.error("Error saat mendapatkan respons dari Gemini:", error.message);
    return "Maaf, aku sedang tidak bisa menjawab sekarang.";
  }
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
  console.log(`Pesan: [${message.body}] [${message.author}]`);
  console.log("Pesan Grup:", message.from);

  // Generate unique conversation ID based on context
  const userId = message.author || message.from; // Use author for group messages, from for direct messages
  const groupId = message.fromGroup ? message.from : null;
  const conversationId = generateConversationId(userId, groupId);

  let hasReplied = false;

  // Handle messages only if tagged in group
  if (message.fromGroup && !message.body.includes("@6289655403985")) {
    console.log("Pesan grup tidak ada tag bot.");
    return;
  }

  // Handle commands
  const messageContent = message.body.trim();
  const prefix = "/";
  if (messageContent.startsWith(prefix)) {
    const command = messageContent.slice(prefix.length).split(" ")[0];
    const args = messageContent.slice(prefix.length + command.length).trim();

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
    // Use Hugging Face or Gemini for normal messages
    const reply = await (process.env.USE_GEMINI === "true"
      ? chatCompletionFromGemini(message, conversationId)
      : chatCompletionFromHuggingFace(message, conversationId));

    if (!hasReplied && reply) {
      message.reply(reply);
      hasReplied = true;
    }
  }
});

client.initialize();
