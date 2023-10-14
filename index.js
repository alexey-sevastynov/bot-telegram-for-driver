const TelegramBot = require("node-telegram-bot-api");
const mongoose = require("mongoose");
const schedule = require("node-schedule");
require("dotenv").config();

const sentNotifications = new Set();

const token = process.env.TOKEN;
const chatID = process.env.CHAT_ID;
const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/echo (.+)/, (msg, match) => {
  const resp = match[1];
  bot.sendMessage(chatID, resp);
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  bot.sendMessage(chatId, "Received your message");

  if (text === "/start") {
    await bot.sendMessage(chatID, `Hello ${msg.from.first_name}!`);
  }
});

mongoose
  .connect(process.env["MONGODB_URI"], { useNewUrlParser: true })
  .then((client) => {
    console.log("DB OK!");

    const db = client.connection;
    const collection = db.collection("events");

    const runScheduledTask = schedule.scheduleJob("*/1 * * * *", async () => {
      const utcTime = new Date();
      const localTime = new Date(
        utcTime.toLocaleString("en-US", { timeZone: "Europe/Kiev" })
      );
      localTime.setMinutes(localTime.getMinutes() + 60); // One hour ahead

      console.log("Local Time:", localTime);

      const events = await collection
        .find({ dateStart: { $gte: localTime } })
        // .find({ dateStart: { $lte: localTime } })
        .toArray();

      console.log("Events:", events);

      for (const event of events) {
        const localTimeWithoutTime = new Date(
          localTime.getFullYear(),
          localTime.getMonth(),
          localTime.getDate()
        );
        const eventTimeWithoutTime = new Date(
          event.dateStart.getFullYear(),
          event.dateStart.getMonth(),
          event.dateStart.getDate()
        );

        if (event.dateStart.getTime() === localTime.getTime()) {
          // Проверьте, было ли уже отправлено уведомление для этого события
          if (!sentNotifications.has(event._id.toString())) {
            const message = `Text test: - ${event.title}, ${event.dateStart}`;
            bot.sendMessage(chatID, message);
            sentNotifications.add(event._id.toString());
          }
        }
      }
    });
  })
  .catch((err) => console.log("DB error:", err));
