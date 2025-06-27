const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const configManager = require('../config.js');

const REQUIRED_CHANNELS = [
  'membership', 'suspensions', 'gametimes', 'rulebook', 'applications',
  'tickets', 'team owners', 'standings', 'results', 'streams', 'pickups',
  'transactions', 'free agency', 'logs'
];

const REQUIRED_ROLES = [
  'verified', 'unverified', 'commissioner', 'referee', 'streamer', 'suspended',
  'franchise owner', 'general manager', 'head coach', 'assistant coach',
  'stat manager', 'pickups hoster', 'stream ping', 'pickups ping'
];

// Simple fuzzy finder: finds the first channel/role that includes the name substring (case-insensitive)
function fuzzyFind(collection, targetName) {
  const lowerTarget = targetName.toLowerCase();
  return collection.find(c => c.name.toLowerCase().includes(lowerTarget)) || null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup_auto')
    .setDescription('Automatically configures channels and roles based on fuzzy name matching.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ content: '❌ Only the **server owner** can run this command.', ephemeral: true });
    }

    // Ensure blank config template exists for this guild
    const guildConfig = configManager.ensureGuildConfig(interaction.guild.id);

    // Find matching channels
    const foundChannels = {};
    for (const name of REQUIRED_CHANNELS) {
      const channel = fuzzyFind(interaction.guild.channels.cache, name);
      foundChannels[name] = channel ? channel.id : null;
    }

    // Find matching roles
    const foundRoles = {};
    for (const name of REQUIRED_ROLES) {
      const role = fuzzyFind(interaction.guild.roles.cache, name);
      foundRoles[name] = role ? role.id : null;
    }

    // Update the guild config with found IDs
    configManager.updateGuildConfig(interaction.guild.id, {
      channels: foundChannels,
      roles: foundRoles,
    });

    // Build reply embed showing what was matched
    const embed = new EmbedBuilder()
      .setTitle('✅ Auto Setup Complete')
      .setDescription('**Helix Staff 💡:** Your server config has been updated.\n\nHere are the detected channels and roles:')
      .setColor(0x00ff99)
      .addFields(
        { name: '📚 Channels', value: REQUIRED_CHANNELS.map(n => `• ${n}: ${foundChannels[n] ? `<#${foundChannels[n]}>` : '`Not Found`'}`).join('\n'), inline: false },
        { name: '🎭 Roles', value: REQUIRED_ROLES.map(n => `• ${n}: ${foundRoles[n] ? `<@&${foundRoles[n]}>` : '`Not Found`'}`).join('\n'), inline: false }
      );

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};