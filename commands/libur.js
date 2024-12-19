const axios = require("axios");

module.exports = async (client, message, args) => {
  try {
    // Ambil bulan dan tahun dari argumen
    const [month, year] = args.split(" ");

    // Validasi bulan dan tahun
    if (!month || !year) {
      return "Mohon masukkan bulan dan tahun yang valid, misalnya: /libur 12 2024";
    }

    // Request ke API untuk mendapatkan data libur
    const response = await axios.get(
      `https://dayoffapi.vercel.app/api?month=${month}&year=${year}`
    );
    const holidays = response.data;

    if (holidays.length === 0) {
      return `Tidak ada hari libur pada bulan ${month} tahun ${year}.`;
    }

    // Format hasil
    const holidayList = holidays
      .map((holiday) => {
        const isCuti = holiday.is_cuti ? "Cuti Bersama" : "Hari Libur";
        return `*${holiday.keterangan}* - Tanggal: ${holiday.tanggal} (${isCuti})`;
      })
      .join("\n");

    return `Hari libur di bulan ${month} tahun ${year}:\n\n${holidayList}`;
  } catch (error) {
    console.error("Error fetching holiday data:", error.message);
    return "Terjadi kesalahan saat mengambil data hari libur.";
  }
};
