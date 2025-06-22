require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel]
});

const SUBMIT_CHANNEL = '1385624201544601680';
const REVIEW_CHANNEL = '1385623845469163660';

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (
    message.channel.id === SUBMIT_CHANNEL &&
    !message.author.bot &&
    message.attachments.size > 0
  ) {
    const reviewChannel = await client.channels.fetch(REVIEW_CHANNEL);
    const attachment = message.attachments.first();

    await reviewChannel.send({
      content: `📸 New submission from <@${message.author.id}>:
${message.content || ''}`,
      files: [attachment.url]
    });

    await message.delete();
  }
});

client.login(process.env.DISCORD_TOKEN);
