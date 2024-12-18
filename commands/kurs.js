const axios = require("axios");

const handleKursCommand = async (client, message) => {
  // Pastikan message ada dan memiliki body
  if (!message || !message.body) {
    console.error("Pesan tidak valid:", message);
    return;
  }

  // Menghapus perintah "/kurs " dari body pesan
  const args = message.body.replace("/kurs ", "").trim().split(" ");

  if (args.length !== 3) {
    message.reply(
      "Format yang benar: /kurs <jumlah> <dari> <ke>. Contoh: /kurs 100 USD IDR"
    );
    return;
  }

  const amount = parseFloat(args[0]);
  const fromCurrency = args[1].toUpperCase();
  const toCurrency = args[2].toUpperCase();

  // Validasi jumlah
  if (isNaN(amount) || amount <= 0) {
    message.reply("Silakan masukkan jumlah yang valid.");
    return;
  }

  try {
    // Mengambil data kurs dari API
    const response = await axios.get(
      `https://api.exchangerate-api.com/v4/latest/${fromCurrency}`
    );

    const rates = response.data.rates;
    if (!rates || !rates[toCurrency]) {
      message.reply(
        "Mata uang yang diminta tidak valid. Silakan periksa kode mata uang."
      );
      return;
    }

    const convertedAmount = (amount * rates[toCurrency]).toFixed(2);
    message.reply(
      `${amount} ${fromCurrency} = ${convertedAmount} ${toCurrency}`
    );
  } catch (error) {
    console.error("Error saat menghubungi API kurs:", error);
    message.reply("Maaf, ada masalah saat menghubungi API. Coba lagi nanti.");
  }
};

module.exports = handleKursCommand;
