import axios from "axios";
import { configDotenv } from "dotenv";
import { PrismaClient } from "../../generated/prisma/index.js";

// Load environment variables
configDotenv();

const prisma = new PrismaClient();

class QuranAuth {
  constructor() {
    this.baseURL = "https://apis.quran.foundation/content/api/v4";
    this.authURL = "https://oauth2.quran.foundation/oauth2/token";
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
    console.log(
      "Requesting new Quran API token (cached token expired or not found)"
    );
    const newToken = await this.requestNewToken();

    return newToken;
  }

  /**
   * Request a new access token from the Quran API
   */
  async requestNewToken() {
    if (!process.env.QURAN_CLIENT_ID || !process.env.QURAN_CLIENT_SECRET) {
      throw new Error(
        "Missing QURAN_CLIENT_ID or QURAN_CLIENT_SECRET in environment variables"
      );
    }

    // Create Basic auth header (client_secret_basic method)
    const credentials = Buffer.from(
      `${process.env.QURAN_CLIENT_ID}:${process.env.QURAN_CLIENT_SECRET}`
    ).toString("base64");

    const data = new URLSearchParams();
    data.append("grant_type", "client_credentials");
    data.append("scope", "content");

    const config = {
      method: "post",
      maxBodyLength: Infinity,
      url: this.authURL,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${credentials}`,
      },
      data: data,
    };

    const response = await axios(config);

    // Quran.com API tokens are valid for 3600 seconds (1 hour) as per documentation
    const expiresIn = response.data.expires_in || 3600; // Use 3600 seconds (1 hour) as default
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Clear old tokens and store the new one
    await prisma.quranApiToken.deleteMany({});

    const savedToken = await prisma.quranApiToken.create({
      data: {
        token: response.data.access_token,
        expiresAt: expiresAt,
      },
    });

    const now = new Date();
    const expiresInMinutes = Math.floor(expiresIn / 60);
    console.log(
      `New Quran API token saved at ${now.toISOString()}, expires in ${expiresInMinutes} minutes (${expiresAt.toISOString()})`
    );

    return savedToken.token;
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
   * Get a random verse with optional filters
   */
  async getRandomVerse(filters = {}) {
    const headers = await this.getHeaders();
    const params = new URLSearchParams();

    // Add filter parameters
    if (filters.chapter) params.append("chapter_number", filters.chapter);
    if (filters.page) params.append("page_number", filters.page);
    if (filters.juz) params.append("juz_number", filters.juz);
    if (filters.hizb) params.append("hizb_number", filters.hizb);
    if (filters.manzil) params.append("manzil_number", filters.manzil);

    // Always include words for Arabic text reconstruction
    params.append("fields", "v2_page,code_v2");
    params.append("words", "true");
    if (filters.language) params.append("language", filters.language);

    const response = await axios.get(`${this.baseURL}/verses/random`, {
      params: Object.fromEntries(params),
      headers: headers,
      maxBodyLength: Infinity,
    });

    return response.data.verse;
  }

  /**
   * Get translation for a specific verse
   */
  async getTranslation(verseKey, translationId) {
    const headers = await this.getHeaders();

    try {
      const response = await axios.get(
        `${this.baseURL}/translations/${translationId}/by_ayah/${verseKey}`,
        {
          headers: headers,
          maxBodyLength: Infinity,
        }
      );

      if (response.data.translations && response.data.translations.length > 0) {
        return response.data.translations[0];
      }
    } catch (error) {
      console.warn(
        `Failed to get translation ${translationId} from main API:`,
        error.message
      );

      // Try prelive endpoint as fallback
      try {
        const response = await axios.get(
          `${this.preliveBaseURL}/translations/${translationId}/by_ayah/${verseKey}`,
          {
            headers: headers,
            maxBodyLength: Infinity,
          }
        );

        if (
          response.data.translations &&
          response.data.translations.length > 0
        ) {
          return response.data.translations[0];
        }
      } catch (preliveError) {
        console.warn(
          `Failed to get translation ${translationId} from prelive API:`,
          preliveError.message
        );
      }
    }

    return null;
  }

  /**
   * Get multiple translations for a specific verse
   */
  async getTranslations(verseKey, translationIds) {
    const translations = [];

    for (const translationId of translationIds.slice(0, 2)) {
      // Limit to 2 translations
      const translation = await this.getTranslation(
        verseKey,
        translationId.trim()
      );
      if (translation) {
        translations.push(translation);
      }
    }

    return translations;
  }

  /**
   * Clean up - close database connection
   */
  async disconnect() {
    await prisma.$disconnect();
  }
}

export default QuranAuth;
