import chalk from 'chalk';

export const logger = {
  info: (msg: string) => console.log(chalk.cyan('ℹ'), msg),
  success: (msg: string) => console.log(chalk.green('✓'), msg),
  warn: (msg: string) => console.warn(chalk.yellow('⚠'), msg),
  error: (msg: string) => console.error(chalk.red('✗'), msg),
  debug: (msg: string) => console.error(chalk.gray('[debug]'), msg),
  step: (msg: string) => console.log(chalk.bold.blue('→'), msg),
  dim: (msg: string) => console.log(chalk.dim(msg)),
};
