const { Client, GatewayIntentBits } = require("discord.js");
const cron = require("node-cron");

// ================= CONFIG =================

const CONFIG = {
  token: process.env.DISCORD_TOKEN,
  guildId: "1471162059461890191",
  leagueInfoChannelId: "1471915310536724603",
  commandChannelId: "1471971618044514437"
};

// ==========================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let currentWeek = null;

client.once("clientReady", () => {

  console.log("Automation bot ready:", client.user.tag);

  // Check every 15 minutes
  cron.schedule("*/15 * * * *", checkLeagueStatus);
});

async function checkLeagueStatus() {
  try {
    const channel = await client.channels.fetch(CONFIG.leagueInfoChannelId);

    const messages = await channel.messages.fetch({ limit: 10 });

    const snallaMessage = messages.find(m =>
      m.author.bot && m.author.username.toLowerCase().includes("snalla")
    );

    if (!snallaMessage) {
      console.log("No Snallabot message found.");
      return;
    }

    // Extract week number from message text
    const match = snallaMessage.content.match(/Week\s*(\d+)/i);
    if (!match) {
      console.log("No week detected.");
      return;
    }

    const detectedWeek = parseInt(match[1]);

    if (currentWeek === null) {
      currentWeek = detectedWeek;
      console.log("Initial week:", currentWeek);
      return;
    }

    if (detectedWeek !== currentWeek)

 {
      console.log(`Week changed: ${currentWeek} → ${detectedWeek}`);
      currentWeek = detectedWeek;

      await runWorkflow();
    }

  } catch (err) {
    console.log("Check error:", err.message);
  }
}

async function runWorkflow() {
  const channel = await client.channels.fetch(CONFIG.commandChannelId);

  console.log("Running advance workflow...");

  await channel.send("/game_channels clear");
  await wait(5000);

  await channel.send("/game_channels create");
  await wait(5000);

  await channel.send("/standings");
  await wait(5000);

  await channel.send("/export current");

  console.log("Workflow complete.");
}

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

client.login(CONFIG.token);
