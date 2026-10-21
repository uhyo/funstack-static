// The dev-server HMR test edits the paragraph text below.
export default function HmrPage() {
  return (
    <div>
      <h1>HMR Test Page</h1>
      <p data-testid="page-id">hmr</p>
      <p data-testid="hmr-content">initial content</p>
    </div>
  );
}
