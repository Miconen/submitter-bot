require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  Routes,
  REST,
  SlashCommandBuilder,
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel],
});

const SUBMIT_CHANNEL = '1385624201544601680'; // pb-event-submissions
const REVIEW_CHANNEL = '1385623845469163660'; // pb-submissions-verification

// Slash command: /pb submit and /cleanupcommands
const commands = [
  new SlashCommandBuilder()
    .setName('pb')
    .setDescription('Submit a PB screenshot')
    .addSubcommand(subcommand =>
      subcommand
        .setName('submit')
        .setDescription('Submit your PB screenshot')
        .addAttachmentOption(option =>
          option.setName('screenshot').setDescription('Upload your PB screenshot').setRequired(true)
        )
        .addStringOption(option =>
          option.setName('teammates').setDescription('Mention your teammates (optional)').setRequired(false)
        )
    ),
  new SlashCommandBuilder()
    .setName('cleanupcommands')
    .setDescription('Remove all global slash commands (admin only)')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Register slash commands globally
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('✅ Slash commands registered globally.');
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

  const { commandName, options } = interaction;
  const subcommand = options.getSubcommand(false);
  const userId = interaction.user.id;
  const username = interaction.user.tag;

  if (commandName === 'pb' && subcommand === 'submit') {
    const screenshot = options.getAttachment('screenshot');
    const teammates = options.getString('teammates') || 'None';
    const reviewChannel = await client.channels.fetch(REVIEW_CHANNEL);

    await interaction.reply({
      content: '✅ Your PB submission was received and sent for review!',
      ephemeral: true,
    });

    await reviewChannel.send({
      content: `📥 **PB Submission** from <@${userId}> (${username})\nSubmitted: ${discordTimestamp()}\n👥 Teammates: ${teammates}`,
      files: [screenshot.url],
    });

    const submitChannel = await client.channels.fetch(SUBMIT_CHANNEL);
    const messages = await submitChannel.messages.fetch({ limit: 5 });

    const userMessage = messages.find(msg =>
      msg.author.id === userId &&
      msg.attachments.size > 0 &&
      msg.attachments.first().url === screenshot.url
    );

    if (userMessage) {
      try {
        await userMessage.delete();
        console.log(`🗑️ Deleted user's image message from #pb-event-submissions`);
      } catch (err) {
        console.error('❌ Failed to delete user message:', err);
      }
    }
  }

  if (commandName === 'cleanupcommands') {
    if (interaction.user.id !== process.env.ADMIN_USER_ID) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true
      });
    }

    try {
      await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
      await interaction.reply({ content: '✅ All global commands deleted.', ephemeral: true });
      console.log('🧹 Global slash commands deleted.');
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: '❌ Failed to delete commands.', ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
