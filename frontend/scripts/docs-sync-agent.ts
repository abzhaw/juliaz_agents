import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOC_PATH = path.resolve(__dirname, '../../docs/agent_system_overview.md');
const OUT_PATH = path.resolve(__dirname, '../src/lib/architectureData.json');

// A simple utility to parse the markdown and extract sections.
// We are looking for H3 sections starting with standard emojis like 🧠, 🤖, etc.
function parseDocumentation() {
    try {
        const content = fs.readFileSync(DOC_PATH, 'utf-8');
        const sections = content.split('\n### ');

        // Default fallback dictionary
        const architectureData: Record<string, { description: string }> = {
            orchestrator: { description: "Processes messages, delegates, and decides using GPT-4o." },
            openclaw: { description: "The messaging gateway connecting external channels like Telegram to the system." },
            bridge: { description: "The MCP server and message queue connecting OpenClaw to the orchestration layer." },
            backend: { description: "The REST API and application architecture." },
            database: { description: "Persistent PostgreSQL storage for task memory and configuration." },
            user: { description: "The human operator initiating the interaction via Telegram or Dashboard." },
            cowork: { description: "The Cowork MCP server acting as the 'Second Brain' via Claude." }
        };

        // Extracting specifically from the documentation
        for (const section of sections) {
            if (section.startsWith('🧠 Orchestrator')) {
                architectureData.orchestrator.description = extractFirstParagraph(section);
            } else if (section.includes('OpenClaw')) { // 📡 OpenClawJulia
                architectureData.openclaw.description = extractFirstParagraph(section);
            } else if (section.startsWith('🔌 Bridge')) {
                architectureData.bridge.description = extractFirstParagraph(section);
            } else if (section.startsWith('🖥️ Backend API')) {
                architectureData.backend.description = extractFirstParagraph(section);
            } else if (section.startsWith('🤖 Cowork MCP')) {
                architectureData.cowork.description = extractFirstParagraph(section);
            }
        }

        // Ensure directory exists
        const dir = path.dirname(OUT_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(OUT_PATH, JSON.stringify(architectureData, null, 2), 'utf-8');
        console.log(`[Docs Sync Agent] Successfully synced architecture data to ${path.basename(OUT_PATH)}`);
    } catch (error) {
        console.error(`[Docs Sync Agent] Failed to parse documentation:`, error);
    }
}

function extractFirstParagraph(sectionText: string): string {
    const lines = sectionText.split('\n');
    let paragraph = "";
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line !== "" && !line.startsWith("**") && !line.startsWith("-") && !line.startsWith("###")) {
            paragraph = line;
            break;
        }
    }
    return paragraph;
}

// Run once on startup
parseDocumentation();

// Watch for changes
if (process.argv.includes('--watch')) {
    console.log(`[Docs Sync Agent] Watching for changes in ${path.basename(DOC_PATH)}...`);

    // Use a debounce to prevent double-firing on some OS saves
    let debounceTimer: NodeJS.Timeout | null = null;

    fs.watch(DOC_PATH, (eventType) => {
        if (eventType === 'change') {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                console.log(`[Docs Sync Agent] Change detected in documentation. Resyncing...`);
                parseDocumentation();
            }, 500);
        }
    });
}
