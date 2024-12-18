const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { HfInference } = require("@huggingface/inference");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
dotenv.config();

// Inisialisasi Hugging Face Client
const huggingface_client = new HfInference(process.env.HUGGINGFACE_TOKEN);

// Folder untuk menyimpan riwayat percakapan
const CONVERSATION_DIR = path.join(__dirname, "conversation");

// Buat folder jika belum ada
if (!fs.existsSync(CONVERSATION_DIR)) {
  fs.mkdirSync(CONVERSATION_DIR);
}

// Fungsi untuk memuat riwayat percakapan dari file JSON
const loadChatHistory = (userId) => {
  const filePath = path.join(CONVERSATION_DIR, `${userId}.json`);
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data);
  }
  return [];
};

// Fungsi untuk menyimpan riwayat percakapan ke file JSON
const saveChatHistory = (userId, history) => {
  const filePath = path.join(CONVERSATION_DIR, `${userId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(history, null, 2), "utf-8");
};

// Fungsi untuk mendapatkan respons dari Hugging Face
const chatCompletion = async (userId, userMessage) => {
  try {
    // Muat riwayat percakapan
    const chatHistory = loadChatHistory(userId);

    // Format pesan untuk dikirim ke Hugging Face
    const messages = [
      {
        role: "system",
        content:
          "Dirikamu adalah elysia, kamu AI canggih tapi berperilaku seperti manusia. Jawab pesan dengan singkat tapi informatif dan gunakan bahasa sehari-hari layaknya orang normal jaman sekarang.",
      },
      ...chatHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: "user", content: userMessage },
    ];

    const response = await huggingface_client.chatCompletion({
      model: "Qwen/Qwen2.5-72B-Instruct",
      messages,
      temperature: 0.5,
      max_tokens: 2048,
      top_p: 0.7,
    });

    const assistantMessage = response.choices[0].message.content;

    // Perbarui riwayat percakapan
    chatHistory.push({ role: "user", content: userMessage });
    chatHistory.push({ role: "assistant", content: assistantMessage });

    // Simpan riwayat percakapan ke file
    saveChatHistory(userId, chatHistory);

    return assistantMessage;
  } catch (error) {
    console.error("Error fetching response from Hugging Face:", error.message);
    return "Maaf, aku sedang tidak bisa menjawab sekarang.";
  }
};

// Inisialisasi WhatsApp Client
const client = new Client({
  authStrategy: new LocalAuth(),
});

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Bot WhatsApp siap digunakan!");
});

// Tangkap pesan yang diterima

client.on("message", async (message) => {
  console.log("Pesan diterima:", message.body);

  // Identifikasi user ID (gunakan ID pengguna atau grup)
  const userId = message.from;

  // Flag untuk melacak apakah sudah ada balasan
  let hasReplied = false;

  // Periksa apakah pesan dimulai dengan prefix "/"
  const prefix = "/"; // Prefix yang digunakan
  if (message.body.startsWith(prefix)) {
    const command = message.body.slice(prefix.length).split(" ")[0]; // Ambil perintah setelah prefix
    const args = message.body.slice(prefix.length + command.length).trim(); // Ambil argumen setelah perintah

    // Eksekusi perintah berdasarkan nama file di folder commands
    try {
      const commandFile = require(`./commands/${command}.js`);
      const reply = await commandFile(client, message, args);

      // Pastikan hanya satu balasan yang dikirim
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
    // Jika tidak ada prefix, gunakan Hugging Face AI untuk balasan
    const reply = await chatCompletion(userId, message.body);

    // Pastikan hanya satu balasan yang dikirim
    if (!hasReplied && reply) {
      message.reply(reply);
      hasReplied = true;
    }
  }
});

// Mulai bot
client.initialize();
