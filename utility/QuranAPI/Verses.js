import axios from "axios";
import { configDotenv } from "dotenv";
import { PrismaClient } from "../../generated/prisma/index.js";
import QuranAuth from "./Auth.js";

// Load environment variables
configDotenv();

const prisma = new PrismaClient();
const quranAuth = new QuranAuth();

class QuranVerses {
  constructor() {
    this.baseURL = "https://apis.quran.foundation/content/api/v4";
    this.preliveBaseURL =
      "https://apis-prelive.quran.foundation/content/api/v4";
  }

  /**
   * Get a valid access token, either from cache or by requesting a new one
   */
  async getAccessToken() {
    // Check if we have a valid token in the database
    // We require at least 5 minutes of remaining validity to ensure the token doesn't expire during API calls
    const minValidityBuffer = 5 * 60 * 1000; // 5 minutes in milliseconds
    const now = new Date();

    const existingToken = await prisma.quranApiToken.findFirst({
      where: {
        expiresAt: {
          gt: new Date(now.getTime() + minValidityBuffer), // Token should be valid for at least 5 more minutes
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (existingToken) {
      const remainingMinutes = Math.floor(
        (existingToken.expiresAt.getTime() - now.getTime()) / (60 * 1000)
      );
      console.log(
        `Using cached Quran API token (expires in ${remainingMinutes} minutes)`
      );
      return existingToken.token;
    }

    // Request a new token
    const newToken = await quranAuth.requestNewToken();
    return newToken;
  }

  /**
   * Get headers with authentication
   */
  async getHeaders() {
    const token = await this.getAccessToken();

    return {
      Accept: "application/json",
      "x-auth-token": token,
      "x-client-id": process.env.QURAN_CLIENT_ID,
    };
  }

  /**
   * Reconstruct Arabic text from words array
   * @param {Array} words - Array of word objects from API response
   * @returns {string} Reconstructed Arabic text
   */
  reconstructArabicText(words) {
    if (!words || !Array.isArray(words)) return "";

    return words
      .filter((word) => word.char_type_name === "word")
      .map((word) => word.text)
      .join(" ")
      .trim();
  }

  /**
   * Get list of verses by chapter/surah number
   * @param {number} chapterNumber - Chapter number (1-114)
   * @param {Object} options - Query parameters
   * @param {string} options.language - Language for word translations (default: 'en')
   * @param {boolean} options.words - Include words of each ayah (default: true)
   * @param {string} options.translations - Comma separated translation IDs
   * @param {number} options.audio - Recitation ID for audio
   * @param {string} options.tafsirs - Comma separated tafsir IDs
   * @param {string} options.word_fields - Word-level fields to include
   * @param {string} options.translation_fields - Translation fields to include
   * @param {string} options.fields - Verse-level fields to include (will default to common fields if not provided)
   * @param {number} options.page - Page number for pagination (default: 1)
   * @param {number} options.per_page - Records per page (1-50, default: 10)
   * @returns {Promise<Object>} Response containing verses and pagination info
   */
  async getVersesByChapter(chapterNumber, options = {}) {
    // Validate chapter number
    if (!chapterNumber || chapterNumber < 1 || chapterNumber > 114) {
      throw new Error("Chapter number must be between 1 and 114");
    }

    const headers = await this.getHeaders();
    const params = new URLSearchParams();

    // Set default values and add parameters
    params.append("language", options.language || "en");
    params.append(
      "words",
      options.words !== undefined ? options.words.toString() : "true"
    );
    params.append("page", (options.page || 1).toString());
    params.append("per_page", Math.min(options.per_page || 10, 50).toString());

    // Add common verse fields if not specified
    if (!options.fields) {
      params.append(
        "fields",
        "text_uthmani,text_uthmani_simple,text_imlaei,text_imlaei_simple,text_indopak,text_uthmani_tajweed,chapter_id,verse_number,verse_key,juz_number,hizb_number,rub_el_hizb_number,ruku_number,manzil_number,sajdah_number,page_number"
      );
    } else {
      params.append("fields", options.fields);
    }

    // Add optional parameters if provided
    if (options.translations) {
      params.append("translations", options.translations);
    }
    if (options.audio) {
      params.append("audio", options.audio.toString());
    }
    if (options.tafsirs) {
      params.append("tafsirs", options.tafsirs);
    }
    if (options.word_fields) {
      params.append("word_fields", options.word_fields);
    }
    if (options.translation_fields) {
      params.append("translation_fields", options.translation_fields);
    }

    try {
      // Try main API first
      const response = await axios.get(
        `${this.baseURL}/verses/by_chapter/${chapterNumber}`,
        {
          params: Object.fromEntries(params),
          headers: headers,
          maxBodyLength: Infinity,
        }
      );

      // Process verses to add reconstructed Arabic text if needed
      if (response.data.verses) {
        response.data.verses = response.data.verses.map((verse) => {
          // If Arabic text fields are missing but words are available, reconstruct them
          if (!verse.text_uthmani && verse.words) {
            verse.text_uthmani_reconstructed = this.reconstructArabicText(
              verse.words
            );
          }
          return verse;
        });
      }

      return response.data;
    } catch (error) {
      console.warn(
        `Failed to get verses from main API for chapter ${chapterNumber}:`,
        error.message
      );

      // Try prelive endpoint as fallback
      try {
        const response = await axios.get(
          `${this.preliveBaseURL}/verses/by_chapter/${chapterNumber}`,
          {
            params: Object.fromEntries(params),
            headers: headers,
            maxBodyLength: Infinity,
          }
        );

        // Process verses to add reconstructed Arabic text if needed
        if (response.data.verses) {
          response.data.verses = response.data.verses.map((verse) => {
            // If Arabic text fields are missing but words are available, reconstruct them
            if (!verse.text_uthmani && verse.words) {
              verse.text_uthmani_reconstructed = this.reconstructArabicText(
                verse.words
              );
            }
            return verse;
          });
        }

        return response.data;
      } catch (preliveError) {
        console.error(
          `Failed to get verses from prelive API for chapter ${chapterNumber}:`,
          preliveError.message
        );
        throw new Error(
          `Failed to fetch verses for chapter ${chapterNumber}: ${preliveError.message}`
        );
      }
    }
  }

  /**
   * Get verses by chapter with simplified parameters for common use cases
   * @param {number} chapterNumber - Chapter number (1-114)
   * @param {Object} options - Simplified options
   * @param {boolean} options.includeTranslations - Include popular translations
   * @param {boolean} options.includeAudio - Include audio URLs
   * @param {string} options.language - Language for translations
   * @param {number} options.page - Page number
   * @param {number} options.perPage - Records per page
   * @returns {Promise<Object>} Response with verses
   */
  async getChapterVerses(chapterNumber, options = {}) {
    const apiOptions = {
      language: options.language || "en",
      words: true,
      page: options.page || 1,
      per_page: options.perPage || 10,
    };

    // Add common translations if requested
    if (options.includeTranslations) {
      apiOptions.translations = "20,131"; // English: Sahih International, Urdu: Maududi
    }

    // Add audio if requested
    if (options.includeAudio) {
      apiOptions.audio = 7; // Mishary Rashid Alafasy
    }

    return this.getVersesByChapter(chapterNumber, apiOptions);
  }

  /**
   * Get all verses in a chapter (handles pagination automatically)
   * @param {number} chapterNumber - Chapter number (1-114)
   * @param {Object} options - Options for the API call
   * @returns {Promise<Array>} Array of all verses in the chapter
   */
  async getAllVersesInChapter(chapterNumber, options = {}) {
    const allVerses = [];
    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      const response = await this.getVersesByChapter(chapterNumber, {
        ...options,
        page: currentPage,
        per_page: 50, // Maximum allowed per page
      });

      allVerses.push(...response.verses);

      // Check if there are more pages
      hasMorePages =
        response.pagination &&
        response.pagination.current_page < response.pagination.total_pages;

      currentPage++;
    }

    return allVerses;
  }

  /**
   * Get a specific verse by chapter and verse number
   * @param {number} chapterNumber - Chapter number (1-114)
   * @param {number} verseNumber - Verse number within the chapter
   * @param {Object} options - Options for the API call
   * @returns {Promise<Object|null>} Verse object or null if not found
   */
  async getSpecificVerse(chapterNumber, verseNumber, options = {}) {
    const response = await this.getVersesByChapter(chapterNumber, {
      ...options,
      per_page: 50, // Get more verses to find the specific one
    });

    return (
      response.verses.find((verse) => verse.verse_number === verseNumber) ||
      null
    );
  }

  /**
   * Clean up - close database connection
   */
  async disconnect() {
    await prisma.$disconnect();
  }
}

export default QuranVerses;
