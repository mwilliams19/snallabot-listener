const { Client, GatewayIntentBits } = require("discord.js");

// ================= CONFIG =================

const CONFIG = {
  token: process.env.DISCORD_TOKEN,
  guildId: "1471162059461890191",
  leagueInfoChannelId: "1471915310536724603",
  commandChannelId: "1471971618044514437",
  adminAlertChannelId: "1472696667643056363"
};

// ==========================================

let workflowRunning = false;
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let currentWeek = null;

//
// BOT READY
//
client.once("clientReady", () => {
  console.log("Automation bot ready:", client.user.tag);
});

//
// PRODUCTION MULTI-TRIGGER DETECTION
//
client.on("messageCreate", async (message) => {
  try {
    // Only watch league info channel
    if (message.channel.id !== CONFIG.leagueInfoChannelId) return;

    // NEW LINE — add this
    if (!message.content) return;

    // Only react to bots
    if (!message.author.bot) return;

    const content = message.content.toLowerCase();

    console.log("Bot message detected:", message.author.username, message.content);

    //
    // =========================
    // PRIMARY TRIGGER
    // League Advance Message
    // =========================
    //
    if (
  content.includes("league has advanced") ||
  content.includes("advanced to week")
) {
  console.log("League advance message detected");

  // Try to extract week number from message
  const weekMatch = message.content.match(/Week\s*(\d+)/i);
  if (weekMatch) {
    currentWeek = parseInt(weekMatch[1]);
    console.log("Week updated from advance message:", currentWeek);
  }

  if (!workflowRunning) {
    workflowRunning = true;
    try {
      await runWorkflow();
    } finally {
      workflowRunning = false;
    }
  }

  return;
}
    //
    // =========================
    // BACKUP TRIGGER
    // Week Change Detection
    // =========================
    //
    const match = message.content.match(/Week\s*(\d+)/i);
    if (!match) return;

    const detectedWeek = parseInt(match[1]);
    console.log("Detected week message:", detectedWeek);

    // First run → set baseline only
    if (currentWeek === null) {
      currentWeek = detectedWeek;
      console.log("Initial week set:", currentWeek);
      return;
    }

    // Week changed → run workflow
    if (detectedWeek !== currentWeek) {
      console.log(`Week changed: ${currentWeek} → ${detectedWeek}`);
      currentWeek = detectedWeek;

      if (!workflowRunning) {
        workflowRunning = true;
        try {
          await runWorkflow();
        } finally {
          workflowRunning = false;
        }
      }
    }

  } catch (err) {
    console.log("Detection error:", err);
  }
});


//
// ADVANCE WORKFLOW
//
async function sendCommandWithRetry(channel, command, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Sending: ${command} (attempt ${attempt})`);

      await channel.send(command);
      await wait(5000);

      return true; // success

    } catch (err) {
      console.log(`Command failed: ${command}`, err.message);

      if (attempt === retries) return false;

      await wait(3000);
    }
  }
}
async function sendAdminAlert(message) {
  try {
    const channel = await client.channels.fetch(CONFIG.adminAlertChannelId);
    await channel.send(`🚨 **Automation Error**\n${message}`);
  } catch (err) {
    console.log("Failed to send admin alert:", err.message);
  }
}
async function sendSuccessMessage() {
  const channel = await client.channels.fetch(CONFIG.commandChannelId);
  await channel.send("✅ **League automation completed successfully.**");
}
//
// PROGRESS MESSAGE SYSTEM
//
async function createProgressMessage() {
  const channel = await client.channels.fetch(CONFIG.commandChannelId);

  return await channel.send(
`🏈 **LEAGUE ADVANCE AUTOMATION**
━━━━━━━━━━━━━━━━━━

⏳ Starting automation...
`
  );
}

async function updateProgress(message, text) {
  await message.edit(
`🏈 **LEAGUE ADVANCE AUTOMATION**
━━━━━━━━━━━━━━━━━━

${text}
`
  );
}

async function runWorkflow() {
  try {
    const channel = await client.channels.fetch(CONFIG.commandChannelId);

    console.log("Running advance workflow...");

    // Create progress dashboard
    const progressMsg = await createProgressMessage();

    //
    // CLEAR CHANNELS
    //
    await updateProgress(progressMsg, "⏳ Clearing old game channels...");
    const clearSuccess = await sendCommandWithRetry(channel, "/game_channels clear");
    if (!clearSuccess) throw new Error("Failed to clear game channels");

    await updateProgress(progressMsg, "✅ Old channels cleared");

    //
    // CREATE CHANNELS
    //
    await updateProgress(progressMsg, `
✅ Old channels cleared
⏳ Creating new game channels...
`);

    const createSuccess = await sendCommandWithRetry(channel, "/game_channels create");
    if (!createSuccess) throw new Error("Failed to create game channels");

    await updateProgress(progressMsg, `
✅ Old channels cleared
✅ New games created
`);

    //
    // POST STANDINGS
    //
    await updateProgress(progressMsg, `
✅ Old channels cleared
✅ New games created
⏳ Posting standings...
`);

    const standingsSuccess = await sendCommandWithRetry(channel, "/standings");
    if (!standingsSuccess) throw new Error("Failed to post standings");

    await updateProgress(progressMsg, `
✅ Old channels cleared
✅ New games created
✅ Standings posted
`);

    //
    // EXPORT
    //
    await updateProgress(progressMsg, `
✅ Old channels cleared
✅ New games created
✅ Standings posted
⏳ Refreshing league export...
`);

    const exportSuccess = await sendCommandWithRetry(channel, "/export current");
    if (!exportSuccess) throw new Error("Failed to run export");

    //
    // COMPLETE
    //
    await updateProgress(progressMsg, `
✅ Old channels cleared
✅ New games created
✅ Standings posted
✅ Export complete

🎉 **League ready for next week!**
`);

    await sendSuccessMessage();

    console.log("Workflow complete.");

  } catch (err) {
    console.log("Workflow error:", err.message);
    await sendAdminAlert(err.message);
  }
}

client.login(CONFIG.token);
