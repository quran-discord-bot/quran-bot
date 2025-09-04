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
   * Get a random verse from the Quran
   * @param {Object} options - Query parameters for filtering and options
   * @param {number} options.chapter_number - Return random verse only from specified chapter (1-114)
   * @param {number} options.page_number - Return random verse only from specified page (1-604)
   * @param {number} options.juz_number - Return random verse only from specified juz (1-30)
   * @param {number} options.hizb_number - Return random verse only from specified hizb (1-60)
   * @param {number} options.rub_el_hizb_number - Return random verse only from specified rub el hizb (1-240)
   * @param {number} options.ruku_number - Return random verse only from specified ruku
   * @param {number} options.manzil_number - Return random verse only from specified manzil (1-7)
   * @param {string} options.language - Language for word translations (default: 'en')
   * @param {boolean|string} options.words - Include words of each ayah (default: true)
   * @param {string} options.translations - Comma separated translation IDs
   * @param {number} options.audio - Recitation ID for audio
   * @param {string} options.tafsirs - Comma separated tafsir IDs
   * @param {string} options.word_fields - Word-level fields to include
   * @param {string} options.translation_fields - Translation fields to include
   * @param {string} options.fields - Verse-level fields to include
   * @returns {Promise<Object>} Random verse object
   */
  async getRandomVerse(options = {}) {
    const headers = await this.getHeaders();
    const params = new URLSearchParams();

    // Set default values
    params.append("language", options.language || "en");
    params.append(
      "words",
      options.words !== undefined ? options.words.toString() : "true"
    );

    // Add filtering parameters if provided
    if (options.chapter_number) {
      if (options.chapter_number < 1 || options.chapter_number > 114) {
        throw new Error("Chapter number must be between 1 and 114");
      }
      params.append("chapter_number", options.chapter_number.toString());
    }

    if (options.page_number) {
      if (options.page_number < 1 || options.page_number > 604) {
        throw new Error("Page number must be between 1 and 604");
      }
      params.append("page_number", options.page_number.toString());
    }

    if (options.juz_number) {
      if (options.juz_number < 1 || options.juz_number > 30) {
        throw new Error("Juz number must be between 1 and 30");
      }
      params.append("juz_number", options.juz_number.toString());
    }

    if (options.hizb_number) {
      if (options.hizb_number < 1 || options.hizb_number > 60) {
        throw new Error("Hizb number must be between 1 and 60");
      }
      params.append("hizb_number", options.hizb_number.toString());
    }

    if (options.rub_el_hizb_number) {
      if (options.rub_el_hizb_number < 1 || options.rub_el_hizb_number > 240) {
        throw new Error("Rub el Hizb number must be between 1 and 240");
      }
      params.append(
        "rub_el_hizb_number",
        options.rub_el_hizb_number.toString()
      );
    }

    if (options.ruku_number) {
      if (options.ruku_number < 1) {
        throw new Error("Ruku number must be greater than 0");
      }
      params.append("ruku_number", options.ruku_number.toString());
    }

    if (options.manzil_number) {
      if (options.manzil_number < 1 || options.manzil_number > 7) {
        throw new Error("Manzil number must be between 1 and 7");
      }
      params.append("manzil_number", options.manzil_number.toString());
    }

    // Add optional content parameters
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

    // Add verse fields - use comprehensive set if not specified
    if (!options.fields) {
      params.append(
        "fields",
        "text_uthmani,text_uthmani_simple,text_imlaei,text_imlaei_simple,text_indopak,text_uthmani_tajweed,chapter_id,verse_number,verse_key,juz_number,hizb_number,rub_el_hizb_number,ruku_number,manzil_number,sajdah_number,page_number,code_v1,code_v2,v1_page,v2_page"
      );
    } else {
      params.append("fields", options.fields);
    }

    try {
      // Try main API first
      const response = await axios.get(`${this.baseURL}/verses/random`, {
        params: Object.fromEntries(params),
        headers: headers,
        maxBodyLength: Infinity,
      });

      // Process the verse to add reconstructed Arabic text if needed
      if (response.data.verse) {
        const verse = response.data.verse;

        // If Arabic text fields are missing but words are available, reconstruct them
        if (!verse.text_uthmani && verse.words) {
          verse.text_uthmani_reconstructed = this.reconstructArabicText(
            verse.words
          );
        }

        return verse;
      }

      return response.data.verse;
    } catch (error) {
      console.warn("Failed to get random verse from main API:", error.message);

      // Try prelive endpoint as fallback
      try {
        const response = await axios.get(
          `${this.preliveBaseURL}/verses/random`,
          {
            params: Object.fromEntries(params),
            headers: headers,
            maxBodyLength: Infinity,
          }
        );

        // Process the verse to add reconstructed Arabic text if needed
        if (response.data.verse) {
          const verse = response.data.verse;

          // If Arabic text fields are missing but words are available, reconstruct them
          if (!verse.text_uthmani && verse.words) {
            verse.text_uthmani_reconstructed = this.reconstructArabicText(
              verse.words
            );
          }

          return verse;
        }

        return response.data.verse;
      } catch (preliveError) {
        console.error(
          "Failed to get random verse from prelive API:",
          preliveError.message
        );
        throw new Error(
          `Failed to fetch random verse: ${preliveError.message}`
        );
      }
    }
  }

  /**
   * Get a specific verse by its key (chapter:verse format)
   * @param {string} verseKey - Verse key in format "chapter:verse" (e.g., "1:1", "10:5")
   * @param {Object} options - Query parameters
   * @param {string} options.language - Language for word translations (default: 'en')
   * @param {boolean|string} options.words - Include words of each ayah (default: true)
   * @param {string} options.translations - Comma separated translation IDs
   * @param {number} options.audio - Recitation ID for audio
   * @param {string} options.tafsirs - Comma separated tafsir IDs
   * @param {string} options.word_fields - Word-level fields to include
   * @param {string} options.translation_fields - Translation fields to include
   * @param {string} options.fields - Verse-level fields to include
   * @returns {Promise<Object>} Verse object with complete information
   */
  async getVerseByKey(verseKey, options = {}) {
    // Validate verse key format
    if (!verseKey || typeof verseKey !== "string") {
      throw new Error("Verse key must be a non-empty string");
    }

    const keyPattern = /^\d+:\d+$/;
    if (!keyPattern.test(verseKey)) {
      throw new Error(
        "Verse key must be in format 'chapter:verse' (e.g., '1:1', '10:5')"
      );
    }

    // Parse and validate chapter and verse numbers
    const [chapterStr, verseStr] = verseKey.split(":");
    const chapterNumber = parseInt(chapterStr, 10);
    const verseNumber = parseInt(verseStr, 10);

    if (chapterNumber < 1 || chapterNumber > 114) {
      throw new Error("Chapter number must be between 1 and 114");
    }

    if (verseNumber < 1) {
      throw new Error("Verse number must be greater than 0");
    }

    const headers = await this.getHeaders();
    const params = new URLSearchParams();

    // Set default values
    params.append("language", options.language || "en");
    params.append(
      "words",
      options.words !== undefined ? options.words.toString() : "true"
    );

    // Add optional content parameters
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

    // Add verse fields - use comprehensive set if not specified
    if (!options.fields) {
      params.append(
        "fields",
        "text_uthmani,text_uthmani_simple,text_imlaei,text_imlaei_simple,text_indopak,text_uthmani_tajweed,chapter_id,verse_number,verse_key,juz_number,hizb_number,rub_el_hizb_number,ruku_number,manzil_number,sajdah_number,page_number,code_v1,code_v2,v1_page,v2_page"
      );
    } else {
      params.append("fields", options.fields);
    }

    try {
      // Try main API first
      const response = await axios.get(
        `${this.baseURL}/verses/by_key/${verseKey}`,
        {
          params: Object.fromEntries(params),
          headers: headers,
          maxBodyLength: Infinity,
        }
      );

      // Process the verse to add reconstructed Arabic text if needed
      if (response.data.verse) {
        const verse = response.data.verse;

        // If Arabic text fields are missing but words are available, reconstruct them
        if (!verse.text_uthmani && verse.words) {
          verse.text_uthmani_reconstructed = this.reconstructArabicText(
            verse.words
          );
        }

        return verse;
      }

      return response.data.verse;
    } catch (error) {
      console.warn(
        `Failed to get verse ${verseKey} from main API:`,
        error.message
      );

      // Try prelive endpoint as fallback
      try {
        const response = await axios.get(
          `${this.preliveBaseURL}/verses/by_key/${verseKey}`,
          {
            params: Object.fromEntries(params),
            headers: headers,
            maxBodyLength: Infinity,
          }
        );

        // Process the verse to add reconstructed Arabic text if needed
        if (response.data.verse) {
          const verse = response.data.verse;

          // If Arabic text fields are missing but words are available, reconstruct them
          if (!verse.text_uthmani && verse.words) {
            verse.text_uthmani_reconstructed = this.reconstructArabicText(
              verse.words
            );
          }

          return verse;
        }

        return response.data.verse;
      } catch (preliveError) {
        console.error(
          `Failed to get verse ${verseKey} from prelive API:`,
          preliveError.message
        );

        // Handle specific HTTP errors
        if (preliveError.response) {
          switch (preliveError.response.status) {
            case 404:
              throw new Error(
                `Verse ${verseKey} not found. Please check the chapter and verse numbers.`
              );
            case 400:
              throw new Error(`Invalid verse key format: ${verseKey}`);
            default:
              throw new Error(
                `Failed to fetch verse ${verseKey}: ${preliveError.message}`
              );
          }
        }

        throw new Error(
          `Failed to fetch verse ${verseKey}: ${preliveError.message}`
        );
      }
    }
  }

  /**
   * Get verse by key with simplified parameters for common use cases
   * @param {string} verseKey - Verse key in format "chapter:verse"
   * @param {Object} options - Simplified options
   * @param {boolean} options.includeTranslations - Include popular translations
   * @param {boolean} options.includeAudio - Include audio URLs
   * @param {string} options.language - Language for translations
   * @returns {Promise<Object>} Verse object
   */
  async getVerseByKeySimple(verseKey, options = {}) {
    const apiOptions = {
      language: options.language || "en",
      words: true,
    };

    // Add common translations if requested
    if (options.includeTranslations) {
      apiOptions.translations = "20,131"; // English: Sahih International, Urdu: Maududi
    }

    // Add audio if requested
    if (options.includeAudio) {
      apiOptions.audio = 7; // Mishary Rashid Alafasy
    }

    return this.getVerseByKey(verseKey, apiOptions);
  }

  /**
   * Clean up - close database connection
   */
  async disconnect() {
    await prisma.$disconnect();
  }
}

export default QuranVerses;
