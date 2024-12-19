const axios = require("axios");
const FormData = require("form-data");
const { MessageMedia } = require("whatsapp-web.js");

const handleReminiCommand = async (client, message) => {
  try {
    // Cek apakah pesan adalah media
    if (!message.hasMedia) {
      message.reply("Tolong kirim gambar dengan caption /remini.");
      return;
    }

    // Mengunduh media dari pesan
    const media = await message.downloadMedia();

    // Konversi media ke Buffer
    const buffer = Buffer.from(media.data, "base64");

    // Buat form data untuk mengunggah gambar ke file.io
    const formData = new FormData();
    formData.append("file", buffer, {
      filename: "image.png",
      contentType: media.mimetype,
    });

    // Mengunggah gambar ke file.io
    const uploadResponse = await axios.post("https://file.io/", formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

    if (!uploadResponse.data.success) {
      message.reply("Maaf, gagal mengunggah gambar.");
      return;
    }

    const imageUrl = uploadResponse.data.link;

    // Menggunakan API remini untuk meningkatkan kualitas gambar
    const reminiResponse = await axios.get(
      `https://api.ryzendesu.vip/api/ai/remini?url=${imageUrl}&method=enhance`,
      { responseType: "arraybuffer" } // Menerima respons berupa gambar biner
    );

    // Mengonversi hasil respons ke Base64
    const resultImageBase64 = Buffer.from(
      reminiResponse.data,
      "binary"
    ).toString("base64");
    const resultImageMimeType = reminiResponse.headers["content-type"];

    // Mengirimkan gambar hasil ke pengguna
    const mediaResult = new MessageMedia(
      resultImageMimeType,
      resultImageBase64
    );
    client.sendMessage(message.from, mediaResult, {
      caption: "Gambar berhasil ditingkatkan!",
    });
  } catch (error) {
    console.error("Error saat meningkatkan kualitas gambar:", error);
    message.reply(
      "Maaf, terjadi masalah saat memproses gambar. Coba lagi nanti."
    );
  }
};

module.exports = handleReminiCommand;
