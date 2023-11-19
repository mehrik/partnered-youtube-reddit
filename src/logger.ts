import pino from "pino";
import pretty from "pino-pretty";

export const logger = pino(
  {
    formatters: {
      level: (label) => {
        return { level: label.toUpperCase() };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.multistream([
    { stream: pino.destination("./debug.log") },
    { stream: pretty() },
  ])
);
