import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import QuranVerses from "../../utility/QuranAPI/Verses.js";

// Chapter name mapping
const chapterNames = {
  1: "Al-Fatiha (الفاتحة)",
  2: "Al-Baqarah (البقرة)",
  3: "Ali 'Imran (آل عمران)",
  4: "An-Nisa (النساء)",
  5: "Al-Ma'idah (المائدة)",
  // ... Add more as needed
};

const data = new SlashCommandBuilder()
  .setName("chapter-verses")
  .setDescription("Get verses from a specific Quran chapter")
  .addIntegerOption((option) =>
    option
      .setName("chapter")
      .setDescription("Chapter number (1-114)")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(114)
  )
  .addIntegerOption((option) =>
    option
      .setName("page")
      .setDescription("Page number for pagination")
      .setRequired(false)
      .setMinValue(1)
  )
  .addIntegerOption((option) =>
    option
      .setName("per_page")
      .setDescription("Number of verses per page (1-10)")
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(10)
  )
  .addBooleanOption((option) =>
    option
      .setName("translations")
      .setDescription("Include English translations")
      .setRequired(false)
  );

async function execute(interaction) {
  await interaction.deferReply();

  const chapterNumber = interaction.options.getInteger("chapter");
  const page = interaction.options.getInteger("page") || 1;
  const perPage = interaction.options.getInteger("per_page") || 5;
  const includeTranslations =
    interaction.options.getBoolean("translations") || false;

  const verses = new QuranVerses();

  try {
    const options = {
      page: page,
      per_page: perPage,
      words: true,
      language: "en",
    };

    if (includeTranslations) {
      options.translations = "20"; // Sahih International
    }

    const response = await verses.getVersesByChapter(chapterNumber, options);

    if (!response.verses || response.verses.length === 0) {
      await interaction.editReply({
        content: `No verses found for chapter ${chapterNumber}, page ${page}.`,
      });
      return;
    }

    // Create embed
    const chapterName =
      chapterNames[chapterNumber] || `Chapter ${chapterNumber}`;
    const embed = new EmbedBuilder()
      .setTitle(`📖 ${chapterName}`)
      .setColor(0x2e8b57)
      .setFooter({
        text: `Page ${response.pagination.current_page} of ${response.pagination.total_pages} • ${response.pagination.total_records} total verses`,
      });

    // Add verses to embed
    let description = "";
    for (const verse of response.verses) {
      const arabicText =
        verse.text_uthmani ||
        verse.text_uthmani_reconstructed ||
        "No Arabic text";

      description += `**${verse.verse_key}**\n`;
      description += `${arabicText}\n`;

      if (
        includeTranslations &&
        verse.translations &&
        verse.translations.length > 0
      ) {
        const translation = verse.translations[0];
        // Clean up HTML tags from translation
        const cleanTranslation = translation.text.replace(/<[^>]*>/g, "");
        description += `*${cleanTranslation}*\n`;
      }

      description += `\n`;

      // Discord embed description limit is 4096 characters
      if (description.length > 3500) {
        description += "... (truncated to fit Discord limit)\n";
        break;
      }
    }

    embed.setDescription(description);

    // Add navigation buttons if there are multiple pages
    const components = [];
    if (response.pagination.total_pages > 1) {
      const row = {
        type: 1, // ACTION_ROW
        components: [],
      };

      if (response.pagination.current_page > 1) {
        row.components.push({
          type: 2, // BUTTON
          style: 2, // SECONDARY
          label: "Previous",
          custom_id: `chapter_prev_${chapterNumber}_${
            page - 1
          }_${perPage}_${includeTranslations}`,
        });
      }

      if (response.pagination.current_page < response.pagination.total_pages) {
        row.components.push({
          type: 2, // BUTTON
          style: 2, // SECONDARY
          label: "Next",
          custom_id: `chapter_next_${chapterNumber}_${
            page + 1
          }_${perPage}_${includeTranslations}`,
        });
      }

      if (row.components.length > 0) {
        components.push(row);
      }
    }

    await interaction.editReply({
      embeds: [embed],
      components: components,
    });
  } catch (error) {
    console.error("Error fetching chapter verses:", error);
    await interaction.editReply({
      content: `Sorry, I couldn't fetch verses from chapter ${chapterNumber}. Please try again later.`,
    });
  } finally {
    await verses.disconnect();
  }
}

export { data, execute };
