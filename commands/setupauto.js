const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const configManager = require('../data/config.js');

const CHANNELS_TO_SETUP = [
  'membership', 'suspensions', 'gametimes', 'rulebook', 'applications',
  'tickets', 'team owners', 'standings', 'results', 'streams',
  'pickups', 'transactions', 'free agency', 'logs',
];

const ROLES_TO_SETUP = [
  'verified', 'unverified', 'commissioner', 'referee', 'streamer',
  'suspended', 'franchise owner', 'general manager', 'head coach',
  'assistant coach', 'stat manager', 'pickups hoster',
  'stream ping', 'pickups ping', 'blacklisted', 'candidate',
];

function findBestMatch(name, collection) {
  name = name.toLowerCase();
  return collection.find(
    item => item.name.toLowerCase().includes(name)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup_auto')
    .setDescription('Automatically configure channels and roles based on name similarity.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      return interaction.reply({ content: '❌ This command can only be run in a server.', ephemeral: true });
    }

    // Get current config or blank template for this guild
    const guildConfig = configManager.ensureGuildConfig(guild.id);

    const newConfig = {
      channels: { ...guildConfig.channels },
      roles: { ...guildConfig.roles },
    };

    const matchedChannels = [];
    for (const key of CHANNELS_TO_SETUP) {
      const match = findBestMatch(key, guild.channels.cache);
      if (match) {
        newConfig.channels[key] = match.id;
        matchedChannels.push(`✅ Channel **${key}** -> #${match.name}`);
      } else {
        newConfig.channels[key] = null;
      }
    }

    const matchedRoles = [];
    for (const key of ROLES_TO_SETUP) {
      const match = findBestMatch(key, guild.roles.cache);
      if (match) {
        newConfig.roles[key] = match.id;
        matchedRoles.push(`✅ Role **${key}** -> @${match.name}`);
      } else {
        newConfig.roles[key] = null;
      }
    }

    // Save updated config
    configManager.updateGuildConfig(guild.id, newConfig);

    // Build summary embed
    const embed = new EmbedBuilder()
      .setTitle('🛠️ Auto Setup Complete')
      .setColor(0x00ff99)
      .setDescription(
        [
          '**Channels Configured:**',
          matchedChannels.length ? matchedChannels.join('\n') : '_No channels matched_',
          '',
          '**Roles Configured:**',
          matchedRoles.length ? matchedRoles.join('\n') : '_No roles matched_',
        ].join('\n')
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
