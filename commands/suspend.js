const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const configManager = require('../config.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('suspend')
    .setDescription('Suspend a player from the league.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to suspend')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Why is the user being suspended?')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('length')
        .setDescription('Length of suspension (e.g., "1 week", "indefinite")')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('bail')
        .setDescription('Bail cost to unsuspend (or "none")')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

  async execute(interaction) {
    const guildConfig = configManager.ensureGuildConfig(interaction.guild.id);

    const refereeRoleId = guildConfig.roles?.['referee'];
    const commissionerRoleId = guildConfig.roles?.['commissioner'];
    const suspendedRoleId = guildConfig.roles?.['suspended'];
    const suspensionsChannelId = guildConfig.channels?.suspensions;

    if (!refereeRoleId || !commissionerRoleId || !suspendedRoleId || !suspensionsChannelId) {
      return interaction.reply({ content: '❌ Required roles or channels not configured in /setup.', ephemeral: true });
    }

    const hasPermission =
      interaction.member.roles.cache.has(refereeRoleId) ||
      interaction.member.roles.cache.has(commissionerRoleId);

    if (!hasPermission) {
      return interaction.reply({ content: '❌ Only referees or commissioners can use this command.', ephemeral: true });
    }

    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    const length = interaction.options.getString('length');
    const bail = interaction.options.getString('bail');

    const targetMember = interaction.guild.members.cache.get(targetUser.id);
    if (!targetMember) {
      return interaction.reply({ content: '❌ That user is not in this server.', ephemeral: true });
    }

    // Add suspended role
    try {
      await targetMember.roles.add(suspendedRoleId);
    } catch (err) {
      return interaction.reply({ content: '❌ Failed to assign the suspended role.', ephemeral: true });
    }

    // Send suspension embed
    const suspensionsChannel = interaction.guild.channels.cache.get(suspensionsChannelId);
    if (suspensionsChannel) {
      const embed = new EmbedBuilder()
        .setTitle('🚫 Player Suspended')
        .setColor(0xff0000)
        .addFields(
          { name: 'Suspended Player', value: `<@${targetUser.id}>`, inline: true },
          { name: 'Issued By', value: interaction.user.tag, inline: true },
          { name: 'Length', value: length, inline: true },
          { name: 'Reason', value: reason, inline: false },
          { name: 'Bail Cost', value: bail, inline: true }
        )
        .setTimestamp();

      suspensionsChannel.send({ embeds: [embed] }).catch(() => {});
    }

    return interaction.reply({
      content: `✅ Suspended **${targetUser.tag}**.`,
      ephemeral: true
    });
  },
};