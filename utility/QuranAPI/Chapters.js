import axios from "axios";
import { configDotenv } from "dotenv";
import { PrismaClient } from "../../generated/prisma/index.js";
import QuranAuth from "./Auth.js";

// Load environment variables
configDotenv();

const prisma = new PrismaClient();
const quranAuth = new QuranAuth();

class QuranChapters {
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
   * Get details of a single chapter
   * @param {number} chapterId - Chapter ID (1-114)
   * @param {Object} options - Query parameters
   * @param {string} options.language - Language for chapter names and descriptions (default: 'en')
   * @returns {Promise<Object>} API response containing chapter object with the following structure:
   * - chapter.id: Chapter number (1-114)
   * - chapter.revelation_place: Where the chapter was revealed (makkah/madinah)
   * - chapter.revelation_order: Order of revelation (1-114)
   * - chapter.bismillah_pre: Whether Bismillah precedes this chapter
   * - chapter.name_complex: Chapter name in complex Arabic script
   * - chapter.name_arabic: Chapter name in simple Arabic
   * - chapter.verses_count: Number of verses in the chapter
   * - chapter.pages: Array of Mushaf page numbers
   * - chapter.translated_name: Object with language_name and name fields
   */
  async getChapter(chapterId, options = {}) {
    // Validate chapter ID
    if (!chapterId || chapterId < 1 || chapterId > 114) {
      throw new Error("Chapter ID must be between 1 and 114");
    }

    const headers = await this.getHeaders();
    const params = new URLSearchParams();

    // Set default language
    params.append("language", options.language || "en");

    try {
      // Try main API first
      const response = await axios.get(
        `${this.baseURL}/chapters/${chapterId}`,
        {
          params: Object.fromEntries(params),
          headers: headers,
          maxBodyLength: Infinity,
        }
      );

      return response.data;
    } catch (error) {
      console.warn(
        `Failed to get chapter ${chapterId} from main API:`,
        error.message
      );

      // Try prelive endpoint as fallback
      try {
        const response = await axios.get(
          `${this.preliveBaseURL}/chapters/${chapterId}`,
          {
            params: Object.fromEntries(params),
            headers: headers,
            maxBodyLength: Infinity,
          }
        );

        return response.data;
      } catch (preliveError) {
        console.error(
          `Failed to get chapter ${chapterId} from prelive API:`,
          preliveError.message
        );
        throw new Error(
          `Failed to fetch chapter ${chapterId}: ${preliveError.message}`
        );
      }
    }
  }

  /**
   * Get chapter details with simplified parameters for common use cases
   * @param {number} chapterId - Chapter ID (1-114)
   * @param {string} language - Language for chapter names (default: 'en')
   * @returns {Promise<Object>} API response with chapter object
   */
  async getChapterInfo(chapterId, language = "en") {
    return this.getChapter(chapterId, { language });
  }

  /**
   * Extract just the chapter object from the API response
   * @param {number} chapterId - Chapter ID (1-114)
   * @param {Object} options - Query parameters
   * @returns {Promise<Object>} Chapter object only (without wrapper)
   */
  async getChapterData(chapterId, options = {}) {
    const response = await this.getChapter(chapterId, options);
    return response.chapter;
  }

  /**
   * Get formatted chapter information for display purposes
   * @param {number} chapterId - Chapter ID (1-114)
   * @param {string} language - Language for translated name (default: 'en')
   * @returns {Promise<Object>} Formatted chapter info with commonly used fields
   */
  async getChapterForDisplay(chapterId, language = "en") {
    const response = await this.getChapter(chapterId, { language });
    const chapter = response.chapter;

    return {
      id: chapter.id,
      name_arabic: chapter.name_arabic,
      name_complex: chapter.name_complex,
      translated_name: chapter.translated_name?.name || "Unknown",
      verses_count: chapter.verses_count,
      revelation_place: chapter.revelation_place,
      revelation_order: chapter.revelation_order,
      bismillah_pre: chapter.bismillah_pre,
      pages: chapter.pages || [],
      page_range:
        chapter.pages && chapter.pages.length > 0
          ? `${Math.min(...chapter.pages)}-${Math.max(...chapter.pages)}`
          : "Unknown",
    };
  }

  /**
   * Get multiple chapters by their IDs
   * @param {number[]} chapterIds - Array of chapter IDs (1-114)
   * @param {Object} options - Query parameters
   * @param {string} options.language - Language for chapter names (default: 'en')
   * @returns {Promise<Object[]>} Array of API responses containing chapter objects
   */
  async getMultipleChapters(chapterIds, options = {}) {
    if (!Array.isArray(chapterIds) || chapterIds.length === 0) {
      throw new Error("Chapter IDs must be provided as a non-empty array");
    }

    // Validate all chapter IDs
    const invalidIds = chapterIds.filter((id) => !id || id < 1 || id > 114);
    if (invalidIds.length > 0) {
      throw new Error(
        `Invalid chapter IDs: ${invalidIds.join(
          ", "
        )}. All IDs must be between 1 and 114`
      );
    }

    // Fetch all chapters in parallel
    const chapterPromises = chapterIds.map((id) =>
      this.getChapter(id, options)
    );

    try {
      const chapters = await Promise.all(chapterPromises);
      return chapters;
    } catch (error) {
      throw new Error(`Failed to fetch multiple chapters: ${error.message}`);
    }
  }

  /**
   * Get multiple chapters and return only the chapter data (without API wrapper)
   * @param {number[]} chapterIds - Array of chapter IDs (1-114)
   * @param {Object} options - Query parameters
   * @returns {Promise<Object[]>} Array of chapter objects
   */
  async getMultipleChapterData(chapterIds, options = {}) {
    const responses = await this.getMultipleChapters(chapterIds, options);
    return responses.map((response) => response.chapter);
  }

  /**
   * Get basic chapter statistics and info
   * @param {number} chapterId - Chapter ID (1-114)
   * @returns {Promise<Object>} Chapter statistics object
   */
  async getChapterStats(chapterId) {
    const response = await this.getChapter(chapterId, { language: "en" });
    const chapter = response.chapter;

    return {
      id: chapter.id,
      verses_count: chapter.verses_count,
      revelation_place: chapter.revelation_place,
      revelation_order: chapter.revelation_order,
      has_bismillah: chapter.bismillah_pre,
      page_count: chapter.pages ? chapter.pages.length : 0,
      first_page:
        chapter.pages && chapter.pages.length > 0
          ? Math.min(...chapter.pages)
          : null,
      last_page:
        chapter.pages && chapter.pages.length > 0
          ? Math.max(...chapter.pages)
          : null,
    };
  }

  /**
   * Clean up - close database connection
   */
  async disconnect() {
    await prisma.$disconnect();
  }
}

export default QuranChapters;
