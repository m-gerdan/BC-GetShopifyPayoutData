require("dotenv").config();
const axios = require("axios");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const readline = require("readline");

const STORE_TOKENS = {
  18095537: process.env.STORE_TOKENS_18095537,
  61415948532: process.env.STORE_TOKENS_61415948532,
  54974709840: process.env.STORE_TOKENS_54974709840,
  61385539641: process.env.STORE_TOKENS_61385539641,
  40972517539: process.env.STORE_TOKENS_40972517539,
  59990835359: process.env.STORE_TOKENS_59990835359,
};

const STORE_URLS = {
  18095537: process.env.STORE_URLS_18095537,
  61415948532: process.env.STORE_URLS_61415948532,
  54974709840: process.env.STORE_URLS_54974709840,
  61385539641: process.env.STORE_URLS_61385539641,
  40972517539: process.env.STORE_URLS_40972517539,
  59990835359: process.env.STORE_URLS_59990835359,
};

// Adjust CSV headers based on the data fields
function createCsvWriterWithHeaders(filePath) {
  return createCsvWriter({
    path: "out/" + filePath,
    header: [
      { id: "payout_id", title: "PAYOUT_ID" },
      { id: "payout_date", title: "PAYOUT_DATE" },
      { id: "order_id", title: "ORDER_ID" },
      { id: "transaction_id", title: "TRANSACTION_ID" },
      { id: "currency", title: "CURRENCY" },
      { id: "amount", title: "AMOUNT" },
      { id: "fee", title: "FEE" },
      { id: "net", title: "NET" },
      // ... other headers as needed
    ],
  });
}

//6928162652319

// Function to get Payouts for a time period
async function getPayouts(storeUrl, accessToken, startDate, endDate) {
  try {
    const response = await axios.get(
      `https://${storeUrl}.myshopify.com/admin/api/2023-04/shopify_payments/payouts.json?date_min=${startDate}&date_max=${endDate}`,
      {
        headers: {
          "X-Shopify-Access-Token": accessToken,
        },
      }
    );
    return response.data.payouts.map((p) => ({ id: p.id, date: p.date }));
  } catch (error) {
    console.error("Error fetching payouts:", error);
    return null;
  }
}

// Function to get transactions for a payout ID
async function getTransactions(storeUrl, accessToken, payoutId) {
  try {
    const response = await axios.get(
      `https://${storeUrl}.myshopify.com/admin/api/2023-04/shopify_payments/balance/transactions.json?payout_id=${payoutId}`,
      {
        headers: {
          "X-Shopify-Access-Token": accessToken,
        },
      }
    );
    return response.data.transactions;
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return null;
  }
}

// Function to process transactions and write to CSV
async function processPayout(storeUrl, accessToken, payout, existingRecords) {
  const transactions = await getTransactions(storeUrl, accessToken, payout.id);
  if (transactions) {
    existingRecords = existingRecords.concat(
      transactions
        .map((t) => ({
          payout_id: payout.id,
          payout_date: payout.date,
          order_id: t.source_order_id,
          transaction_id: t.source_order_transaction_id,
          currency: t.currency,
          amount: t.amount,
          fee: t.fee,
          net: t.net,
          // ... other data fields
        }))
        .filter((l) => l.transaction_id)
    );
    // await csvWriter.writeRecords(records);
    console.log(
      `Payout ${payout.id} contained ${transactions.length} transactions`
    );
  }
  return existingRecords;
}

async function persistRecords(records, csvWriter) {
  console.log(`Preparing to write ${records.length} lines`);
  await csvWriter.writeRecords(records);
  console.log("CSV updated!");
}

// CLI setup
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Enter Store ID: ", (storeId) => {
  const storeUrl = STORE_URLS[storeId];
  const accessToken = STORE_TOKENS[storeId];

  if (!storeUrl || !accessToken) {
    console.error("Invalid Store ID");
    rl.close();
    return;
  }

  rl.question("Enter Start Date (YYYY-MM-DD): ", (startDate) => {
    rl.question("Enter End Date (YYYY-MM-DD): ", async (endDate) => {
      const filePath = `${storeId}_${startDate}_to_${endDate}.csv`;
      const csvWriter = createCsvWriterWithHeaders(filePath);
      const payouts = await getPayouts(
        storeUrl,
        accessToken,
        startDate,
        endDate
      );
      if (payouts) {
        console.log(
          `${payouts.length} is the number of payouts between ${startDate} and ${endDate}`
        );

        let records = [];

        for (const payout of payouts) {
          records = await processPayout(storeUrl, accessToken, payout, records);
        }
        persistRecords(records, csvWriter);
      }
      rl.close();
    });
  });
});
