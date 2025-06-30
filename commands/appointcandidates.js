const { SlashCommandBuilder } = require('@discordjs/builders');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('appointcandidates')
    .setDescription('Assign candidates as franchise owners for teams missing one'),

  async execute(interaction) {
    try {
      const guildId = interaction.guild.id;

      // Load config and teams
      const configPath = path.join(__dirname, '..', 'data', 'config.json');
      const teamsPath = path.join(__dirname, '..', 'data', 'teams.json');

      if (!fs.existsSync(configPath) || !fs.existsSync(teamsPath)) {
        return interaction.reply({ content: 'Config or teams file missing.', ephemeral: true });
      }

      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const teamsData = JSON.parse(fs.readFileSync(teamsPath, 'utf8'));

      if (!config[guildId] || !teamsData[guildId]) {
        return interaction.reply({ content: 'No configuration or teams data for this server.', ephemeral: true });
      }

      const rolesConfig = config[guildId].roles;
      const channelsConfig = config[guildId].channels;

      if (!rolesConfig || !channelsConfig) {
        return interaction.reply({ content: 'Roles or channels not configured properly.', ephemeral: true });
      }

      const commissionerRoleId = rolesConfig.commissioner;
      const franchiseOwnerRoleId = rolesConfig['franchise owner'];
      const candidateRoleId = rolesConfig.candidate;
      const transactionsChannelId = channelsConfig.transactions;

      if (!commissionerRoleId || !franchiseOwnerRoleId || !candidateRoleId || !transactionsChannelId) {
        return interaction.reply({ content: 'Commissioner, Franchise Owner, Candidate roles or Transactions channel are missing in config.', ephemeral: true });
      }

      // Check if user has commissioner role
      if (!interaction.member.roles.cache.has(commissionerRoleId)) {
        return interaction.reply({ content: 'You must be a commissioner to run this command.', ephemeral: true });
      }

      const guild = interaction.guild;

      // Fetch members with candidate role
      await guild.members.fetch(); // ensure cache populated
      const candidateMembers = guild.members.cache.filter(member => member.roles.cache.has(candidateRoleId));

      if (candidateMembers.size === 0) {
        return interaction.reply({ content: 'No candidates found to appoint.', ephemeral: true });
      }

      // Get teams missing a franchise owner
      const teams = teamsData[guildId].teams;

      if (!teams || teams.length === 0) {
        return interaction.reply({ content: 'No teams found in teams data.', ephemeral: true });
      }

      // Helper: get members with a role
      const getMembersWithRole = (roleId) =>
        guild.members.cache.filter(member => member.roles.cache.has(roleId));

      // Teams missing FO
      const teamsMissingFO = teams.filter(team => {
        const teamMembers = getMembersWithRole(team.roleId);
        const hasFO = teamMembers.some(member => member.roles.cache.has(franchiseOwnerRoleId));
        return !hasFO;
      });

      if (teamsMissingFO.length === 0) {
        return interaction.reply({ content: 'All teams already have franchise owners.', ephemeral: true });
      }

      // Shuffle candidates for randomness
      const candidatesArray = Array.from(candidateMembers.values());
      function shuffle(array) {
