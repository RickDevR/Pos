// Nexus Luxury POS Enterprise Discord Webhook Engine v8.3
const WebhookManager = {
    getChannels() {
        return {
            purchases: localStorage.getItem('rf_wh_purchases') || 'https://discord.com/api/webhooks/1549586605658996849/4hKz92EptIUb18L5vL19fH-VApNyRa6QiJoyL1rllSeMsn03uO0FlvbhxlKNF0pf6lxV',
            staff: localStorage.getItem('rf_wh_staff') || 'https://discord.com/api/webhooks/1549593579381465149/KvrMVNf7samrGkE0NCpVR6EWDB1VP9NwVTtRTw73e8AhwH9RpCExn_hLSdDiJrK5Se7T',
            accounts: localStorage.getItem('rf_wh_accounts') || 'https://discord.com/api/webhooks/1549594039450599504/wCDZGfUi1saXZOqpAzrJQbg1ex5UaK-MBVOIvB65VmoRbUjByPHFBOCccdB7wzjEevQc',
            inventory: localStorage.getItem('rf_wh_inventory') || 'https://discord.com/api/webhooks/1549593801511669810/fWZVZ-w3OUk9Fx6SlA0GVEMxh0fzqprg4BX1sq20GOYGfbytzsLiJAXB27WjLarwU1hf',
            security: localStorage.getItem('rf_wh_security') || 'https://discord.com/api/webhooks/1549586460422701126/K5rGWYKqFUj5ipGHueLjRQ8zqdcbwV_5sjwmA2qXssmYwQTCzJFermUJqMf1myvSyU6O',
            audit: localStorage.getItem('rf_wh_audit') || 'https://discord.com/api/webhooks/1549593679100907530/avOwt1vyIGk6GhH-WhVf0OOsgdJxi8LzHQ7yJbLENFpGj7sl-BGtYezMUKU-01EwYzmf'
        };
    },

    async send(category, title, fields = [], color = 16766720) {
        let channels = this.getChannels();
        let url = channels[category];
        if (!url) return;

        let payload = {
            username: "Nexus Enterprise POS",
            avatar_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&h=150&fit=crop",
            embeds: [{
                title: `🛡️ Nexus Enterprise Alert: ${title}`,
                color: color,
                fields: fields,
                thumbnail: { url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&h=150&fit=crop" },
                author: { name: "Nexus Luxury POS v8.3 System", icon_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&h=150&fit=crop" },
                timestamp: new Date().toISOString(),
                footer: { text: "Nexus Luxury Enterprise POS v8.3 • Secured Gateway", icon_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&h=150&fit=crop" }
            }]
        };

        try {
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (err) {
            console.error("Discord Webhook Dispatch Error:", err);
        }
    }
};