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
  'membership', 'suspensions', 'gametimes', 'rulebook', 'applications',
  'tickets', 'team owners', 'standings', 'results', 'streams',
  'pickups', 'transactions', 'free agency', 'logs',
];

const ROLES = [
  'verified', 'unverified', 'commissioner', 'referee', 'streamer',
  'suspended', 'franchise owner', 'general manager', 'head coach',
  'assistant coach', 'stat manager', 'pickups hoster',
  'stream ping', 'pickups ping',
];

const ITEMS_PER_PAGE = 4;
const channelChunks = chunkArray(CHANNELS, ITEMS_PER_PAGE);
const roleChunks = chunkArray(ROLES, ITEMS_PER_PAGE);
const totalPages = channelChunks.length + roleChunks.length + 1; // +1 for roster cap

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function buildSelectMenus(guild, items, currentConfig, section) {
  return items.map(name => {
    const isChannel = section === 'channels';
    let options = isChannel
      ? guild.channels.cache
          .filter(ch => ch.type === 0)
          .map(ch => ({
            label: ch.name,
            value: ch.id,
            default: currentConfig?.[name] === ch.id,
          }))
      : guild.roles.cache.map(role => ({
          label: role.name,
          value: role.id,
          default: currentConfig?.[name] === role.id,
        }));

    options.unshift({
      label: 'None / Clear',
      value: 'null',
      default: !currentConfig?.[name],
    });

    return new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`${section}_${name}`)
        .setPlaceholder(`Select ${name}`)
        .addOptions(options.slice(0, 25))
        .setMinValues(1)
        .setMaxValues(1)
    );
  });
}

function buildRosterCapSelect(currentCap) {
  const options = Array.from({ length: 50 }, (_, i) => ({
    label: `${i + 1}`,
    value: `${i + 1}`,
    default: currentCap === i + 1,
  }));

  options.unshift({
    label: 'Unlimited / No Cap',
    value: 'null',
    default: currentCap === null || currentCap === undefined,
  });

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('cap_rosterCap')
        .setPlaceholder('Select Roster Cap')
        .addOptions(options.slice(0, 25))
        .setMinValues(1)
        .setMaxValues(1)
    ),
  ];
}

function createEmbed(page, totalPages) {
  const embed = new EmbedBuilder()
    .setTitle('⚙️ Manual Setup - Configure Your Server')
    .setFooter({ text: `Helix Staff 💡 - Page ${page + 1} / ${totalPages}` })
    .setColor(0x0099ff);

  if (page < channelChunks.length) {
    embed.setDescription('Select the **channels** for the following settings:\n' +
      channelChunks[page].map(c => `• **${c}**`).join('\n'));
  } else if (page < channelChunks.length + roleChunks.length) {
    const rolePageIndex = page - channelChunks.length;
    embed.setDescription('Select the **roles** for the following settings:\n' +
      roleChunks[rolePageIndex].map(r => `• **${r}**`).join('\n'));
  } else {
    embed.setDescription('Set the **Roster Cap** (how many players a team can sign):');
  }

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup_manual')
    .setDescription('Manually configure channels, roles, and roster cap using an interactive menu.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const isOwner = interaction.user.id === interaction.guild.ownerId;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isOwner && !isAdmin) {
      return interaction.reply({
        content: '❌ Only the **server owner** or someone with **Administrator** permission can run this command.',
        ephemeral: true
      });
    }

    const guildConfig = configManager.ensureGuildConfig(interaction.guild.id);
    let currentPage = 0;

    const embed = createEmbed(currentPage, totalPages);

    const selects =
      currentPage < channelChunks.length
        ? buildSelectMenus(interaction.guild, channelChunks[currentPage], guildConfig.channels, 'channels')
        : currentPage < channelChunks.length + roleChunks.length
          ? buildSelectMenus(interaction.guild, roleChunks[currentPage - channelChunks.length], guildConfig.roles, 'roles')
          : buildRosterCapSelect(guildConfig.rosterCap);

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

    const message = await interaction.reply({
      embeds: [embed],
      components: [...selects, new ActionRowBuilder().addComponents(prevButton, nextButton)],
      flags: 1 << 6,
      fetchReply: true,
    });

    const filter = i => i.user.id === interaction.user.id;

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.SelectMenu,
      filter,
      time: 10 * 60 * 1000,
    });

    const buttonCollector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter,
      time: 10 * 60 * 1000,
    });

    collector.on('collect', async i => {
      const [section, name] = i.customId.split('_');
      const value = i.values[0] === 'null' ? null : i.values[0];

      if (section === 'channels') {
        guildConfig.channels[name] = value;
      } else if (section === 'roles') {
        guildConfig.roles[name] = value;
      } else if (section === 'cap') {
        guildConfig.rosterCap = value ? parseInt(value) : null;
      }

      configManager.updateGuildConfig(interaction.guild.id, guildConfig);

      await i.reply({
        content: `✅ Updated **${name}**.`,
        ephemeral: true
      });
    });

    buttonCollector.on('collect', async i => {
      if (i.customId === 'next' && currentPage < totalPages - 1) currentPage++;
      if (i.customId === 'prev' && currentPage > 0) currentPage--;

      prevButton.setDisabled(currentPage === 0);
      nextButton.setDisabled(currentPage === totalPages - 1);

      const embed = createEmbed(currentPage, totalPages);
      const selects =
        currentPage < channelChunks.length
          ? buildSelectMenus(interaction.guild, channelChunks[currentPage], guildConfig.channels, 'channels')
          : currentPage < channelChunks.length + roleChunks.length
            ? buildSelectMenus(interaction.guild, roleChunks[currentPage - channelChunks.length], guildConfig.roles, 'roles')
            : buildRosterCapSelect(guildConfig.rosterCap);

      await i.update({
        embeds: [embed],
        components: [...selects, new ActionRowBuilder().addComponents(prevButton, nextButton)],
      });
    });

    collector.on('end', async () => {
      try {
        await interaction.editReply({
          content: '⏰ Setup timed out. Please run the command again to continue.',
          components: [],
        });
      } catch {
        // Interaction might already be deleted
      }
    });
  },
};
