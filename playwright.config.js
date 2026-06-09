const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',

  timeout: 60000,

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.js/
    },
    {
      name: 'testes-logado',
      dependencies: ['setup'],
      use: {
        storageState: 'tests/.auth/session.json',
        headless: false,
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        trace: 'retain-on-failure',
        viewport: {
          width: 1366,
          height: 768
        }
      }
    }
  ]
});