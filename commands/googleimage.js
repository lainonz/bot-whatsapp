const axios = require("axios");
const { MessageMedia } = require("whatsapp-web.js");

// Cache untuk menyimpan hasil pencarian gambar
const cache = {};

// Fungsi delay untuk membatasi permintaan API
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Fungsi untuk memeriksa rate limit API
const checkRateLimit = async () => {
  try {
    const response = await axios.get(
      "https://api.ryzendesu.vip/api/search/gimage?query=sample"
    );
    const remainingRequests = response.headers["x-ratelimit-remaining"];
    const resetTime = response.headers["x-ratelimit-reset"];

    if (remainingRequests === "0") {
      const waitTime = resetTime * 1000 - Date.now();
      console.log(
        `Rate limit tercapai. Menunggu selama ${waitTime / 1000} detik.`
      );
      await delay(waitTime); // Menunggu sampai rate limit reset
    }
  } catch (error) {
    console.error("Tidak dapat memeriksa rate limit:", error);
  }
};

const isValidImageUrl = (url) => {
  return url.match(/\.(jpeg|jpg|gif|png|bmp)$/i);
};

const handleGimageCommand = async (client, message) => {
  if (!message || !message.body) {
    console.error("Pesan tidak valid:", message);
    return;
  }

  const userMessage = message.body.replace("/googleimage ", "").trim();
  if (userMessage.length === 0) {
    message.reply('Tolong berikan kata kunci setelah perintah "/googleimage".');
    return;
  }

  try {
    // Mengecek rate limit terlebih dahulu
    await checkRateLimit();

    const requestUrl = `https://api.ryzendesu.vip/api/search/gimage?query=${encodeURIComponent(
      userMessage
    )}`;
    // console.log("Request URL:", requestUrl);

    const response = await axios.get(requestUrl);
    const images = response.data;

    if (!Array.isArray(images) || images.length === 0) {
      message.reply("Maaf, tidak ada gambar yang ditemukan.");
      return;
    }

    // console.log("Gambar yang ditemukan:", images);

    // Mengirim gambar ke chat pribadi
    for (let i = 0; i < Math.min(images.length, 3); i++) {
      const imageUrl = images[i].image;
      //   console.log("URL Gambar:", imageUrl);

      if (isValidImageUrl(imageUrl)) {
        try {
          const media = await MessageMedia.fromUrl(imageUrl, {
            unsafeMime: true,
          });
          const chatId = message.from;
          await client.sendMessage(chatId, media, {
            caption: `Gambar ${i + 1} dari pencarian "${userMessage}":`,
          });
          await delay(1000); // Jeda antar pengiriman gambar
        } catch (err) {
          console.error(`Gagal mengirim gambar ${i + 1}: ${err}`);
          message.reply(`Maaf, gambar ${i + 1} gagal dikirim.`);
        }
      } else {
        console.log(`URL Gambar ${i + 1} tidak valid: ${imageUrl}`);
      }
    }

    message.reply(
      "Semua gambar yang valid telah dikirim ke chat pribadi Anda."
    );
  } catch (error) {
    console.error("Error saat mengirim permintaan ke API Gimage:", error);
    message.reply("Maaf, ada masalah saat menghubungi API. Coba lagi nanti.");
  }
};

module.exports = handleGimageCommand;
