declare module "virtual:funstack/root" {
  const Root: React.ComponentType<{ children: React.ReactNode }>;
  export default Root;
}
declare module "virtual:funstack/app" {
  const App: React.ComponentType;
  export default App;
}
declare module "virtual:funstack/config" {
  export const ssr: boolean;
}
