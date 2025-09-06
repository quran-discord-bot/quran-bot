import { Events } from "discord.js";
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

export const name = Events.ClientReady;
export const once = true;

export async function execute(client) {
  console.log(`Ready! Logged in as ${client.user.tag}`);

  try {
    // Delete all queue entries on bot startup
    const deletedCount = await prisma.quranQuizQueue.deleteMany({});
    console.log(
      `Cleared ${deletedCount.count} entries from quiz queue on startup`
    );

    // Start scheduled cleanup for old queue entries (every 2 minutes)
    setInterval(async () => {
      try {
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        const deletedOldEntries = await prisma.quranQuizQueue.deleteMany({
          where: {
            createdAt: {
              lt: twoMinutesAgo,
            },
          },
        });

        if (deletedOldEntries.count > 0) {
          console.log(
            `Cleaned up ${deletedOldEntries.count} old queue entries (older than 2 minutes)`
          );
        }
      } catch (cleanupError) {
        console.error(
          "Error during scheduled queue cleanup:",
          cleanupError.message
        );
      } finally {
        await prisma.$disconnect();
      }
    }, 2 * 60 * 1000); // Run every 2 minutes
  } catch (error) {
    console.error("Error during bot startup queue cleanup:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}
