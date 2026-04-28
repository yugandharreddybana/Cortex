import { thinkWithQA } from './models';
import { getAppRoutes } from './codeReader';

export interface UXFinding {
  page: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  issue: string;
  suggestion: string;
}

export async function simulateUserJourney(codeContext: string): Promise<{
  findings: UXFinding[];
  summary: string;
}> {
  const routes = getAppRoutes();

  const prompt = `
You are a real end-user of Cortex — a knowledge management web app.
You have just signed up and are exploring the application for the first time.

## Application Pages
${routes.map(r => `- ${r}`).join('\n')}

## Codebase Context
${codeContext.slice(0, 20000)}

## Your Task
Walk through these user journeys as an actual user and identify problems:

### Journey 1: New User Onboarding
- Visit homepage → signup → welcome page → dashboard
- What's confusing? What's missing? What would make you quit?

### Journey 2: Core Feature Usage
- Create a folder → create a highlight → tag it → pin it → add a comment
- Any friction? Error states? Empty state issues?

### Journey 3: Sharing & Collaboration
- Share a folder with another user → set permissions → view shared-with-me
- Permission confusion? Missing feedback?

### Journey 4: AI Features (Pro User)
- Use auto-draft → devils-advocate → connect-dots → suggest-actions
- Do they work? Are errors handled? Is loading state clear?

### Journey 5: Offline & Edge Cases
- What happens with expired JWT tokens?
- What happens on network loss with the sync queue?
- What happens when viewing a deleted shared resource?

### Journey 6: Pricing & Upgrade
- Visit /pricing → click upgrade → Stripe checkout flow
- Any UX confusion? Missing tier comparison?

For each issue found, output in this exact JSON format:
[
  {
    "page": "/dashboard",
    "severity": "high",
    "issue": "No empty state when user has no folders",
    "suggestion": "Add an empty state component with a CTA to create first folder"
  }
]

Output ONLY the JSON array, no other text.
`;

  const raw = await thinkWithQA(prompt);

  let findings: UXFinding[] = [];
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      findings = JSON.parse(match[0]);
    }
  } catch {
    return { findings: [], summary: raw };
  }

  const summary = await thinkWithQA(`
Based on these UX findings for Cortex:
${JSON.stringify(findings, null, 2)}

Write a concise 3-paragraph UX review as a real user would describe their experience.
Focus on the top 3 pain points and the top 2 things that work well.
`);

  return { findings, summary };
}

export function formatUXFindings(findings: UXFinding[]): string {
  if (findings.length === 0) return '_No UX issues found_';

  const bySeverity = {
    critical: findings.filter(f => f.severity === 'critical'),
    high: findings.filter(f => f.severity === 'high'),
    medium: findings.filter(f => f.severity === 'medium'),
    low: findings.filter(f => f.severity === 'low'),
  };

  const sections: string[] = [];

  for (const [severity, items] of Object.entries(bySeverity)) {
    if (items.length === 0) continue;
    const emoji = ({ critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' } as Record<string, string>)[severity];
    sections.push(`### ${emoji} ${severity.toUpperCase()} (${items.length})`);
    items.forEach(item => {
      sections.push(`**Page**: \`${item.page}\`  `);
      sections.push(`**Issue**: ${item.issue}  `);
      sections.push(`**Fix**: ${item.suggestion}\n`);
    });
  }

  return sections.join('\n');
}
