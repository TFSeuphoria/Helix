const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');

const configManager = require('../config.js');
const teamsManager = require('../teams.js');

const COACHING_ROLE_KEYS = ['general manager', 'head coach', 'assistant coach'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('disband')
    .setDescription('Disband a team and remove all users from it.')
    .addRoleOption(option =>
      option.setName('team')
        .setDescription('The team role to disband')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for disbanding the team')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages), // will enforce commissioner role check manually

  async execute(interaction) {
    const guildConfig = configManager.ensureGuildConfig(interaction.guild.id);
    const commissionerRoleId = guildConfig.roles?.['commissioner'];
    const transactionsChannelId = guildConfig.channels?.transactions;

    if (!commissionerRoleId) {
      return interaction.reply({ content: '❌ Commissioner role not set up.', ephemeral: true });
    }

    if (!interaction.member.roles.cache.has(commissionerRoleId)) {
      return interaction.reply({ content: '❌ Only the commissioner can use this command.', ephemeral: true });
    }

    const teamRole = interaction.options.getRole('team');
    const reason = interaction.options.getString('reason');

    if (!teamRole.editable) {
      return interaction.reply({ content: '❌ I do not have permission to manage that role.', ephemeral: true });
    }

    const guildMembers = await interaction.guild.members.fetch();

    let affectedCount = 0;

    // Loop through all members and remove team + coach roles
    for (const [, member] of guildMembers) {
      if (member.roles.cache.has(teamRole.id)) {
        affectedCount++;

        // Remove team role
        try {
          await member.roles.remove(teamRole.id);
        } catch {
          // not fatal
        }

        // Remove any coaching roles if they have them
        for (const key of COACHING_ROLE_KEYS) {
          const roleId = guildConfig.roles?.[key];
          if (roleId && member.roles.cache.has(roleId)) {
            try {
              await member.roles.remove(roleId);
            } catch {
              // not fatal
            }
          }
        }
      }
    }

    // Post to transactions channel
    if (transactionsChannelId) {
      const txChannel = interaction.guild.channels.cache.get(transactionsChannelId);
      if (txChannel) {
        const embed = new EmbedBuilder()
          .setTitle('🗑️ Team Disbanded')
          .setColor(0xff0000)
          .setDescription(`**${teamRole.name}** has been disbanded.`)
          .addFields(
            { name: 'Reason', value: reason, inline: false },
            { name: 'Disbanded By', value: interaction.user.tag, inline: true },
            { name: 'Members Affected', value: `${affectedCount}`, inline: true },
          )
          .setTimestamp();

        txChannel.send({ embeds: [embed] }).catch(() => {});
      }
    }

    return interaction.reply({
      content: `✅ Disbanded team **${teamRole.name}**. Removed from ${affectedCount} member(s).`,
      ephemeral: true,
    });
  },
};