import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import QuranAuth from "../../utility/QuranAPI/Auth.js";
import QuranCanvas from "../../utility/Canvas/QuranCanvas.js";
import { AttachmentBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("random-ayah")
  .setDescription("Get a random verse (ayah) from the Quran")
  .addIntegerOption((option) =>
    option
      .setName("chapter")
      .setDescription("Get random ayah from specific chapter (1-114)")
      .setMinValue(1)
      .setMaxValue(114)
      .setRequired(false)
  )
  .addIntegerOption((option) =>
    option
      .setName("page")
      .setDescription("Get random ayah from specific page (1-604)")
      .setMinValue(1)
      .setMaxValue(604)
      .setRequired(false)
  )
  .addIntegerOption((option) =>
    option
      .setName("juz")
      .setDescription("Get random ayah from specific juz (1-30)")
      .setMinValue(1)
      .setMaxValue(30)
      .setRequired(false)
  )
  .addIntegerOption((option) =>
    option
      .setName("hizb")
      .setDescription("Get random ayah from specific hizb (1-60)")
      .setMinValue(1)
      .setMaxValue(60)
      .setRequired(false)
  )
  .addIntegerOption((option) =>
    option
      .setName("manzil")
      .setDescription("Get random ayah from specific manzil (1-7)")
      .setMinValue(1)
      .setMaxValue(7)
      .setRequired(false)
  )
  .addStringOption((option) =>
    option
      .setName("language")
      .setDescription("Language for translation")
      .setRequired(false)
      .addChoices(
        { name: "English", value: "en" },
        { name: "Arabic", value: "ar" },
        { name: "Indonesian", value: "id" },
        { name: "Urdu", value: "ur" },
        { name: "French", value: "fr" },
        { name: "Spanish", value: "es" },
        { name: "Turkish", value: "tr" },
        { name: "German", value: "de" }
      )
  )
  .addStringOption((option) =>
    option
      .setName("translations")
      .setDescription("Translation IDs (comma separated, e.g. 131,20)")
      .setRequired(false)
  )
  .addBooleanOption((option) =>
    option
      .setName("include-words")
      .setDescription("Include word breakdown")
      .setRequired(false)
  )
  .addBooleanOption((option) =>
    option
      .setName("include-audio")
      .setDescription("Include audio recitation link")
      .setRequired(false)
  );

export async function execute(interaction) {
  const quranAuth = new QuranAuth();
  const canvas = new QuranCanvas();

  try {
    await interaction.deferReply();

    // Get command options
    const chapter = interaction.options.getInteger("chapter");
    const page = interaction.options.getInteger("page");
    const juz = interaction.options.getInteger("juz");
    const hizb = interaction.options.getInteger("hizb");
    const manzil = interaction.options.getInteger("manzil");
    const language = interaction.options.getString("language") || "en";
    const translations = interaction.options.getString("translations") || "131"; // Default to Sahih International
    const includeWords =
      interaction.options.getBoolean("include-words") ?? true;
    const includeAudio =
      interaction.options.getBoolean("include-audio") ?? false;

    // Build filters for random verse
    const filters = {
      language: language,
    };

    if (chapter) filters.chapter = chapter;
    if (page) filters.page = page;
    if (juz) filters.juz = juz;
    if (hizb) filters.hizb = hizb;
    if (manzil) filters.manzil = manzil;

    // Get random verse
    const verse = await quranAuth.getRandomVerse(filters);

    if (!verse) {
      await interaction.editReply("❌ No verse found. Please try again.");
      return;
    }

    // Extract chapter ID from verse_key (e.g., "29:45" -> chapter 29)
    const chapterId = verse.verse_key
      ? parseInt(verse.verse_key.split(":")[0])
      : null;

    // Reconstruct Arabic text from words
    let arabicText = "Text not available";
    if (verse.words && verse.words.length > 0) {
      arabicText = verse.words
        .filter((word) => word.char_type_name === "word")
        .sort((a, b) => a.position - b.position)
        .map((word) => word.text)
        .join(" ");
    }

    const imgAttachment = canvas.createQuranImage({
      glyph: verse.code_v2,
      pages: verse.page_number,
      height: (verse.code_v2.length / 10) * 50 + 150,
    });

    const attachment = new AttachmentBuilder(imgAttachment, {
      name: "quran.png",
    });

    // Get translations if requested
    let translationsData = [];
    if (translations !== "none") {
      const translationIds = translations.split(",").map((id) => id.trim());
      translationsData = await quranAuth.getTranslations(
        verse.verse_key,
        translationIds
      );
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(`📖 Quran ${verse.verse_key}`)
      .setColor(0x00ae86);

    // Add chapter info
    const chapterName = getChapterName(chapterId);
    if (chapterName && chapterId) {
      embed.addFields({
        name: "📚 Chapter",
        value: `${chapterName} (${chapterId})`,
        inline: true,
      });
    }

    embed.addFields({
      name: "📍 Location",
      value: `Juz ${verse.juz_number} • Page ${verse.page_number}`,
      inline: true,
    });

    // Add translations if available
    if (translationsData.length > 0) {
      for (const translation of translationsData) {
        embed.addFields({
          name: `🌍 Translation${
            translation.resource_name ? ` (${translation.resource_name})` : ""
          }`,
          value: translation.text.replace(/<[^>]*>/g, ""), // Remove HTML tags
          inline: false,
        });
      }
    }

    // Add audio if requested
    if (includeAudio) {
      embed.addFields({
        name: "🔊 Audio Recitation",
        value: `[Listen on Quran.com](https://quran.com/${verse.verse_key})`,
        inline: false,
      });
    }

    // Add footer with additional info
    embed.setFooter({
      text: `Hizb ${verse.hizb_number} • Rub ${verse.rub_el_hizb_number} • Verse ${verse.verse_number}`,
    });

    await interaction.editReply({ embeds: [embed], files: [attachment] });
  } catch (error) {
    console.error("Error fetching random ayah:", error);

    let errorMessage =
      "❌ Failed to fetch random ayah. Please try again later.";

    if (error.response) {
      switch (error.response.status) {
        case 400:
          errorMessage = "❌ Invalid parameters provided.";
          break;
        case 401:
          errorMessage =
            "❌ Authentication failed. Please check API credentials.";
          break;
        case 429:
          errorMessage = "❌ Rate limit exceeded. Please try again later.";
          break;
        case 500:
          errorMessage =
            "❌ Quran.com API server error. Please try again later.";
          break;
      }
    }

    await interaction.editReply(errorMessage);
  } finally {
    // Clean up database connection
    await quranAuth.disconnect();
  }
}

// Helper function to get chapter names
function getChapterName(chapterId) {
  const chapterNames = {
    1: "Al-Fatihah",
    2: "Al-Baqarah",
    3: "Ali 'Imran",
    4: "An-Nisa",
    5: "Al-Ma'idah",
    6: "Al-An'am",
    7: "Al-A'raf",
    8: "Al-Anfal",
    9: "At-Tawbah",
    10: "Yunus",
    11: "Hud",
    12: "Yusuf",
    13: "Ar-Ra'd",
    14: "Ibrahim",
    15: "Al-Hijr",
    16: "An-Nahl",
    17: "Al-Isra",
    18: "Al-Kahf",
    19: "Maryam",
    20: "Taha",
    21: "Al-Anbya",
    22: "Al-Hajj",
    23: "Al-Mu'minun",
    24: "An-Nur",
    25: "Al-Furqan",
    26: "Ash-Shu'ara",
    27: "An-Naml",
    28: "Al-Qasas",
    29: "Al-'Ankabut",
    30: "Ar-Rum",
    31: "Luqman",
    32: "As-Sajdah",
    33: "Al-Ahzab",
    34: "Saba",
    35: "Fatir",
    36: "Ya-Sin",
    37: "As-Saffat",
    38: "Sad",
    39: "Az-Zumar",
    40: "Ghafir",
    41: "Fussilat",
    42: "Ash-Shuraa",
    43: "Az-Zukhruf",
    44: "Ad-Dukhan",
    45: "Al-Jathiyah",
    46: "Al-Ahqaf",
    47: "Muhammad",
    48: "Al-Fath",
    49: "Al-Hujurat",
    50: "Qaf",
    51: "Adh-Dhariyat",
    52: "At-Tur",
    53: "An-Najm",
    54: "Al-Qamar",
    55: "Ar-Rahman",
    56: "Al-Waqi'ah",
    57: "Al-Hadid",
    58: "Al-Mujadila",
    59: "Al-Hashr",
    60: "Al-Mumtahanah",
    61: "As-Saff",
    62: "Al-Jumu'ah",
    63: "Al-Munafiqun",
    64: "At-Taghabun",
    65: "At-Talaq",
    66: "At-Tahrim",
    67: "Al-Mulk",
    68: "Al-Qalam",
    69: "Al-Haqqah",
    70: "Al-Ma'arij",
    71: "Nuh",
    72: "Al-Jinn",
    73: "Al-Muzzammil",
    74: "Al-Muddaththir",
    75: "Al-Qiyamah",
    76: "Al-Insan",
    77: "Al-Mursalat",
    78: "An-Naba",
    79: "An-Nazi'at",
    80: "'Abasa",
    81: "At-Takwir",
    82: "Al-Infitar",
    83: "Al-Mutaffifin",
    84: "Al-Inshiqaq",
    85: "Al-Buruj",
    86: "At-Tariq",
    87: "Al-A'la",
    88: "Al-Ghashiyah",
    89: "Al-Fajr",
    90: "Al-Balad",
    91: "Ash-Shams",
    92: "Al-Layl",
    93: "Ad-Duhaa",
    94: "Ash-Sharh",
    95: "At-Tin",
    96: "Al-'Alaq",
    97: "Al-Qadr",
    98: "Al-Bayyinah",
    99: "Az-Zalzalah",
    100: "Al-'Adiyat",
    101: "Al-Qari'ah",
    102: "At-Takathur",
    103: "Al-'Asr",
    104: "Al-Humazah",
    105: "Al-Fil",
    106: "Quraysh",
    107: "Al-Ma'un",
    108: "Al-Kawthar",
    109: "Al-Kafirun",
    110: "An-Nasr",
    111: "Al-Masad",
    112: "Al-Ikhlas",
    113: "Al-Falaq",
    114: "An-Nas",
  };

  return chapterNames[chapterId] || null;
}
