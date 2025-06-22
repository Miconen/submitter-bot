require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Routes, REST, SlashCommandBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ],
  partials: [Partials.Channel]
});

const SUBMIT_CHANNEL = '1385624201544601680';
const REVIEW_CHANNEL = '1385623845469163660';

const commands = [
  new SlashCommandBuilder()
    .setName('colostart')
    .setDescription('Submit your starting setup screenshot for the Colosseum event.')
    .addAttachmentOption(option =>
      option.setName('screenshot').setDescription('Your starting setup screenshot').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('notes').setDescription('Optional notes for your start submission')
    ),

  new SlashCommandBuilder()
    .setName('coloend')
    .setDescription('Submit your ending setup screenshot for the Colosseum event.')
    .addAttachmentOption(option =>
      option.setName('screenshot').setDescription('Your ending setup screenshot').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('notes').setDescription('Optional notes for your end submission')
    ),

  new SlashCommandBuilder()
    .setName('lootmodifiers')
    .setDescription('Submit your loot screenshot and list of modifiers.')
    .addStringOption(option =>
      option.setName('modifiers').setDescription('Modifiers used in the run').setRequired(true)
    )
    .addAttachmentOption(option =>
      option.setName('loot').setDescription('Optional screenshot of your loot')
    )
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
    const screenshot = interaction.options.getAttachment('screenshot');
    const notes = interaction.options.getString('notes') || '*No additional notes provided.*';
    const label = commandName === 'colostart' ? 'Start' : 'End';

    await reviewChannel.send({
      content: `📥 **${label}** submission from <@${userId}> (${username})\nSubmitted: ${discordTimestamp()}\n\n📝 Notes:\n${notes}`,
      files: [screenshot.url]
    });

    await interaction.reply({
      content: `✅ Your **${label.toLowerCase()}ing setup** was submitted successfully and forwarded to the event team.`,
      ephemeral: true
    });
  }

  if (commandName === 'lootmodifiers') {
    const modifiers = interaction.options.getString('modifiers');
    const loot = interaction.options.getAttachment('loot');

    await reviewChannel.send({
      content: `📤 Loot submission from <@${userId}> (${username})\nSubmitted: ${discordTimestamp()}\n\n📝 Modifiers:\n${modifiers}`,
      files: loot ? [loot.url] : []
    });

    await interaction.reply({
      content: '✅ Your **loot and modifiers** have been submitted successfully!',
      ephemeral: true
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
