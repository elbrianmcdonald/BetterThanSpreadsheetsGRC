export default function CredentialsProvider(config: Record<string, unknown>) {
  return {
    id: 'credentials',
    name: 'Credentials',
    type: 'credentials',
    ...(config || {}),
  };
}
