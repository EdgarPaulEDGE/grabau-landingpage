/**
 * Strukturierte Daten (JSON-LD, schema.org).
 *
 * Zweck: Suchmaschinen und KI-Antwortsysteme sollen die Seite als
 * konkretes Standortangebot der WFL verstehen, nicht als beliebige
 * Textseite. Alle Werte kommen aus der zentralen Konfiguration, damit
 * Auszeichnung und sichtbarer Inhalt nie auseinanderlaufen.
 */

import {
  CONTACT,
  FACTS,
  FAQS,
  FLAECHEN,
  PLOTS,
  SITE_URL,
  STANDORT,
  m2,
} from "@/config/site";

/**
 * Anzahl freier Grundstücke aus dem Plan, Flächen-Spanne aus der
 * WFL-Übersicht. Dieselbe Spanne steht im sichtbaren Text, sonst sähe
 * Google in der Auszeichnung andere Zahlen als auf der Seite.
 */
function verfuegbarkeit() {
  return {
    anzahl: PLOTS.filter((p) => p.status === "verfuegbar").length,
    min: FLAECHEN.kleinste,
    max: FLAECHEN.groesste,
  };
}

/** Die WFL als Organisation, die das Angebot verantwortet. */
const organisation = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#wfl`,
  name: CONTACT.org,
  alternateName: "WFL",
  url: "https://wfl.de",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Junkernstraße 7",
    postalCode: "23909",
    addressLocality: "Ratzeburg",
    addressRegion: STANDORT.region,
    addressCountry: STANDORT.land,
  },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "Ansiedlung und Gewerbeflächen",
    name: CONTACT.name,
    telephone: CONTACT.phone,
    email: CONTACT.email,
    areaServed: "Kreis Herzogtum Lauenburg",
    availableLanguage: ["de"],
  },
};

/** Der Gewerbepark selbst als Ort mit Geo-Bezug. */
const ort = {
  "@type": "Place",
  "@id": `${SITE_URL}/#gewerbepark`,
  name: STANDORT.name,
  description:
    "Voll erschlossenes Gewerbegebiet (GE) direkt an der B207, 7 km zur A24 und rund 40 km vor Hamburg. Bebauungsplan rechtskräftig, Grundstücke sofort bebaubar.",
  address: {
    "@type": "PostalAddress",
    streetAddress: STANDORT.strasse,
    addressLocality: STANDORT.ort,
    addressRegion: STANDORT.region,
    addressCountry: STANDORT.land,
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: STANDORT.lat,
    longitude: STANDORT.lon,
  },
  publicAccess: false,
  isAccessibleForFree: false,
  additionalProperty: FACTS.map((f) => ({
    "@type": "PropertyValue",
    name: f.label,
    value: f.value,
  })),
};

/** Das Angebot: Gewerbegrundstücke zum Verkauf, Preis auf Anfrage. */
function angebot() {
  const { anzahl, min, max } = verfuegbarkeit();
  return {
    "@type": "Offer",
    "@id": `${SITE_URL}/#angebot`,
    name: "Gewerbegrundstücke im Gewerbepark Grabauer Ruhm",
    description: `${anzahl} sofort verfügbare, voll erschlossene Gewerbegrundstücke von ${m2(min)} bis ${m2(max)}, auf Anfrage teilweise parzellierbar.`,
    availability: "https://schema.org/InStock",
    businessFunction: "https://purl.org/goodrelations/v1#Sell",
    /* Preis bewusst ohne Betrag: der Quadratmeterpreis wird im
       persönlichen Gespräch genannt, es gibt keinen Listenpreis. */
    priceSpecification: {
      "@type": "PriceSpecification",
      priceCurrency: "EUR",
      description: "Quadratmeterpreis auf Anfrage",
    },
    areaServed: "Metropolregion Hamburg",
    seller: { "@id": `${SITE_URL}/#wfl` },
    availableAtOrFrom: { "@id": `${SITE_URL}/#gewerbepark` },
    url: `${SITE_URL}/#kontakt`,
  };
}

/** Die Seite selbst, verknüpft mit Ort, Angebot und Anbieter. */
const webseite = {
  "@type": "WebPage",
  "@id": `${SITE_URL}/#seite`,
  url: `${SITE_URL}/`,
  name: `${STANDORT.name} · Gewerbeflächen an der B207, 40 Minuten vor Hamburg`,
  inLanguage: "de-DE",
  about: { "@id": `${SITE_URL}/#gewerbepark` },
  publisher: { "@id": `${SITE_URL}/#wfl` },
  primaryImageOfPage: `${SITE_URL}/img/hero-aerial.jpg`,
};

/** Die sichtbaren FAQ als FAQPage, 1:1 aus derselben Quelle. */
const faq = {
  "@type": "FAQPage",
  "@id": `${SITE_URL}/#faq`,
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

/** Vollständiger Graph für das JSON-LD-Skript im Dokumentkopf. */
export function baueSchemaGraph() {
  return {
    "@context": "https://schema.org",
    "@graph": [organisation, ort, angebot(), webseite, faq],
  };
}
