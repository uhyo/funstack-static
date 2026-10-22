import { Outlet } from "@funstack/router";

export default function DashboardLayout() {
  return (
    <section>
      <p data-testid="dashboard-layout">dashboard-layout</p>
      <Outlet />
    </section>
  );
}
