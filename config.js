const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'data', 'config.json');

const blankTemplate = {
  channels: {
    membership: null,
    suspensions: null,
    gametimes: null,
    rulebook: null,
    applications: null,
    tickets: null,
    "team owners": null,
    standings: null,
    results: null,
    streams: null,
    pickups: null,
    transactions: null,
    "free agency": null,
    logs: null,
  },
  roles: {
    verified: null,
    unverified: null,
    commissioner: null,
    referee: null,
    streamer: null,
    suspended: null,
    "franchise owner": null,
    "general manager": null,
    "head coach": null,
    "assistant coach": null,
    "stat manager": null,
    "pickups hoster": null,
    "stream ping": null,
    "pickups ping": null,
  },
};

function loadConfig() {
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, '{}');
  }
  const raw = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(raw);
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * Ensures a guild entry exists in config.json.
 * If not, adds a blank template for that guild.
 * Returns the guild config object.
 */
function ensureGuildConfig(guildId) {
  const config = loadConfig();
  if (!config[guildId]) {
    config[guildId] = JSON.parse(JSON.stringify(blankTemplate)); // Deep clone
    saveConfig(config);
  }
  return config[guildId];
}

/**
 * Updates the guild's config with new data,
 * merges existing data with updates.
 */
function updateGuildConfig(guildId, updates) {
  const config = loadConfig();
  if (!config[guildId]) {
    config[guildId] = JSON.parse(JSON.stringify(blankTemplate));
  }
  config[guildId] = {
    ...config[guildId],
    ...updates,
    channels: {
      ...config[guildId].channels,
      ...(updates.channels || {})
    },
    roles: {
      ...config[guildId].roles,
      ...(updates.roles || {})
    }
  };
  saveConfig(config);
  return config[guildId];
}

module.exports = {
  loadConfig,
  saveConfig,
  ensureGuildConfig,
  updateGuildConfig,
};