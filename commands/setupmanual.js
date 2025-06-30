const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');

const fs = require('fs');
const path = require('path');
const configPath = path.join(__dirname, '../config.json');

function getConfig() {
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

const configKeys = {
  roles: [
    'verified', 'unverified', 'commissioner', 'referee',
    'streamer', 'suspended', 'franchise owner', 'general manager',
    'head coach', 'assistant coach', 'stat manager', 'pickups hoster',
    'stream ping', 'pickups ping', 'blacklisted', 'candidate'
  ],
  channels: [
    'membership', 'suspensions', 'gametimes', 'rulebook', 'applications',
    'tickets', 'team owners', 'standings', 'results', 'streams', 'pickups',
    'transactions', 'free agency', 'logs'
  ],
  settings: ['rosterCap']
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup_manual')
    .setDescription('Manually configure the server bot.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const guild = interaction.guild;
    const config = getConfig();
    if (!config[guild.id]) config[guild.id] = { roles: {}, channels: {}, settings: {} };

    let page = 0;
    const allItems = [...configKeys.roles.map(r => ({ type: 'role', name: r })), ...configKeys.channels.map(c => ({ type: 'channel', name: c })), ...configKeys.settings.map(s => ({ type: 'setting', name: s }))];
    const chunks = [];
    for (let i = 0; i < allItems.length; i += 4) chunks.push(allItems.slice(i, i + 4));

    const buildSelectRows = (pageIndex) => {
      const items = chunks[pageIndex];
      const rows = items.map(item => {
        const menu = new StringSelectMenuBuilder()
          .setCustomId(`select_${item.type}_${item.name}`)
          .setPlaceholder(`Set ${item.name}`)
          .setMinValues(1)
          .setMaxValues(1);

        if (item.type === 'role') {
          menu.addOptions(
            guild.roles.cache
              .filter(role => role.name !== '@everyone')
              .map(role => ({
                label: role.name,
                value: role.id
              }))
              .slice(0, 25)
          );
        } else if (item.type === 'channel') {
          menu.addOptions(
            guild.channels.cache
              .filter(ch => ch.type === ChannelType.GuildText)
              .map(ch => ({
                label: ch.name,
                value: ch.id
              }))
              .slice(0, 25)
          );
        } else if (item.type === 'setting') {
          menu.addOptions([
            { label: 'Enabled', value: 'true' },
            { label: 'Disabled', value: 'false' }
          ]);
        }

        return new ActionRowBuilder().addComponents(menu);
      });

      // Navigation Buttons
      const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('previous_page')
          .setLabel('Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(pageIndex === 0),
        new ButtonBuilder()
          .setCustomId('next_page')
          .setLabel('Next')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(pageIndex === chunks.length - 1)
      );

      return [...rows, navRow];
    };

    const message = await interaction.reply({
      content: '📘 Manual Setup: Select the roles, channels, and settings below.',
      components: buildSelectRows(page),
      ephemeral: true,
      fetchReply: true
    });

    const collector = message.createMessageComponentCollector({ time: 10 * 60 * 1000 });

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) return i.reply({ content: 'You can’t interact with this menu.', ephemeral: true });

      const id = i.customId;

      if (id === 'previous_page') {
        page = Math.max(0, page - 1);
        return i.update({ components: buildSelectRows(page) });
      }

      if (id === 'next_page') {
        page = Math.min(chunks.length - 1, page + 1);
        return i.update({ components: buildSelectRows(page) });
      }

      const [_, type, key] = id.split('_');
      const selected = i.values[0];

      if (type === 'role') config[guild.id].roles[key] = selected;
      else if (type === 'channel') config[guild.id].channels[key] = selected;
      else if (type === 'setting') config[guild.id].settings[key] = selected === 'true';

      saveConfig(config);
      await i.reply({ content: `✅ Set ${key} to <#${selected}>`, ephemeral: true });
    });

    collector.on('end', () => {
      message.edit({ content: 'Setup session ended.', components: [] }).catch(() => {});
    });
  }
};
