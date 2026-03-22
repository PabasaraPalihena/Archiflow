// backend/jobs/priceScheduler.js
//
// Sets up a daily cron job to fetch cloud pricing updates.
// Call initPriceScheduler() once after the server starts.

const cron = require("node-cron");
const { updatePrices } = require("./priceFetcher");

/**
 * Initializes the daily price update cron job.
 * Runs at 3:00 AM every day.
 */
function initPriceScheduler() {
  cron.schedule("0 3 * * *", async () => {
    console.log("[PriceScheduler] Starting daily price update...");
    try {
      const summary = await updatePrices();
      console.log("[PriceScheduler] Price update complete:", summary);
    } catch (err) {
      console.error("[PriceScheduler] Price update failed:", err.message);
    }
  });

  console.log("[PriceScheduler] Scheduled daily price update at 3:00 AM");
}

module.exports = { initPriceScheduler, updatePrices };
