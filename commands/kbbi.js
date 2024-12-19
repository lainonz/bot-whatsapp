const fs = require("fs").promises;
const path = require("path");

const handleKbbiCommand = async (client, message) => {
  try {
    // Validate message
    if (!message || !message.body) {
      console.error("Pesan tidak valid:", message);
      return "Terjadi kesalahan dalam memproses pesan.";
    }

    // Extract search term from command
    const searchTerm = message.body.replace("/kbbi", "").trim().toLowerCase();

    // Validate search term
    if (!searchTerm) {
      return "Format yang benar: /kbbi <kata yang dicari>\nContoh: /kbbi aba";
    }

    // Read and parse KBBI JSON file
    const kbbiPath = path.join(__dirname, "..", "data", "kbbi.json");
    const rawData = await fs.readFile(kbbiPath, "utf8");
    const kbbiData = JSON.parse(rawData);

    // Search for matching words
    const results = kbbiData.dictionary.filter(
      (entry) => entry.word.toLowerCase().trim() === searchTerm
    );

    if (results.length === 0) {
      // If no exact match, try to find similar words
      const suggestions = kbbiData.dictionary
        .filter((entry) =>
          entry.word.toLowerCase().trim().startsWith(searchTerm)
        )
        .slice(0, 3)
        .map((entry) => entry.word.trim());

      if (suggestions.length > 0) {
        return `Kata "${searchTerm}" tidak ditemukan.\n\nMungkin maksud Anda:\n${suggestions.join(
          "\n"
        )}`;
      } else {
        return `Kata "${searchTerm}" tidak ditemukan dalam KBBI.`;
      }
    }

    // Format the results
    const formattedResults = results.map((entry) => {
      // Decode HTML entities
      let arti = entry.arti
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&amp;/g, "&");

      // Remove HTML tags while preserving important formatting
      arti = arti
        .replace(/<sup>\d+<\/sup>/g, "") // Remove superscript numbers
        .replace(/<b>[^<]+<\/b>/g, "*$&*") // Convert bold tags to asterisks
        .replace(/<i>([^<]+)<\/i>/g, "_$1_") // Convert italic tags to underscores
        .replace(/<[^>]+>/g, ""); // Remove remaining HTML tags

      // Clean up any double spaces and trim
      arti = arti.replace(/\s+/g, " ").trim();

      return arti;
    });

    // Combine results with numbering
    const response = formattedResults
      .map((arti, index) => `${index + 1}. ${arti}`)
      .join("\n\n");

    return `📚 *Definisi KBBI untuk "${searchTerm}"*:\n\n${response}`;
  } catch (error) {
    console.error("Error dalam pencarian KBBI:", error);
    return "Maaf, terjadi kesalahan saat mencari definisi. Silakan coba lagi nanti.";
  }
};

module.exports = handleKbbiCommand;
