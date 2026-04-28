import { thinkWithQA, writeCode } from './models';
import { FlowResult } from './qaReporter';
import { UXFinding } from './uxSimulator';

export async function generateImprovements(
  failedFlows: FlowResult[],
  uxFindings: UXFinding[],
  codeContext: string
): Promise<string> {
  const prioritised = await thinkWithQA(`
You are the technical lead for Cortex.

## Failed API Flows
${failedFlows.map(f => `- ${f.flow}: ${f.error}`).join('\n') || 'None'}

## UX Issues Found
${uxFindings.slice(0, 10).map(f => `- [${f.severity}] ${f.page}: ${f.issue}`).join('\n') || 'None'}

## Task
Pick the TOP 5 most impactful issues to fix right now.
For each give:
1. Issue title
2. Which file to fix (be specific: e.g. apps/web/src/app/dashboard/page.tsx)
3. What the fix should do (2-3 sentences)
4. Priority: critical / high / medium

Format as numbered list.
`);

  const fixStubs = await writeCode(`
You are implementing fixes for Cortex — a Next.js 15 + Java Spring Boot app.

## Prioritised Issues to Fix
${prioritised}

## Codebase Context
${codeContext.slice(0, 15000)}

## Task
For each of the top 3 issues, write the actual code fix:
- Show the exact file path
- Show the minimal code change (before/after or just the new code)
- Use TypeScript for frontend (Next.js/React) and Java for backend
- Keep changes minimal — surgical fixes only

Format:
### Fix 1: [Title]
**File**: \`path/to/file.ts\`
\`\`\`typescript
// your fix here
\`\`\`
**Why**: one line explanation
`);

  return `## 🎯 Prioritised Issues\n${prioritised}\n\n## 🩹 Code Fix Stubs\n${fixStubs}`;
}

export async function suggestNewFeatures(codeContext: string): Promise<string> {
  return await thinkWithQA(`
You are a product manager and power-user of Cortex.

Based on the codebase:
${codeContext.slice(0, 10000)}

And these existing future features from the README:
- Native Mobile App
- Advanced AI Autonomous Agents
- Full-Text Semantic Search (Elasticsearch / Vector DB)
- Public Portfolio Publishing
- Advanced Analytics Dashboard
- Browser Extension PDF support

Suggest 3 QUICK WIN features that could be built in 1-2 days that would significantly improve the user experience.
For each: Feature name, which page it would live on, one-paragraph description, and estimated effort (hours).
`);
}
