// -----------------------------------------------------------------------------
// Entry point: wires the Gladys SDK to the SMHI hub (src/app.js). No weather
// logic here. Handlers are registered before connect().
//
// Environment provided by the Gladys supervisor: GLADYS_HOST_API_URL,
// GLADYS_INTEGRATION_TOKEN, GLADYS_INTEGRATION_SELECTOR (read by the SDK),
// and TZ, the time zone of Gladys (days of the forecast).
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { registerHandlers } from './src/app.js';

const gladys = new GladysIntegration();
const app = registerHandlers(gladys);

gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal}, stopping`);
  app.stop();
});

logger.info('Starting the SMHI integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
