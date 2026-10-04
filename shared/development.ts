export const developmentPorts = { frontend: 6767, backend: 6768 } as const;
export const developmentOrigins = {
  frontend: `http://localhost:${developmentPorts.frontend}`,
  backend: `http://localhost:${developmentPorts.backend}`,
} as const;
