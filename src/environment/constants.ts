export const RENDERING_CONTEXT = {
  locale: "en-US",
  timezoneId: "America/Chicago",
  deviceScaleFactor: 1,
  colorScheme: "light" as const,
  reducedMotion: "no-preference" as const,
  forcedColors: "none" as const,
  contrast: "no-preference" as const,
  javaScriptEnabled: true,
  hasTouch: false,
  isMobile: false,
};

export const RENDERING_VIEWPORTS = [
  { label: "mobile" as const, width: 375, height: 812 },
  { label: "tablet" as const, width: 768, height: 1024 },
  { label: "desktop" as const, width: 1440, height: 900 },
];

export const PLAYWRIGHT_BROWSER = {
  engine: "chromium" as const,
  playwrightVersion: "1.62.1",
  browserRevision: "1234",
  browserVersion: "151.0.7922.34",
};
