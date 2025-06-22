require('dotenv').config();
const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder } = require('discord.js');

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
const GUILD_ID = '979445890064470036'; // 

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Register Slash Commands for this server
  const commands = [
    new SlashCommandBuilder().setName('colostart').setDescription('Submit your starting setup screenshot for the Colosseum event'),
    new SlashCommandBuilder().setName('coloend').setDescription('Submit your ending setup screenshot for the Colosseum event'),
    new SlashCommandBuilder().setName('lootmodifiers').setDescription('Submit your loot screenshot and list modifiers')
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, GUILD_ID),
      { body: commands }
    );
    console.log('✅ Slash commands registered instantly to guild:', GUILD_ID);
  } catch (error) {
    console.error('Slash command registration failed:', error);
  }
});

// Screenshot forwarding logic
client.on('messageCreate', async (message) => {
  if (
    message.channel.id === SUBMIT_CHANNEL &&
    !message.author.bot &&
    message.attachments.size > 0
  ) {
    const reviewChannel = await client.channels.fetch(REVIEW_CHANNEL);
    const attachment = message.attachments.first();
    const timestamp = Math.floor(Date.now() / 1000);

    await reviewChannel.send({
      content: `📸 New submission from <@${message.author.id}> at <t:${timestamp}:f>:\n${message.content || ''}`,
      files: [attachment.url]
    });

    await message.delete();
  }
});

// Slash Command Logic
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const filter = m => m.author.id === interaction.user.id;

  const askForScreenshot = async (prompt) => {
    await interaction.reply({ content: prompt, ephemeral: true });
    const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 60000 });
    return collected.first();
  };

  const postToReview = async (user, type, content, attachmentUrl = null) => {
    const reviewChannel = await client.channels.fetch(REVIEW_CHANNEL);
    const timestamp = Math.floor(Date.now() / 1000);

    const message = {
      content: `📸 **${type} Submission** from <@${user.id}> at <t:${timestamp}:f>:\n${content || 'No additional notes.'}`
    };

    if (attachmentUrl) {
      message.files = [attachmentUrl];
    }

    await reviewChannel.send(message);
  };

  if (interaction.commandName === 'colostart') {
    const msg = await askForScreenshot('📸 Please upload your **starting setup and inventory** screenshot.');
    if (!msg) return interaction.followUp({ content: '⏰ Submission timed out.', ephemeral: true });
    const attachment = msg.attachments.first();
    await postToReview(interaction.user, 'Colo Start', msg.content, attachment?.url);
    await interaction.followUp({ content: '✅ Starting setup submitted!', ephemeral: true });
  }

  if (interaction.commandName === 'coloend') {
    const msg = await askForScreenshot('📸 Please upload your **ending setup and inventory** screenshot.');
    if (!msg) return interaction.followUp({ content: '⏰ Submission timed out.', ephemeral: true });
    const attachment = msg.attachments.first();
    await postToReview(interaction.user, 'Colo End', msg.content, attachment?.url);
    await interaction.followUp({ content: '✅ Ending setup submitted!', ephemeral: true });
  }

  if (interaction.commandName === 'lootmodifiers') {
    await interaction.reply({ content: '📸 Upload your **loot screenshot**, or type `no loot`.', ephemeral: true });
    const lootResponse = await interaction.channel.awaitMessages({ filter, max: 1, time: 60000 });
    if (!lootResponse.size) return interaction.followUp({ content: '⏰ Submission timed out.', ephemeral: true });

    const lootMsg = lootResponse.first();
    const noLoot = lootMsg.content.toLowerCase() === 'no loot';
    const lootAttachment = lootMsg.attachments.first();

    await interaction.followUp({ content: '🛠️ Now please type the **modifiers** used during this run.', ephemeral: true });
    const modResponse = await interaction.channel.awaitMessages({ filter, max: 1, time: 60000 });
    if (!modResponse.size) return interaction.followUp({ content: '⏰ Submission timed out.', ephemeral: true });

    const modMsg = modResponse.first();

    await postToReview(
      interaction.user,
      'Loot + Modifiers',
      `💬 Modifiers: ${modMsg.content}`,
      noLoot ? null : lootAttachment?.url
    );

    await interaction.followUp({ content: '✅ Loot and modifiers submitted!', ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
