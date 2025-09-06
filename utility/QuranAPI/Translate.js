import axios from "axios";
import { configDotenv } from "dotenv";
import { PrismaClient } from "../../generated/prisma/index.js";
import QuranAuth from "./Auth.js";

// Load environment variables
configDotenv();

const prisma = new PrismaClient();
const quranAuth = new QuranAuth();

class QuranTranslations {
  constructor() {
    this.baseURL = "https://apis.quran.foundation/content/api/v4";
    this.preliveBaseURL =
      "https://apis-prelive.quran.foundation/content/api/v4";

    // Common translation resource IDs
    this.popularTranslations = {
      english: {
        sahih: 20, // Sahih International
        pickthall: 19, // Pickthall
        yusufAli: 22, // Yusuf Ali
        clearQuran: 131, // Clear Quran
      },
      urdu: {
        maududi: 97, // Abul Ala Maududi
        junagarhi: 54, // Fateh Muhammad Jalandhri
      },
      arabic: {
        mukhtasar: 169, // Tafseer Al-Mukhtasar
      },
      french: {
        hamidullah: 31, // Muhammad Hamidullah
      },
      spanish: {
        garcia: 83, // Julio Cortes
      },
    };
  }

  /**
   * Get a valid access token, either from cache or by requesting a new one
   */
  async getAccessToken() {
    const minValidityBuffer = 5 * 60 * 1000; // 5 minutes in milliseconds
    const now = new Date();

    const existingToken = await prisma.quranApiToken.findFirst({
      where: {
        expiresAt: {
          gt: new Date(now.getTime() + minValidityBuffer),
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
   * Get translations for a specific Ayah by resource ID and ayah key
   * @param {number} resourceId - Translation resource ID
   * @param {string} ayahKey - Ayah key in format "chapter:verse" (e.g., "1:1")
   * @returns {Promise<Object>} API response containing translations array
   */
  async getTranslationByAyah(resourceId, ayahKey) {
    // Validate inputs
    if (!resourceId || !Number.isInteger(resourceId) || resourceId <= 0) {
      throw new Error("Resource ID must be a positive integer");
    }

    if (!ayahKey || typeof ayahKey !== "string") {
      throw new Error("Ayah key must be a non-empty string");
    }

    const keyPattern = /^\d+:\d+$/;
    if (!keyPattern.test(ayahKey)) {
      throw new Error(
        "Ayah key must be in format 'chapter:verse' (e.g., '1:1', '10:5')"
      );
    }

    const headers = await this.getHeaders();

    try {
      // Try main API first
      const response = await axios.get(
        `${this.baseURL}/translations/${resourceId}/by_ayah/${ayahKey}`,
        {
          headers: headers,
          maxBodyLength: Infinity,
        }
      );

      return response.data;
    } catch (error) {
      console.warn(
        `Failed to get translation ${resourceId} for ${ayahKey} from main API:`,
        error.message
      );

      // Try prelive endpoint as fallback
      try {
        const response = await axios.get(
          `${this.preliveBaseURL}/translations/${resourceId}/by_ayah/${ayahKey}`,
          {
            headers: headers,
            maxBodyLength: Infinity,
          }
        );

        return response.data;
      } catch (preliveError) {
        console.error(
          `Failed to get translation ${resourceId} for ${ayahKey} from prelive API:`,
          preliveError.message
        );

        // Handle specific HTTP errors
        if (preliveError.response) {
          switch (preliveError.response.status) {
            case 404:
              throw new Error(
                `Translation ${resourceId} for ayah ${ayahKey} not found`
              );
            case 400:
              throw new Error(
                `Invalid parameters: resource_id=${resourceId}, ayah_key=${ayahKey}`
              );
            default:
              throw new Error(
                `Failed to fetch translation: ${preliveError.message}`
              );
          }
        }

        throw new Error(
          `Failed to fetch translation ${resourceId} for ${ayahKey}: ${preliveError.message}`
        );
      }
    }
  }

  /**
   * Get multiple translations for a specific Ayah
   * @param {number[]} resourceIds - Array of translation resource IDs
   * @param {string} ayahKey - Ayah key in format "chapter:verse"
   * @returns {Promise<Object[]>} Array of translation responses
   */
  async getMultipleTranslationsByAyah(resourceIds, ayahKey) {
    if (!Array.isArray(resourceIds) || resourceIds.length === 0) {
      throw new Error("Resource IDs must be provided as a non-empty array");
    }

    // Validate all resource IDs
    const invalidIds = resourceIds.filter(
      (id) => !Number.isInteger(id) || id <= 0
    );
    if (invalidIds.length > 0) {
      throw new Error(
        `Invalid resource IDs: ${invalidIds.join(
          ", "
        )}. All IDs must be positive integers`
      );
    }

    // Fetch all translations in parallel
    const translationPromises = resourceIds.map((id) =>
      this.getTranslationByAyah(id, ayahKey).catch((error) => {
        console.warn(
          `Failed to get translation ${id} for ${ayahKey}:`,
          error.message
        );
        return null; // Return null for failed translations
      })
    );

    try {
      const translations = await Promise.all(translationPromises);
      // Filter out null results (failed translations)
      return translations.filter((translation) => translation !== null);
    } catch (error) {
      throw new Error(
        `Failed to fetch multiple translations: ${error.message}`
      );
    }
  }

  /**
   * Get popular translations for a specific Ayah
   * @param {string} ayahKey - Ayah key in format "chapter:verse"
   * @param {string} language - Language preference ('english', 'urdu', 'arabic', etc.)
   * @returns {Promise<Object[]>} Array of popular translation responses
   */
  async getPopularTranslationsByAyah(ayahKey, language = "english") {
    const languageTranslations =
      this.popularTranslations[language.toLowerCase()];

    if (!languageTranslations) {
      throw new Error(
        `Unsupported language: ${language}. Available: ${Object.keys(
          this.popularTranslations
        ).join(", ")}`
      );
    }

    const resourceIds = Object.values(languageTranslations);
    return this.getMultipleTranslationsByAyah(resourceIds, ayahKey);
  }

  /**
   * Get English translations (Sahih International and Clear Quran) for an Ayah
   * @param {string} ayahKey - Ayah key in format "chapter:verse"
   * @returns {Promise<Object[]>} Array of English translation responses
   */
  async getEnglishTranslations(ayahKey) {
    const resourceIds = [
      this.popularTranslations.english.sahih,
      this.popularTranslations.english.clearQuran,
    ];

    return this.getMultipleTranslationsByAyah(resourceIds, ayahKey);
  }

  /**
   * Get simplified translation data for display purposes
   * @param {string} ayahKey - Ayah key in format "chapter:verse"
   * @param {string[]} languages - Array of language preferences
   * @returns {Promise<Object[]>} Simplified translation objects
   */
  async getTranslationsForDisplay(ayahKey, languages = ["english"]) {
    const allTranslations = [];

    for (const language of languages) {
      try {
        const translations = await this.getPopularTranslationsByAyah(
          ayahKey,
          language
        );

        for (const translationResponse of translations) {
          if (
            translationResponse.translations &&
            translationResponse.translations.length > 0
          ) {
            const translation = translationResponse.translations[0];
            allTranslations.push({
              resource_id: translation.resource_id,
              resource_name: translation.resource_name,
              language: translation.language_name,
              text: translation.text,
              verse_key: translation.verse_key,
              chapter_id: translation.chapter_id,
              verse_number: translation.verse_number,
            });
          }
        }
      } catch (error) {
        console.warn(
          `Failed to get ${language} translations for ${ayahKey}:`,
          error.message
        );
      }
    }

    return allTranslations;
  }

  /**
   * Get a single best translation for an Ayah (defaults to Sahih International)
   * @param {string} ayahKey - Ayah key in format "chapter:verse"
   * @param {number} preferredResourceId - Preferred translation resource ID
   * @returns {Promise<Object|null>} Single translation object or null
   */
  async getBestTranslation(ayahKey, preferredResourceId = 20) {
    try {
      const response = await this.getTranslationByAyah(
        preferredResourceId,
        ayahKey
      );

      if (response.translations && response.translations.length > 0) {
        return response.translations[0];
      }
    } catch (error) {
      console.warn(
        `Failed to get preferred translation ${preferredResourceId}, trying fallback:`,
        error.message
      );
    }

    // Fallback to Sahih International if preferred translation fails
    if (preferredResourceId !== 20) {
      try {
        const response = await this.getTranslationByAyah(20, ayahKey);

        if (response.translations && response.translations.length > 0) {
          return response.translations[0];
        }
      } catch (error) {
        console.error("Failed to get fallback translation:", error.message);
      }
    }

    return null;
  }

  /**
   * Get translation resource information
   * @returns {Object} Object containing popular translation resource IDs organized by language
   */
  getPopularTranslationIds() {
    return this.popularTranslations;
  }

  /**
   * Search for translation resources by language
   * @param {string} language - Language to search for
   * @returns {Object|null} Translation resources for the specified language
   */
  getTranslationsByLanguage(language) {
    return this.popularTranslations[language.toLowerCase()] || null;
  }

  /**
   * Clean up - close database connection
   */
  async disconnect() {
    await prisma.$disconnect();
  }
}

export default QuranTranslations;
