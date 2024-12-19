const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const { HfInference } = require("@huggingface/inference");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { startPolling } = require("./commands/freegame.js");
dotenv.config();

// Initialize AI Clients
const huggingface_client = new HfInference(process.env.HUGGINGFACE_TOKEN);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Directory for storing conversation histories
const CONVERSATION_DIR = path.join(__dirname, "conversation");
if (!fs.existsSync(CONVERSATION_DIR)) {
  fs.mkdirSync(CONVERSATION_DIR);
}

// Function to generate conversation ID
const generateConversationId = (userId, groupId = null) => {
  return groupId ? `${userId}-${groupId}` : userId;
};

// Function to manage chat history
const chatHistoryManager = {
  load: (conversationId) => {
    const filePath = path.join(CONVERSATION_DIR, `${conversationId}.json`);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data);
    }
    return [];
  },

  save: (conversationId, history) => {
    const filePath = path.join(CONVERSATION_DIR, `${conversationId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(history, null, 2), "utf-8");
  },

  add: (conversationId, userMessage, assistantMessage) => {
    const history = chatHistoryManager.load(conversationId);
    history.push(
      { role: "user", content: userMessage, timestamp: Date.now() },
      { role: "assistant", content: assistantMessage, timestamp: Date.now() }
    );
    chatHistoryManager.save(conversationId, history);
  },
};

// Function to get AI response with fallback
const getAIResponse = async (message, conversationId) => {
  const chatHistory = chatHistoryManager.load(conversationId);
  const recentHistory = chatHistory.slice(-10);

  const systemPrompt =
    "Dirikamu adalah elysia, kamu AI canggih tapi berperilaku seperti manusia. Jawab pesan dengan singkat tapi informatif dan gunakan bahasa sehari-hari layaknya orang normal jaman sekarang.";

  try {
    // Try Hugging Face first
    const response = await huggingface_client.chatCompletion({
      model: "Qwen/Qwen2.5-72B-Instruct",
      messages: [
        { role: "system", content: systemPrompt },
        ...recentHistory.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        { role: "user", content: message },
      ],
      temperature: 0.5,
      max_tokens: 2048,
      top_p: 0.7,
    });

    const reply = response.choices[0].message.content;
    chatHistoryManager.add(conversationId, message, reply);
    return reply;
  } catch (error) {
    console.log("Hugging Face error, falling back to Gemini:", error.message);

    // Fallback to Gemini
    try {
      const chatSession = genAI
        .getGenerativeModel({
          model: "gemini-2.0-flash-exp",
          systemInstruction: systemPrompt,
        })
        .startChat({
          generationConfig: {
            temperature: 1,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 8192,
            responseMimeType: "text/plain",
          },
          history: recentHistory.map((msg) => ({
            role: msg.role === "assistant" ? "model" : msg.role,
            parts: [{ text: msg.content }],
          })),
        });

      const result = await chatSession.sendMessage(message);
      const reply = result.response.text();
      chatHistoryManager.add(conversationId, message, reply);
      return reply;
    } catch (geminiError) {
      console.error("Gemini error:", geminiError.message);
      return "Maaf, aku sedang tidak bisa menjawab sekarang.";
    }
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
  const groupId = "120363347289234979@g.us";
  startPolling(client, groupId);
});

// Extract clean message content from group messages
const extractMessageContent = async (message) => {
  if (message.fromGroup) {
    // Get bot's contact info
    const botContact = await client.getContactById(client.info.wid._serialized);

    // Remove the bot's mention from the message using mentions data
    if (message.mentionedIds?.includes(botContact.id._serialized)) {
      // Get the message without mentions
      const cleanMessage = message.body.replace(/@\d+/g, "").trim();
      return cleanMessage;
    }
    return null; // Return null if bot wasn't mentioned
  }
  return message.body.trim();
};

// Handle incoming messages
client.on("message", async (message) => {
  console.log(`Pesan: [${message.body}] [${message.author}]`);

  // Get clean message content
  const messageContent = await extractMessageContent(message);

  // Skip if group message without tag or if cleaning resulted in null
  if (messageContent === null) {
    console.log("Pesan grup tidak ada tag bot.");
    return;
  }

  const userId = message.author || message.from;
  const groupId = message.fromGroup ? message.from : null;
  const conversationId = generateConversationId(userId, groupId);

  let hasReplied = false;

  // Handle commands
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
    // Process message with AI
    const reply = await getAIResponse(messageContent, conversationId);
    if (!hasReplied && reply) {
      message.reply(reply);
      hasReplied = true;
    }
  }
});

client.initialize();
