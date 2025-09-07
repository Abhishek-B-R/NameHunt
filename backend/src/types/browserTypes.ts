export type ProxyOpts = {
  server: string;
  username?: string;
  password?: string;
};

export type StealthOpts = {
  profileDir: string;
  headless?: boolean;
  locale?: string;
  timezoneId?: string;
  proxy?: ProxyOpts;
  userAgent?: string;
};
