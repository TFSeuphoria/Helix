const fs = require('fs');
const path = require('path');

const teamsPath = path.join(__dirname, 'data', 'teams.json');

function loadTeams() {
  if (!fs.existsSync(teamsPath)) fs.writeFileSync(teamsPath, '{}');
  return JSON.parse(fs.readFileSync(teamsPath, 'utf8'));
}

function saveTeams(teams) {
  fs.writeFileSync(teamsPath, JSON.stringify(teams, null, 2));
}

function ensureGuildTeams(guildId) {
  const teams = loadTeams();
  if (!teams[guildId]) {
    teams[guildId] = { teams: [] };
    saveTeams(teams);
  }
  return teams[guildId];
}

/**
 * Add a team object to the guild.
 * teamData = { roleId: string, emoji: string }
 */
function addTeam(guildId, teamData) {
  const teams = loadTeams();
  if (!teams[guildId]) teams[guildId] = { teams: [] };

  // Prevent duplicate roles
  if (teams[guildId].teams.some(t => t.roleId === teamData.roleId)) {
    throw new Error('Team with this role already exists.');
  }

  teams[guildId].teams.push(teamData);
  saveTeams(teams);
}

/**
 * Remove a team by roleId.
 * Returns true if removed, false if not found.
 */
function removeTeam(guildId, roleId) {
  const teams = loadTeams();
  if (!teams[guildId]) return false;

  const index = teams[guildId].teams.findIndex(t => t.roleId === roleId);
  if (index === -1) return false;

  teams[guildId].teams.splice(index, 1);
  saveTeams(teams);
  return true;
}

/**
 * Get all teams for a guild.
 */
function getTeams(guildId) {
  const teams = loadTeams();
  return teams[guildId] ? teams[guildId].teams : [];
}

module.exports = {
  loadTeams,
  saveTeams,
  ensureGuildTeams,
  addTeam,
  removeTeam,
  getTeams,
};