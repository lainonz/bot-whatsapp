const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { HfInference } = require("@huggingface/inference");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const { startPolling } = require("./commands/freegame.js");
dotenv.config();

// Initialize Hugging Face Client
const huggingface_client = new HfInference(process.env.HUGGINGFACE_TOKEN);

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
const chatCompletion = async (message, conversationId) => {
  try {
    // Load conversation history
    const chatHistory = loadChatHistory(conversationId);

    // Maintain a sliding window of recent messages (e.g., last 10 messages)
    const recentHistory = chatHistory.slice(-10);

    // Format messages for Hugging Face
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

    // Update conversation history
    chatHistory.push(
      { role: "user", content: message.body, timestamp: Date.now() },
      { role: "assistant", content: assistantMessage, timestamp: Date.now() }
    );

    // Save updated history
    saveChatHistory(conversationId, chatHistory);

    return assistantMessage;
  } catch (error) {
    console.error("Error fetching response from Hugging Face:", error.message);
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
// Handle incoming messages
client.on("message", async (message) => {
  console.log(`Pesan: [${message.body}] [${message.author}]`);
  console.log("Pesan Grup:", message.from);

  // Mengatur ID grup dan pesan pribadi
  const isGroupMessage = message.fromGroup;
  const isMentioned = message.mentionedIds.includes(
    client.info.wid._serialized
  );

  // Generate unique conversation ID based on context
  const userId = message.author || message.from; // Use author for group messages, from for direct messages
  const groupId = isGroupMessage ? message.from : null;
  const conversationId = generateConversationId(userId, groupId);

  let hasReplied = false;

  // Proses jika pesan datang dari pesan pribadi
  if (!isGroupMessage) {
    // Pesan pribadi langsung diproses tanpa tag
    const messageContent = message.body.trim();

    // Handle commands with prefix "/"
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
      // Gunakan Hugging Face AI untuk pesan non-perintah
      const reply = await chatCompletion(messageContent, conversationId);

      if (!hasReplied && reply) {
        message.reply(reply);
        hasReplied = true;
      }
    }
  } else if (isGroupMessage && isMentioned) {
    // Proses jika pesan datang dari grup dan bot ditag
    const messageContent = message.body.replace(/@(\d+)/g, "").trim();

    // Handle commands with prefix "/"
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
      // Gunakan Hugging Face AI untuk pesan non-perintah
      const reply = await chatCompletion(messageContent, conversationId);

      if (!hasReplied && reply) {
        message.reply(reply);
        hasReplied = true;
      }
    }
  }
});

client.initialize();
