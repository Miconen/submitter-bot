require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  Routes,
  REST,
  SlashCommandBuilder,
  InteractionType,
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel],
});

const SUBMIT_CHANNEL = '1385624201544601680';
const REVIEW_CHANNEL = '1385623845469163660';

const commands = [
  new SlashCommandBuilder()
    .setName('colostart')
    .setDescription('Submit your starting setup screenshot for the Colosseum event.')
    .addAttachmentOption(option =>
      option.setName('screenshot').setDescription('Upload your starting setup screenshot.').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('coloend')
    .setDescription('Submit your ending setup screenshot for the Colosseum event.')
    .addAttachmentOption(option =>
      option.setName('screenshot').setDescription('Upload your ending setup screenshot.').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('lootmodifiers')
    .setDescription('Submit your modifiers screenshot, optional loot screenshot, and optional notes.')
    .addAttachmentOption(option =>
      option.setName('modifiers').setDescription('Upload your modifiers screenshot.').setRequired(true)
    )
    .addAttachmentOption(option =>
      option.setName('loot').setDescription('Upload your loot screenshot (optional).').setRequired(false)
    )
    .addStringOption(option =>
      option.setName('notes').setDescription('Add any notes about the run (optional).').setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('cleanupcommands')
    .setDescription('Remove all global slash commands. Use only when needed.')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  const guilds = client.guilds.cache.map(g => g.id);

  // Clean up per-guild (local) commands
  for (const guildId of guilds) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, guildId),
        { body: [] }
      );
      console.log(`🧹 Deleted local slash commands for guild: ${guildId}`);
    } catch (err) {
      console.error(`❌ Failed to delete local commands for ${guildId}:`, err);
    }
  }

  // Register global commands
  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('🌍 Global slash commands registered successfully.');
  } catch (err) {
    console.error('❌ Error registering global commands:', err);
  }
});

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

  if (commandName === 'colostart' || commandName === 'coloend') {
    const file = interaction.options.getAttachment('screenshot');

    await interaction.reply({ content: '✅ Start submission received!', flags: 64 }); // ephemeral
    await reviewChannel.send({
      content: `📥 ${commandName === 'colostart' ? '**Start**' : '**End**'} submission from <@${userId}> (${username})\nSubmitted: ${discordTimestamp()}`,
      files: [file.url]
    });
  }

  if (commandName === 'lootmodifiers') {
    const modifiers = interaction.options.getAttachment('modifiers');
    const loot = interaction.options.getAttachment('loot');
    const notes = interaction.options.getString('notes') || 'None';

    await interaction.reply({ content: '✅ Loot and modifiers submission received!', flags: 64 }); // ephemeral

    await reviewChannel.send({
      content: `📤 Loot submission from <@${userId}> (${username})\nSubmitted: ${discordTimestamp()}\n\n📝 Notes: ${notes}`,
      files: [modifiers.url, ...(loot ? [loot.url] : [])]
    });
  }

  if (commandName === 'cleanupcommands') {
    if (interaction.user.id !== process.env.ADMIN_USER_ID) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', flags: 64 });
    }

    try {
      await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
      await interaction.reply({ content: '✅ All global commands deleted.', flags: 64 });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: '❌ Failed to delete commands.', flags: 64 });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
