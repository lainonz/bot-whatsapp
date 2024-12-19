const { EpicFreeGames } = require("epic-free-games");

// Variabel global untuk menyimpan state game terakhir
let lastGames = [];

// Fungsi utama untuk menangani permintaan game gratis
module.exports = async (client, message, args) => {
  try {
    const epicFreeGames = new EpicFreeGames({ includeAll: true });
    const games = await epicFreeGames.getGames();

    if (games.currentGames.length === 0) {
      return "Saat ini tidak ada game gratis di Epic Games.";
    }

    const gameList = games.currentGames
      .map((game) => {
        // Format tanggal mulai dan berakhir
        const startDate = new Date(game.effectiveDate).toLocaleString("id-ID", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        const endDate = game.promotions?.promotionalOffers[0]?.endDate
          ? new Date(
              game.promotions.promotionalOffers[0].endDate
            ).toLocaleString("id-ID", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Tidak tersedia";

        // URL game
        const gameUrl = `https://store.epicgames.com/p/${game.productSlug}`;

        return `*${game.title}*\n  - Tanggal Mulai: ${startDate}\n  - Tanggal Berakhir: ${endDate}\n  - Link: ${gameUrl}`;
      })
      .join("\n\n");

    return `Game gratis di Epic Games 🎮:\n\n${gameList}`;
  } catch (error) {
    console.error("Error fetching free games:", error.message);
    return "Terjadi kesalahan saat mengambil daftar game gratis.";
  }
};

// Fungsi polling untuk mengecek perubahan data
const pollEpicGames = async (client, groupId) => {
  try {
    const epicFreeGames = new EpicFreeGames({ includeAll: true });
    const games = await epicFreeGames.getGames();
    const newGames = games.currentGames;

    // Filter game baru
    const newGameTitles = newGames.map((game) => game.title);
    const lastGameTitles = lastGames.map((game) => game.title);
    const addedGames = newGames.filter(
      (game) => !lastGameTitles.includes(game.title)
    );

    // Jika ada game baru, kirim ke grup
    if (addedGames.length > 0) {
      const gameList = addedGames
        .map((game) => {
          // Format tanggal mulai dan berakhir
          const startDate = new Date(game.effectiveDate).toLocaleString(
            "id-ID",
            {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }
          );
          const endDate = game.promotions?.promotionalOffers[0]?.endDate
            ? new Date(
                game.promotions.promotionalOffers[0].endDate
              ).toLocaleString("id-ID", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Tidak tersedia";

          // URL game
          const gameUrl = `https://store.epicgames.com/p/${game.productSlug}`;

          return `*${game.title}*\n  - Tanggal Mulai: ${startDate}\n  - Tanggal Berakhir: ${endDate}\n  - Link: ${gameUrl}`;
        })
        .join("\n\n");

      // Kirim pesan ke grup
      client.sendMessage(
        groupId,
        `🎉 Game gratis baru di Epic Games:\n\n${gameList}`
      );

      // Update state dengan game terbaru
      lastGames = newGames;
    }
  } catch (error) {
    console.error("Error polling free games:", error.message);
  }
};

// Jalankan polling setiap 30 menit
const startPolling = (client, groupId) => {
  setInterval(() => {
    pollEpicGames(client, groupId);
  }, 30 * 60 * 1000); // Setiap 30 menit
};

// Ekspor polling agar bisa dipanggil di `index.js`
module.exports.startPolling = startPolling;
