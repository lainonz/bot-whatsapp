const axios = require("axios");
const FormData = require("form-data");

const imageai = async (client, message, userMessage) => {
  try {
    let fileUrl = null;

    // Cek apakah pesan mengandung media
    if (message.hasMedia) {
      // Mengunduh media dari pesan
      const media = await message.downloadMedia();
      // console.log("Media berhasil diunduh.");

      // Cek tipe MIME untuk menentukan format file
      const mimeType = media.mimetype;
      const validImageFormats = ["image/jpeg", "image/jpg", "image/png"];

      if (!validImageFormats.includes(mimeType)) {
        message.reply(
          "Format file tidak valid. Silakan kirim gambar (JPG, PNG)."
        );
        return;
      }

      // Konversi media ke Buffer
      const buffer = Buffer.from(media.data, "base64");

      // Buat form data untuk mengunggah file ke ImgBB
      const formData = new FormData();
      formData.append("image", buffer.toString("base64")); // Mengunggah file sebagai Base64

      // Mengunggah file ke ImgBB
      const uploadResponse = await axios.post(
        "https://api.imgbb.com/1/upload?expiration=600&key=1ef10cef7cd8d2f285fae4fcfb8456c8",
        formData
      );

      if (!uploadResponse.data.success) {
        console.error("Gagal mengunggah file:", uploadResponse.data);
        message.reply("Maaf, gagal mengunggah file.");
        return;
      }

      // Ambil URL file yang diunggah
      fileUrl = uploadResponse.data.data.url;
      // console.log("File berhasil diunggah:", fileUrl);
    }

    // Menyusun parameter gaya (jika diperlukan)
    const gaya = "berikan pesan informatif dan jelas"; // Ganti jika ada gaya tertentu

    // Menggunakan API untuk mendapatkan hasil
    // console.log("Mengirim permintaan ke API dengan teks:", userMessage);
    const aiResponse = await axios.get(
      `https://api.nyxs.pw/ai/gemini-input?text=${userMessage}&url=${fileUrl}&gaya=${gaya}`
    );

    if (!aiResponse.data.status) {
      console.error(
        "API tidak merespons dengan status yang benar:",
        aiResponse.data
      );
      message.reply(
        "Maaf, tidak ditemukan data di dalam URL ini. Pastikan URL ini valid."
      );
      return;
    }
    const result = aiResponse.data.result;

    // Menampilkan hasil dari AI
    message.reply(`${result}`);
    // console.log("Hasil AI berhasil didapat:", result);
  } catch (error) {
    console.error("Terjadi kesalahan saat menjalankan perintah AI:", error);
    message.reply("Maaf, terjadi kesalahan saat memproses perintah.");
  }
};

module.exports = imageai;
