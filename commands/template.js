const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  data: {
    name: "template",
    description: "Creates roles and emojis from a template.",
    options: [
      {
        name: "type",
        description: "The template to use (e.g., NFL, PFL)",
        type: 3,
        required: true,
        choices: [
          { name: "NFL", value: "NFL" },
          { name: "PFL", value: "PFL" }
        ]
      }
    ]
  },

  async execute(interaction) {
    const templateName = interaction.options.getString("type");
    const userId = interaction.user.id;
    const guild = interaction.guild;

    // Load template JSON
    const templatePath = path.join(__dirname, "../data/template.json");
    let templates;

    try {
      const raw = fs.readFileSync(templatePath, "utf-8");
      templates = JSON.parse(raw);
    } catch (err) {
      console.error("❌ Failed to read template.json:", err);
      return interaction.reply({
        content: "❌ Failed to load template file.",
        ephemeral: true
      });
    }

    const template = templates[templateName];
    if (!template) {
      return interaction.reply({
        content: `❌ Template "${templateName}" not found.`,
        ephemeral: true
      });
    }

    // Permission check (server owner or has commissioner role)
    const member = await guild.members.fetch(userId);
    const isOwner = userId === guild.ownerId;
    const commissionerRole = guild.roles.cache.find(
      r => r.name.toLowerCase() === "commissioner"
    );

    const isCommissioner = commissionerRole && member.roles.cache.has(commissionerRole.id);

    if (!isOwner && !isCommissioner) {
      return interaction.reply({
        content: "❌ You must be the server owner or a commissioner to use this command.",
        ephemeral: true
      });
    }

    // Start creating
    await interaction.deferReply({ ephemeral: true });

    const createdList = [];

    for (const team of template) {
      try {
        // Create role
        const role = await guild.roles.create({
          name: team.name,
          color: team.color,
          reason: `Created from ${templateName} template.`
        });

        // Create emoji
        const emojiMatch = team.emoji.match(/<a?:.+?:(\d+)>/);
        let emojiCreated = null;

        if (emojiMatch) {
          const emojiId = emojiMatch[1];
          const emojiURL = `https://cdn.discordapp.com/emojis/${emojiId}.webp?size=96&quality=lossless`;

          const imageBuffer = await axios.get(emojiURL, {
            responseType: "arraybuffer"
          });

          emojiCreated = await guild.emojis.create({
            attachment: Buffer.from(imageBuffer.data),
            name: team.name.replace(/\s+/g, "_")
          });
        }

        const status = `✅ ${team.name} — Role ID: \`${role.id}\`${
          emojiCreated ? `, Emoji: <:e:${emojiCreated.id}>` : ""
        }`;

        createdList.push(status);

        // Send update every 1–2 creations to avoid timeout
        if (createdList.length % 2 === 0) {
          await interaction.followUp({
            content: status,
            ephemeral: true
          });
        }

      } catch (err) {
        console.error(`❌ Error creating ${team.name}:`, err);
        createdList.push(`❌ ${team.name} — Error`);
      }
    }

    // Final follow-up with summary
    const summary = createdList.join("\n");
    await interaction.followUp({
      content: `✅ **${templateName} template setup complete.**\n\n${summary}`,
      ephemeral: true
    });
  }
};
