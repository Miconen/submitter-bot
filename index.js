require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Routes, REST, AttachmentBuilder, SlashCommandBuilder, InteractionType } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel]
});

const SUBMIT_CHANNEL = '1385624201544601680';   // e.g. '1234567890'
const REVIEW_CHANNEL = '1385623845469163660';   // e.g. '0987654321'

const commands = [
  new SlashCommandBuilder()
    .setName('colostart')
    .setDescription('Submit your starting setup screenshot for the Colosseum event.'),
  new SlashCommandBuilder()
    .setName('coloend')
    .setDescription('Submit your ending setup screenshot for the Colosseum event.'),
  new SlashCommandBuilder()
    .setName('lootmodifiers')
    .setDescription('Submit your loot screenshot and list modifiers.')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Register slash commands
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('✅ Slash commands registered.');
  } catch (err) {
    console.error('❌ Error registering slash commands:', err);
  }
});

// Util for timestamp formatting
function discordTimestamp() {
  const unix = Math.floor(Date.now() / 1000);
  return `<t:${unix}:f>`;
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;
  const userId = interaction.user.id;
  const username = interaction.user.tag;

  const reviewChannel = await client.channels.fetch(REVIEW_CHANNEL);

  // Generic file prompt function
  async function promptForFile(promptText, allowSkip = false) {
    await interaction.reply({
      content: promptText,
      ephemeral: true
    });

    const filter = m => m.author.id === userId;
    const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 60000 });
    const userMessage = collected.first();

    if (!userMessage) {
      return { status: 'timeout' };
    }

    if (allowSkip && userMessage.content.toLowerCase().includes('no loot')) {
      return { status: 'skipped', message: userMessage };
    }

    if (userMessage.attachments.size > 0) {
      return { status: 'file', message: userMessage };
    }

    return { status: 'invalid', message: userMessage };
  }

  if (commandName === 'colostart' || commandName === 'coloend') {
    const prompt = commandName === 'colostart'
      ? '📸 Please upload your starting setup screenshot.'
      : '📸 Please upload your ending setup screenshot.';

    const response = await promptForFile(prompt);
    if (response.status === 'file') {
      const file = response.message.attachments.first().url;
      await reviewChannel.send({
        content: `📥 ${commandName === 'colostart' ? '**Start**' : '**End**'} submission from <@${userId}> (${username})\nSubmitted: ${discordTimestamp()}`,
        files: [file]
      });

      await response.message.delete();
      await interaction.deleteReply();
    } else {
      await interaction.followUp({ content: '❌ Invalid or no file received.', ephemeral: true });
    }
  }

  if (commandName === 'lootmodifiers') {
    const lootResponse = await promptForFile('💰 Please upload your loot screenshot (or type "no loot" to skip):', true);

    let lootFile = null;
    if (lootResponse.status === 'file') {
      lootFile = lootResponse.message.attachments.first().url;
      await lootResponse.message.delete();
    } else if (lootResponse.status === 'skipped') {
      await lootResponse.message.delete();
    } else {
      await interaction.followUp({ content: '❌ Invalid or no file received.', ephemeral: true });
      return;
    }

    // Prompt for modifiers
    await interaction.followUp({ content: '🎯 Please type the list of modifiers used.', ephemeral: true });
    const filter = m => m.author.id === userId;
    const collectedMods = await interaction.channel.awaitMessages({ filter, max: 1, time: 60000 });
    const modMessage = collectedMods.first();

    if (!modMessage) {
      await interaction.followUp({ content: '⏰ Modifier submission timed out.', ephemeral: true });
      return;
    }

    await reviewChannel.send({
      content: `📤 Loot submission from <@${userId}> (${username})\nSubmitted: ${discordTimestamp()}\n\n📝 Modifiers:\n${modMessage.content}`,
      files: lootFile ? [lootFile] : []
    });

    await modMessage.delete();
    await interaction.deleteReply();
  }
});

client.login(process.env.DISCORD_TOKEN);
