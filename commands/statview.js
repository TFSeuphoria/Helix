const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const statsPath = path.join(__dirname, '..', 'data', 'stats.json');

function loadStats() {
  if (!fs.existsSync(statsPath)) {
    fs.writeFileSync(statsPath, '{}');
  }
  const raw = fs.readFileSync(statsPath, 'utf8');
  return JSON.parse(raw);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('statview')
    .setDescription('View a user\'s stats')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to view')
        .setRequired(true)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const guildId = interaction.guild.id;
    const stats = loadStats();

    // All stats for user in all guilds
    const allStatsForUser = {};

    for (const [gId, users] of Object.entries(stats)) {
      if (users[target.id]) {
        allStatsForUser[gId] = users[target.id];
      }
    }

    if (!Object.keys(allStatsForUser).length) {
      return interaction.reply({
        content: '❌ No stats found for this user.',
        ephemeral: true
      });
    }

    let selectedScope = 'this'; // 'this' or 'all'
    let selectedCategory = 'qb';

    const statCategories = ['qb', 'runner', 'wr', 'db', 'defender', 'kicker'];

    const buildEmbed = () => {
      let scopedStats = [];

      if (selectedScope === 'this') {
        const guildStats = stats[guildId]?.[target.id];
        if (guildStats && guildStats[selectedCategory]) {
          scopedStats.push(guildStats[selectedCategory]);
        }
      } else {
        for (const guildData of Object.values(allStatsForUser)) {
          if (guildData[selectedCategory]) scopedStats.push(guildData[selectedCategory]);
        }
      }

      if (!scopedStats.length) {
        return new EmbedBuilder()
          .setTitle(`${selectedCategory.toUpperCase()} Stats`)
          .setDescription('No stats found for this scope.')
          .setColor(0xff0000);
      }

      // Merge stats
      const merged = scopedStats.reduce((acc, cur) => {
        for (const [key, val] of Object.entries(cur)) {
          acc[key] = (acc[key] || 0) + val;
        }
        return acc;
      }, {});

      const embed = new EmbedBuilder()
        .setTitle(`${selectedCategory.toUpperCase()} Stats for ${target.username}`)
        .setColor(0x00AE86)
        .setFooter({ text: selectedScope === 'this' ? 'This League Only' : 'All Leagues' });

      for (const [key, val] of Object.entries(merged)) {
        embed.addFields({ name: key.replace(/_/g, ' '), value: String(val), inline: true });
      }

      return embed;
    };

    const statRow1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('qb').setLabel('QB').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('runner').setLabel('Runner').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('wr').setLabel('WR').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('db').setLabel('DB').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('defender').setLabel('Defender').setStyle(ButtonStyle.Primary),
    );

    const statRow2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('kicker').setLabel('Kicker').setStyle(ButtonStyle.Primary)
    );

    const scopeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('this').setLabel('This League').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('all').setLabel('All Leagues').setStyle(ButtonStyle.Secondary)
    );

    const embed = buildEmbed();

    await interaction.reply({
      embeds: [embed],
      components: [statRow1, statRow2, scopeRow],
      ephemeral: true,
    });

    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 5 * 60 * 1000,
    });

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) return i.deferUpdate();

      if (statCategories.includes(i.customId)) {
        selectedCategory = i.customId;
      } else if (['this', 'all'].includes(i.customId)) {
        selectedScope = i.customId;
      }

      const newEmbed = buildEmbed();
      await i.update({ embeds: [newEmbed] });
    });

    collector.on('end', async () => {
      await interaction.editReply({ components: [] });
    });
  },
};
