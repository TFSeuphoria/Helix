const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  PermissionFlagsBits,
} = require('discord.js');
const configManager = require('../config.js');

const CHANNELS = [
  'membership',
  'suspensions',
  'gametimes',
  'rulebook',
  'applications',
  'tickets',
  'team owners',
  'standings',
  'results',
  'streams',
  'pickups',
  'transactions',
  'free agency',
  'logs',
];

const ROLES = [
  'verified',
  'unverified',
  'commissioner',
  'referee',
  'streamer',
  'suspended',
  'franchise owner',
  'general manager',
  'head coach',
  'assistant coach',
  'stat manager',
  'pickups hoster',
  'stream ping',
  'pickups ping',
];

const ITEMS_PER_PAGE = 5;

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// We'll split the parts: 3 pages for channels, 3 pages for roles
const channelChunks = chunkArray(CHANNELS, ITEMS_PER_PAGE);
const roleChunks = chunkArray(ROLES, ITEMS_PER_PAGE);
const totalPages = channelChunks.length + roleChunks.length;

function createSelectMenu(guild, items, configSection, currentConfig) {
  // Build options from guild cache & current config value
  const options = items.map(name => {
    const isChannel = configSection === 'channels';
    let choices;
    if (isChannel) {
      choices = guild.channels.cache.filter(ch => ch.type === 0); // GuildText channels only
    } else {
      choices = guild.roles.cache;
    }

    // We'll build options by scanning guild and mapping to names

    // The menu option should have label=name, value=channelID or roleID
    // But user must pick which actual guild channel/role corresponds to this config name

    // For dropdown, show all possible guild channels/roles for selection, but this is a challenge in discord's select menu,
    // so we do a select for each config item separately, or we use a multi-select with all options.
    // To keep it simple and user-friendly, we'll create one select menu with options as guild channels/roles
    // and label them by their name. The user selects one option for that config name.

    // But since this command has 5 config items per page, and each needs one selection,
    // we will create 5 select menus each for one config item. Because one select can only select one item.

    // Therefore, we'll make the function create multiple select menus, one per config item.

    // So this function is only called per 5 items to generate select menus for each item.

  });
}

function buildSelectMenus(guild, items, currentConfig, section) {
  // Returns an array of ActionRowBuilder with one StringSelectMenuBuilder each for each config item

  return items.map((name, index) => {
    // Build options for select menu
    const isChannel = section === 'channels';

    let options;

    if (isChannel) {
      options = guild.channels.cache
        .filter(ch => ch.type === 0) // GuildText channels only
        .map(ch => ({
          label: ch.name,
          value: ch.id,
        }));
    } else {
      options = guild.roles.cache.map(role => ({
        label: role.name,
        value: role.id,
      }));
    }

    // Add a default option for unsetting
    options.unshift({
      label: 'None / Clear',
      value: 'null',
    });

    // Find current selected value
    let currentValue = currentConfig?.[name];
    if (!currentValue) currentValue = 'null';

    const select = new StringSelectMenuBuilder()
      .setCustomId(`${section}_${name}`)
      .setPlaceholder(`Select ${name}`)
      .addOptions(options)
      .setMinValues(1)
      .setMaxValues(1)
      .setValue([currentValue === null ? 'null' : currentValue]);

    const row = new ActionRowBuilder().addComponents(select);
    return row;
  });
}

function createEmbed(page, totalPages, guild) {
  const embed = new EmbedBuilder()
    .setTitle('⚙️ Manual Setup - Configure Your Server')
    .setFooter({ text: `Helix Staff 💡 - Page ${page + 1} / ${totalPages}` })
    .setColor(0x0099ff);

  if (page < channelChunks.length) {
    embed.setDescription(
      'Select the **channels** for the following settings:\n' +
        channelChunks[page].map(c => `• **${c}**`).join('\n')
    );
  } else {
    const rolePageIndex = page - channelChunks.length;
    embed.setDescription(
      'Select the **roles** for the following settings:\n' +
        roleChunks[rolePageIndex].map(r => `• **${r}**`).join('\n')
    );
  }

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup_manual')
    .setDescription('Manually configure channels and roles using an interactive menu.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ content: '❌ Only the **server owner** can run this command.', ephemeral: true });
    }

    // Ensure config entry for guild
    const guildConfig = configManager.ensureGuildConfig(interaction.guild.id);

    // Current page index
    let currentPage = 0;

    // Build initial embed and selects
    const embed = createEmbed(currentPage, totalPages, interaction.guild);

    // Build selects for current page
    const selects =
      currentPage < channelChunks.length
        ? buildSelectMenus(interaction.guild, channelChunks[currentPage], guildConfig.channels, 'channels')
        : buildSelectMenus(interaction.guild, roleChunks[currentPage - channelChunks.length], guildConfig.roles, 'roles');

    // Build navigation buttons
    const prevButton = new ButtonBuilder()
      .setCustomId('prev')
      .setLabel('Previous')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true);

    const nextButton = new ButtonBuilder()
      .setCustomId('next')
      .setLabel('Next')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(totalPages <= 1);

    // Send initial reply
    const message = await interaction.reply({
      embeds: [embed],
      components: [...selects, new ActionRowBuilder().addComponents(prevButton, nextButton)],
      ephemeral: true,
      fetchReply: true,
    });

    // Create collector for select menus and buttons
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.SelectMenu || ComponentType.Button,
      time: 10 * 60 * 1000, // 10 minutes
      filter: i => i.user.id === interaction.user.id,
    });

    collector.on('collect', async (i) => {
      if (i.isButton()) {
        // Handle navigation buttons
        if (i.customId === 'next') {
          if (currentPage < totalPages - 1) currentPage++;
        } else if (i.customId === 'prev') {
          if (currentPage > 0) currentPage--;
        }

        // Update buttons disabled state
        prevButton.setDisabled(currentPage === 0);
        nextButton.setDisabled(currentPage === totalPages - 1);

        // Build new embed and selects
        const newEmbed = createEmbed(currentPage, totalPages, interaction.guild);
        const newSelects =
          currentPage < channelChunks.length
            ? buildSelectMenus(interaction.guild, channelChunks[currentPage], guildConfig.channels, 'channels')
            : buildSelectMenus(interaction.guild, roleChunks[currentPage - channelChunks.length], guildConfig.roles, 'roles');

        await i.update({
          embeds: [newEmbed],
          components: [...newSelects, new ActionRowBuilder().addComponents(prevButton, nextButton)],
        });
      } else if (i.isStringSelectMenu()) {
        // Save selection to config
        const [section, name] = i.customId.split('_');
        const value = i.values[0] === 'null' ? null : i.values[0];

        if (section === 'channels') {
          guildConfig.channels[name] = value;
        } else if (section === 'roles') {
          guildConfig.roles[name] = value;
        }

        // Persist config update
        configManager.updateGuildConfig(interaction.guild.id, guildConfig);

        await i.reply({ content: `✅ Updated **${name}** ${section === 'channels' ? 'channel' : 'role'}.`, ephemeral: true });
      }
    });

    collector.on('end', async () => {
      try {
        await interaction.editReply({
          components: [],
          content: '⏰ Setup timed out. Please run the command again if you want to finish configuration.',
        });
      } catch {
        // ignore if message was deleted
      }
    });
  },
};