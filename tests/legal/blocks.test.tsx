/**
 * @file tests/legal/blocks.test.tsx
 * @desc Every legal block renders its config's values (contact, stores, cookies, processors,
 *       rights, agent, warranty, effective date) and the output has no em dash.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  Changes,
  DataWeKeep,
  DmcaNotice,
  LegalContact,
  NoWarranty,
  Processors,
  YourRights,
} from "../../src/legal/blocks.js";
import type { LegalSite } from "../../src/legal/types.js";

afterEach(cleanup);

const SITE: LegalSite = {
  siteName: "example.test",
  operator: "Example Co",
  contactEmail: "legal@example.test",
  effectiveDate: "2026-10-05",
  stores: [{ what: "account id", why: "to know who signed in" }],
  processors: [{ name: "Vercel", purpose: "hosts the site", link: "https://vercel.com" }],
  cookies: ["session, HttpOnly, keeps you signed in"],
};

const BLOCKS = {
  LegalContact,
  DataWeKeep,
  Processors,
  YourRights,
  DmcaNotice,
  NoWarranty,
  Changes,
};

it.each(Object.entries(BLOCKS))("%s has no em dash", (_name, Block) => {
  const { container } = render(<Block site={SITE} />);
  expect(container.textContent).not.toContain("—");
});

describe("LegalContact", () => {
  it("names the operator and contact email", () => {
    render(<LegalContact site={SITE} />);
    expect(screen.getByText(/Example Co runs example\.test/)).toBeTruthy();
    expect(screen.getByText("legal@example.test").closest("a")).toHaveProperty(
      "href",
      "mailto:legal@example.test",
    );
  });
});

describe("DataWeKeep", () => {
  it("lists every store and cookie", () => {
    render(<DataWeKeep site={SITE} />);
    expect(screen.getByText(/to know who signed in/)).toBeTruthy();
    expect(screen.getByText(/keeps you signed in/)).toBeTruthy();
  });

  it("omits the cookies heading when there are none", () => {
    render(<DataWeKeep site={{ ...SITE, cookies: [] }} />);
    expect(screen.queryByText("Cookies")).toBeNull();
  });
});

describe("Processors", () => {
  it("links a processor that has one, and plain-texts one that doesn't", () => {
    render(
      <Processors
        site={{
          ...SITE,
          processors: [
            { name: "Vercel", purpose: "hosts the site", link: "https://vercel.com" },
            { name: "MongoDB Atlas", purpose: "stores the data" },
          ],
        }}
      />,
    );
    expect(screen.getByText("Vercel").closest("a")).toHaveProperty("href", "https://vercel.com/");
    expect(screen.getByText("MongoDB Atlas").closest("a")).toBeNull();
  });
});

describe("YourRights", () => {
  it("names the GDPR and CCPA rights and the contact email", () => {
    render(<YourRights site={SITE} />);
    expect(screen.getByText(/Erasure/)).toBeTruthy();
    expect(screen.getByText(/Global Privacy Control/)).toBeTruthy();
    expect(screen.getByText("legal@example.test")).toBeTruthy();
  });
});

describe("DmcaNotice", () => {
  it("names the agent and the no-hosting line", () => {
    render(<DmcaNotice site={SITE} />);
    expect(screen.getByText(/example\.test hosts no files/)).toBeTruthy();
    expect(screen.getByText("legal@example.test")).toBeTruthy();
  });
});

describe("NoWarranty", () => {
  it("names the site and operator", () => {
    render(<NoWarranty site={SITE} />);
    expect(screen.getByText(/example\.test is provided "as is"/)).toBeTruthy();
    expect(screen.getByText(/Example Co is not liable/)).toBeTruthy();
  });
});

describe("Changes", () => {
  it("shows the effective date", () => {
    render(<Changes site={SITE} />);
    expect(screen.getByText(/2026-10-05/)).toBeTruthy();
  });
});
