import { thinkWithQA } from './models';
import { runAllFlows } from './flowRunner';
import { buildCodeContext } from './codeReader';
import { saveReport, printSummary, generateRunId, QAReport } from './qaReporter';
import { simulateUserJourney, formatUXFindings } from './uxSimulator';
import { generateImprovements, suggestNewFeatures } from './selfImprover';

async function main() {
  const runId = generateRunId();
  console.log(`\n🧠 Cortex Auto-QA Agent — Run: ${runId}\n`);

  // 1. Read entire codebase into context
  console.log('📖 Reading codebase...');
  const codeContext = buildCodeContext();
  console.log(`   ${codeContext.length} chars of context loaded`);

  // 2. Run all API flows
  console.log('\n🚀 Running API flows...');
  const flowResults = await runAllFlows();

  // 3. Simulate end-user UX journeys
  console.log('\n👤 Simulating user journeys...');
  const { findings: uxFindings, summary: uxSummary } = await simulateUserJourney(codeContext);
  console.log(`   ${uxFindings.length} UX issues found`);

  const failedFlows = flowResults.filter(r => r.status === 'fail');
  const passedFlows = flowResults.filter(r => r.status === 'pass');

  // 4. AI analysis of all failures
  console.log('\n🔍 Running AI QA analysis...');
  const aiAnalysis = await thinkWithQA(`
Cortex QA Run: ${runId}

Failed flows (${failedFlows.length}):
${failedFlows.map(f => `- ${f.flow}: ${f.error}`).join('\n') || 'None'}

UX Issues (${uxFindings.length}):
${uxFindings.map(f => `- [${f.severity}] ${f.page}: ${f.issue}`).join('\n') || 'None'}

Write a structured QA analysis covering:
1. Root causes of API failures
2. RBAC edge cases that may be untested
3. Offline sync potential conflicts
4. JWT/auth flow vulnerabilities
5. WebSocket reconnect scenarios
6. Stripe webhook edge cases
`);

  // 5. Generate code fix stubs + feature suggestions
  console.log('\n🩹 Generating fix stubs...');
  const improvements = await generateImprovements(failedFlows, uxFindings, codeContext);

  console.log('\n💡 Generating feature suggestions...');
  const newFeatures = await suggestNewFeatures(codeContext);

  // 6. Build and save full report
  const report: QAReport = {
    runId,
    timestamp: new Date().toISOString(),
    totalFlows: flowResults.length,
    passed: passedFlows.length,
    failed: failedFlows.length,
    skipped: flowResults.filter(r => r.status === 'skip').length,
    flowResults,
    aiAnalysis,
    fixStubs: improvements,
    uxFeedback: `${formatUXFindings(uxFindings)}\n\n### User Experience Summary\n${uxSummary}`,
    selfImprovements: newFeatures,
  };

  saveReport(report);
  printSummary(report);
}

main().catch(console.error);
