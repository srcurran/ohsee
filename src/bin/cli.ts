import { Command } from 'commander';
import { runCompare } from '../commands/compare.js';
import { ViewportName, CompareOptions } from '../types/index.js';
import { logger } from '../utils/logger.js';

const DEFAULT_MODEL = 'claude-sonnet-4-6-20260217';
const VALID_VIEWPORTS: ViewportName[] = ['mobile', 'tablet', 'laptop', 'desktop'];

const program = new Command();

program
  .name('ohsee')
  .description('Visual and structural URL comparison tool')
  .version('0.1.0');

program
  .command('compare <url1> <url2>')
  .description('Compare two URLs visually and structurally')
  .option('-o, --output <path>', 'Output directory path (default: ~/ohsee/YYYYMMDD--<slug>)')
  .option(
    '-w, --viewports <names>',
    'Comma-separated viewports to capture',
    'mobile,tablet,laptop,desktop',
  )
  .option('--wait <ms>', 'Extra wait time after networkidle (ms)', '0')
  .option('--model <model-id>', 'Claude model to use', DEFAULT_MODEL)
  .option('--no-ai', 'Skip Claude API — use pixel diff + structural diff only (no API key needed)')
  .option('--debug', 'Log raw Claude responses to stderr', false)
  .option('--no-open', 'Skip auto-opening report in browser')
  .action(async (url1: string, url2: string, opts: Record<string, string | boolean>) => {
    // Commander turns --no-ai into opts.ai === false
    const noAi = opts.ai === false;

    // Validate API key only if AI mode is active
    if (!noAi && !process.env.ANTHROPIC_API_KEY) {
      logger.error('ANTHROPIC_API_KEY environment variable is not set.');
      logger.dim('  export ANTHROPIC_API_KEY=your-key');
      logger.dim('  Or run with --no-ai to skip Claude analysis entirely.');
      process.exit(1);
    }

    // Validate URLs
    for (const url of [url1, url2]) {
      try {
        new URL(url);
      } catch {
        logger.error(`Invalid URL: ${url}`);
        process.exit(1);
      }
    }

    // Parse viewports
    const viewportArg = (opts.viewports as string) ?? 'mobile,tablet,laptop,desktop';
    const requestedViewports = viewportArg.split(',').map((v) => v.trim()) as ViewportName[];
    const invalidViewports = requestedViewports.filter((v) => !VALID_VIEWPORTS.includes(v));
    if (invalidViewports.length > 0) {
      logger.error(`Invalid viewport(s): ${invalidViewports.join(', ')}`);
      logger.dim(`  Valid options: ${VALID_VIEWPORTS.join(', ')}`);
      process.exit(1);
    }

    const options: CompareOptions = {
      output: opts.output as string | undefined,
      viewports: requestedViewports,
      wait: parseInt((opts.wait as string) ?? '0', 10),
      model: (opts.model as string) ?? DEFAULT_MODEL,
      debug: Boolean(opts.debug),
      open: opts.open !== false,
      noAi,
    };

    logger.step('Comparing:');
    logger.dim(`  URL 1: ${url1}`);
    logger.dim(`  URL 2: ${url2}`);
    logger.dim(`  Viewports: ${requestedViewports.join(', ')}`);
    logger.dim(`  Mode: ${noAi ? 'pixel diff (no AI)' : `Claude · ${options.model}`}`);
    console.log();

    try {
      await runCompare(url1, url2, options);
    } catch (err) {
      logger.error(`Compare failed: ${err instanceof Error ? err.message : String(err)}`);
      if (options.debug && err instanceof Error) {
        console.error(err.stack);
      }
      process.exit(1);
    }
  });

program.parse(process.argv);
