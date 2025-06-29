const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');

const configManager = require('../config.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('switch_teams')
    .setDescription('Swap all users between two team roles.')
    .addRoleOption(option =>
      option.setName('team1')
        .setDescription('First team role to switch')
        .setRequired(true))
    .addRoleOption(option =>
      option.setName('team2')
        .setDescription('Second team role to switch')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

  async execute(interaction) {
    const guildConfig = configManager.ensureGuildConfig(interaction.guild.id);
    const commissionerRoleId = guildConfig.roles?.['commissioner'];
    const transactionsChannelId = guildConfig.channels?.transactions;

    if (!commissionerRoleId) {
      return interaction.reply({ content: '❌ Commissioner role not set in setup.', ephemeral: true });
    }

    if (!interaction.member.roles.cache.has(commissionerRoleId)) {
      return interaction.reply({ content: '❌ Only the commissioner can run this command.', ephemeral: true });
    }

    const team1 = interaction.options.getRole('team1');
    const team2 = interaction.options.getRole('team2');

    if (!team1 || !team2 || team1.id === team2.id) {
      return interaction.reply({ content: '❌ Invalid team roles provided.', ephemeral: true });
    }

    const allMembers = await interaction.guild.members.fetch();

    let team1Members = [];
    let team2Members = [];

    // Find members on each team
    for (const [, member] of allMembers) {
      if (member.roles.cache.has(team1.id)) team1Members.push(member);
      else if (member.roles.cache.has(team2.id)) team2Members.push(member);
    }

    // Swap roles
    for (const member of team1Members) {
      try {
        await member.roles.remove(team1.id);
        await member.roles.add(team2.id);
      } catch {}
    }

    for (const member of team2Members) {
      try {
        await member.roles.remove(team2.id);
        await member.roles.add(team1.id);
      } catch {}
    }

    // Post transaction
    if (transactionsChannelId) {
      const txChannel = interaction.guild.channels.cache.get(transactionsChannelId);
      if (txChannel) {
        const embed = new EmbedBuilder()
          .setTitle('🔄 Team Roles Switched')
          .setColor(0x00ffff)
          .setDescription(`Team roles have been switched.`)
          .addFields(
            { name: 'Switched Teams', value: `**${team1.name}** ⟷ **${team2.name}**`, inline: false },
            { name: 'Action By', value: interaction.user.tag, inline: true },
            { name: 'Members Switched', value: `${team1Members.length} ⇌ ${team2Members.length}`, inline: true }
          )
          .setTimestamp();

        txChannel.send({ embeds: [embed] }).catch(() => {});
      }
    }

    return interaction.reply({
      content: `✅ Switched all members between **${team1.name}** and **${team2.name}**.`,
      ephemeral: true,
    });
  },
};
