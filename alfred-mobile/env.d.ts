declare namespace NodeJS {
  interface ProcessEnv {
    readonly EXPO_PUBLIC_BACKEND_URL: string;
    readonly MOCK_MODE: string;
    readonly OPENAI_API_KEY: string;
  }
}
