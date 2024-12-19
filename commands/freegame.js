const { EpicFreeGames } = require("epic-free-games");

const freeGameCommand = async () => {
  try {
    // Inisialisasi tanpa filter, mencakup semua game gratis
    const epicFreeGames = new EpicFreeGames({ includeAll: true });

    // Mendapatkan game gratis saat ini dan game gratis berikutnya
    const response = await epicFreeGames.getGames();
    const allGames = [...response.currentGames, ...response.nextGames]; // Gabungkan semua game

    if (allGames.length === 0) {
      return "Tidak ada game gratis yang tersedia saat ini.";
    }

    // Membuat pesan daftar semua game gratis
    let message =
      "🎮 **Daftar Semua Game Gratis dari Epic Games Store** 🎮\n\n";
    allGames.forEach((game, index) => {
      const effectiveDate = new Date(game.effectiveDate).toLocaleString();
      const expiryDate = game.expiryDate
        ? new Date(game.expiryDate).toLocaleString()
        : "Tidak diketahui";
      const link = game.productSlug
        ? `https://store.epicgames.com/p/${game.productSlug}`
        : "Tidak tersedia";

      message += `${index + 1}. **${game.title}**\n`;
      //   message += `   - Deskripsi: ${game.description}\n`;
      message += `   - Tanggal Mulai: ${effectiveDate}\n`;
      message += `   - Tanggal Berakhir: ${expiryDate}\n`;
      message += `   - Link: ${link}\n\n`;
    });

    return message;
  } catch (error) {
    console.error("Error fetching free games:", error);
    return "Gagal mendapatkan daftar semua game gratis dari Epic Games.";
  }
};

module.exports = freeGameCommand;
