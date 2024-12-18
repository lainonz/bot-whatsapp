const axios = require("axios");
const moment = require("moment"); // Gunakan moment.js untuk manipulasi tanggal dan waktu

const cuacaCommand = async () => {
  const url =
    "https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=32.73.21.1001";

  try {
    const response = await axios.get(url);
    const data = response.data.data;

    // Menampilkan hasil response dari BMKG untuk debug
    console.log("Response dari BMKG:", data);

    // Memeriksa apakah data yang diterima memiliki format yang benar
    if (!data || !Array.isArray(data)) {
      return "Format data cuaca tidak valid.";
    }

    const today = moment().format("YYYY-MM-DD"); // Ambil tanggal hari ini dalam format YYYY-MM-DD

    // Mengambil informasi cuaca dari data
    const rainData = data
      .map((d) => {
        // Cek apakah cuaca adalah array dan memiliki data
        if (d.cuaca && Array.isArray(d.cuaca)) {
          return d.cuaca
            .flat() // Memperhalus array cuaca yang berisi array dalam array
            .map((weather) => {
              // Memeriksa apakah cuaca adalah hujan
              if (
                weather.weather_desc_en &&
                (weather.weather_desc_en.includes("Rain") ||
                  weather.weather_desc.includes("Hujan"))
              ) {
                // Filter cuaca berdasarkan tanggal hari ini
                const weatherDate = moment(weather.datetime).format(
                  "YYYY-MM-DD"
                );
                if (weatherDate === today) {
                  return {
                    waktu: moment(weather.datetime).format("DD-MM-YYYY HH:mm"), // Format waktu yang jelas
                    deskripsi: weather.weather_desc_en,
                    temperatur: weather.t,
                    keterangan: weather.weather_desc,
                  };
                }
                return null;
              }
              return null;
            })
            .filter((weather) => weather !== null); // Menghapus data yang null
        }
        return null;
      })
      .flat() // Memperhalus array hasil map
      .filter((d) => d !== null); // Menghapus data yang null

    if (rainData.length === 0) {
      return "Tidak ada hujan hari ini. Data diambil dari BMKG.";
    }

    let rainMessage = "Hujan di batununggal untuk hari ini:\n";
    rainData.forEach((item) => {
      rainMessage += `Waktu: ${item.waktu}\nTemperatur: ${item.temperatur}°C\nKeterangan: ${item.keterangan}\n\n`;
    });

    rainMessage += "Data di ambil dari BMKG";
    return rainMessage;
  } catch (error) {
    console.error("Error fetching weather data:", error);
    return "Gagal mengambil data cuaca.";
  }
};

module.exports = cuacaCommand;
