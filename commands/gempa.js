const axios = require("axios");
const { MessageMedia } = require("whatsapp-web.js");

const handleGempaCommand = async (client, message) => {
  // Pastikan message ada dan memiliki body
  if (!message || !message.body) {
    console.error("Pesan tidak valid:", message);
    return;
  }

  try {
    // Mengambil data gempa terbaru dari API BMKG
    const response = await axios.get(
      "https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json"
    );
    const gempaData = response.data.Infogempa.gempa;

    // Memastikan data gempa valid
    if (!gempaData) {
      message.reply("Maaf, tidak ada data gempa terbaru.");
      return;
    }

    // Mempersiapkan pesan untuk dikirim sebagai caption
    const gempaInfo = `Gempa terbaru dari BMKG

Tanggal: ${gempaData.Tanggal}
Jam: ${gempaData.Jam}
Magnitude: ${gempaData.Magnitude}
Kedalaman: ${gempaData.Kedalaman}
Wilayah: ${gempaData.Wilayah}
Potensi Tsunami: ${gempaData.Potensi}
Dirasakan: ${gempaData.Dirasakan}`;

    // Mengambil shakemap dan mengirimnya
    const shakemapUrl = `https://data.bmkg.go.id/DataMKG/TEWS/${gempaData.Shakemap}`;
    const shakemapMedia = await MessageMedia.fromUrl(shakemapUrl, {
      unsafeMime: true,
    });

    // Kirim shakemap ke chat grup dengan caption
    await client.sendMessage(message.from, shakemapMedia, {
      caption: gempaInfo, // Menggunakan informasi gempa sebagai caption
    });

    // Kirim balasan di chat grup
    // message.reply("Informasi gempa terbaru telah dikirim.");
  } catch (error) {
    console.error("Error saat mengirim permintaan ke API BMKG:", error);
    message.reply("Maaf, ada masalah saat menghubungi API. Coba lagi nanti.");
  }
};

module.exports = handleGempaCommand;
