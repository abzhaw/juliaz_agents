import { exec } from 'child_process';
import { NextResponse } from 'next/server';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
    try {
        const { stdout } = await execAsync('npx pm2 jlist');
        const processList = JSON.parse(stdout);

        const formattedList = processList.map((p: Record<string, unknown>) => ({
            id: p.pm_id,
            name: p.name,
            status: (p.pm2_env as Record<string, unknown>).status,
            memory: (p.monit as Record<string, unknown>).memory,
            cpu: (p.monit as Record<string, unknown>).cpu,
            uptime: (p.pm2_env as Record<string, unknown>).pm_uptime,
            restarts: (p.pm2_env as Record<string, unknown>).restart_time
        }));

        return NextResponse.json({ success: true, processes: formattedList });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { action, processName } = await req.json();

        if (!['start', 'stop', 'restart'].includes(action)) {
            return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
        }

        if (!processName) {
            return NextResponse.json({ success: false, error: 'Process name is required' }, { status: 400 });
        }

        // Use npx pm2 to ensure we use the local or global pm2 securely
        const { stderr } = await execAsync(`npx pm2 ${action} ${processName}`);

        if (stderr && !stderr.includes('DeprecationWarning')) {
            console.warn('PM2 Warning/Error:', stderr);
        }

        return NextResponse.json({ success: true, message: `Successfully executed ${action} on ${processName}` });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
