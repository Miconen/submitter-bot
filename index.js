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
    .setName('roll')
    .setDescription('Roll a dice')
    .addStringOption(option =>
      option
        .setName('dice')
        .setDescription('Choose a dice type')
        .setRequired(true)
        .addChoices(
          { name: 'd4', value: '4' },
          { name: 'd6', value: '6' },
          { name: 'd8', value: '8' },
          { name: 'd10', value: '10' },
          { name: 'd12', value: '12' },
          { name: 'd20', value: '20' },
          { name: 'd100', value: '100' }
        )
    )
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

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

  if (commandName === 'roll') {
    const diceSize = parseInt(options.getString('dice'), 10);
    const result = Math.floor(Math.random() * diceSize) + 1;

    await interaction.reply({
      content: `🎲 <@${userId}> rolled a d${diceSize} and got **${result}**!`
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
