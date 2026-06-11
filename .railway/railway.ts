import {
  defineRailway,
  github,
  postgres,
  redis,
  service,
  project,
  preserve
} from "railway/iac";

export default defineRailway(() => {
  const db = postgres("Postgres");
  const cache = redis("Redis");

  const api = service("@leadfetcher/api", {
    source: github("humble900/leadfetcher", { branch: "master" }),
    build: "npm run build:api",
    start: "npm run start:api",
    env: {
      PORT: "4000",
      NODE_ENV: "production",
      DATABASE_URL: db.env.DATABASE_URL,
      REDIS_URL: cache.env.REDIS_URL,
      JWT_SECRET: preserve(),
      JWT_EXPIRES_IN: "7d",
      CORS_ORIGIN: preserve(),
      SUPER_ADMIN_EMAIL: "admin@leadfetcher.com",
      SUPER_ADMIN_PASSWORD: preserve(),
    },
  });

  const worker = service("@leadfetcher/worker", {
    source: github("humble900/leadfetcher", { branch: "master" }),
    build: "npm run build:worker",
    start: "npm run start:worker",
    env: {
      NODE_ENV: "production",
      DATABASE_URL: db.env.DATABASE_URL,
      REDIS_URL: cache.env.REDIS_URL,
      WORKER_CONCURRENCY: "2",
    },
  });

  const dashboard = service("dashboard", {
    source: github("humble900/leadfetcher", { branch: "master" }),
    build: "npm run build:dashboard",
    start: "npm run start:dashboard",
    env: {
      NEXT_PUBLIC_API_URL: preserve(),
      PORT: "3000",
      NODE_ENV: "production",
    },
  });

  return project("considerate-growth", {
    resources: [db, cache, api, worker, dashboard],
  });
});
