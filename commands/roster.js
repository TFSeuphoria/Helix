const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const teamsManager = require('../teams.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roster')
    .setDescription('Show all players on a team.')
    .addRoleOption(option =>
      option.setName('team')
        .setDescription('The team to get the roster for')
        .setRequired(true)
    ),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const guildTeams = teamsManager.ensureGuildTeams(guildId);

    const teamRole = interaction.options.getRole('team');

    // Verify if the role is a registered team role
    const teamEntry = Object.entries(guildTeams).find(([teamName, data]) => data.role === teamRole.id);

    if (!teamEntry) {
      return interaction.reply({ content: '❌ That role is not a registered team in this league.', ephemeral: true });
    }

    const [teamName] = teamEntry;

    // Get members with that role
    const members = interaction.guild.members.cache.filter(member => member.roles.cache.has(teamRole.id));

    if (members.size === 0) {
      return interaction.reply({ content: `ℹ️ There are no members currently on **${teamName}**.`, ephemeral: true });
    }

    // Format member list - tag users (limit to first 50 to avoid spam)
    const memberList = members.map(m => `<@${m.id}>`).slice(0, 50).join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`📋 Roster for ${teamName}`)
      .setDescription(memberList)
      .setColor(0x00b0f4)
      .setFooter({ text: `Total Players: ${members.size}` });

    return interaction.reply({ embeds: [embed] });
  },
};