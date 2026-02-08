import { Link } from "react-router-dom";

export default function Privacy() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <Link to="/" className="text-sm text-text-muted hover:text-foreground transition-colors">
          ← Back to home
        </Link>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-text-muted">Last updated: February 2, 2026</p>

        <div className="mt-10 space-y-6 text-text-secondary leading-relaxed">
          <p>
            This Privacy Policy explains how SMMAHUB collects, uses, and protects information when you visit our website
            or use our services.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Information We Collect</h2>
            <p className="mt-2">
              We may collect information you provide directly (for example, when you book a call or contact us) and
              limited usage data to improve the product.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">How We Use Information</h2>
            <ul className="mt-2 list-disc pl-6 space-y-2">
              <li>Provide and improve the service</li>
              <li>Respond to inquiries and support requests</li>
              <li>Measure and improve website performance</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Data Protection</h2>
            <p className="mt-2">
              We use encryption in transit and at rest and enforce strict tenant isolation. We do not train models on
              your proprietary data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Contact</h2>
            <p className="mt-2">
              Questions? Email{" "}
              <a className="text-brand-primary hover:underline" href="mailto:contact@smmahub.com">
                contact@smmahub.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

