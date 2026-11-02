import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LANDING_DESCRIPTION,
  LANDING_ORIGIN,
  LANDING_TITLE,
  landingJsonLd,
  landingMetadata,
} from "./landing-seo";

describe("landing seo", () => {
  it("points search engines at the public domain", () => {
    assert.equal(LANDING_ORIGIN, "https://www.between-journal.ru");
    assert.equal(String(landingMetadata.metadataBase), `${LANDING_ORIGIN}/`);
    assert.equal(String(landingMetadata.alternates?.canonical), "/");
    assert.equal(
      landingMetadata.title && typeof landingMetadata.title === "object" && "absolute" in landingMetadata.title
        ? landingMetadata.title.absolute
        : "",
      LANDING_TITLE,
    );
    assert.equal(landingMetadata.description, LANDING_DESCRIPTION);
    assert.ok(LANDING_TITLE.length <= 70);
    assert.ok(LANDING_DESCRIPTION.length >= 80 && LANDING_DESCRIPTION.length <= 180);
    assert.equal(landingMetadata.openGraph?.locale, "ru_RU");
    assert.equal(landingMetadata.openGraph?.url, LANDING_ORIGIN);
  });

  it("describes the public page for crawlers", () => {
    const graph = JSON.parse(landingJsonLd()) as { "@graph": Array<{ "@type": string; url: string }> };
    assert.deepEqual(
      graph["@graph"].map((node) => node["@type"]),
      ["WebSite", "WebPage"],
    );
    assert.ok(graph["@graph"].every((node) => node.url === `${LANDING_ORIGIN}/`));
  });
});