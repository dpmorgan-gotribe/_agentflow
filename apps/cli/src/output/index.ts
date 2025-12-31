/**
 * Output Module
 *
 * Exports output utilities for the CLI.
 */

export { Spinner, createSpinner, type SpinnerState } from './spinner.js';

export {
  formatTable,
  truncate,
  formatKeyValue,
  type TableColumn,
} from './table.js';

export {
  StreamHandler,
  createStreamHandler,
  type StreamHandlerOptions,
} from './stream-handler.js';
