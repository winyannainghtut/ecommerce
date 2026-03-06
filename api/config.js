const fs = require("node:fs");
const path = require("node:path");

module.exports = function handler(req, res) {
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const localEnv = readLocalEnvFallback();
    const telegramUsername = process.env.TELEGRAM_USERNAME || localEnv.TELEGRAM_USERNAME || "";

    res.setHeader("Cache-Control", "public, max-age=300");
    return res.status(200).json({ telegramUsername });
};

function readLocalEnvFallback() {
    const envCandidates = [".env.local", ".env"];
    const mergedEnv = {};

    envCandidates.forEach((filename) => {
        const filepath = path.join(process.cwd(), filename);

        if (!fs.existsSync(filepath)) {
            return;
        }

        const content = fs.readFileSync(filepath, "utf8");
        Object.assign(mergedEnv, parseEnvText(content));
    });

    return mergedEnv;
}

function parseEnvText(content) {
    const parsed = {};

    content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith("#")) {
            return;
        }

        const delimiterIndex = trimmed.indexOf("=");
        if (delimiterIndex < 0) {
            return;
        }

        const key = trimmed.slice(0, delimiterIndex).trim();
        let value = trimmed.slice(delimiterIndex + 1).trim();

        if (!key) {
            return;
        }

        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        parsed[key] = value;
    });

    return parsed;
}
