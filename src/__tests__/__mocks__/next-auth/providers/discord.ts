/**
 * Mock Discord Provider for Tests
 *
 * Provides a mock Discord provider for NextAuth testing.
 * Prevents ES module issues with the real next-auth/providers/discord package.
 */

export default function DiscordProvider(config: any) {
  return {
    id: "discord",
    name: "Discord",
    type: "oauth",
    authorization: "https://discord.com/api/oauth2/authorize?scope=identify+email",
    token: "https://discord.com/api/oauth2/token",
    userinfo: "https://discord.com/api/users/@me",
    ...config,
  };
}
