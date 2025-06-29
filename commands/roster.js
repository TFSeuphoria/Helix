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
    const guild = interaction.guild;
    const guildId = guild.id;
    const guildTeams = teamsManager.ensureGuildTeams(guildId); // ✅ Make sure teams exist per server

    const teamRole = interaction.options.getRole('team');

    // ✅ Check if teamRole.id matches any team in THIS guild's config
    const teamEntry = Object.entries(guildTeams).find(
      ([, data]) => data.roleId === teamRole.id
    );

    if (!teamEntry) {
      return interaction.reply({
        content: '❌ That role is not a registered team in this league.',
        ephemeral: true
      });
    }

    const [teamName, teamData] = teamEntry;

    // ✅ Make sure members are cached — fetch if needed
    await guild.members.fetch();

    const members = guild.members.cache.filter(member =>
      member.roles.cache.has(teamRole.id)
    );

    if (members.size === 0) {
      return interaction.reply({
        content: `ℹ️ There are no members currently on **${teamName}**.`,
        ephemeral: true
      });
    }

    const memberList = members
      .map(m => `<@${m.id}>`)
      .slice(0, 50)
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`📋 Roster for ${teamData.emoji || ''} ${teamName}`)
      .setDescription(memberList)
      .setColor(0x00b0f4)
      .setFooter({ text: `Total Players: ${members.size}` });

    return interaction.reply({ embeds: [embed] });
  },
};
