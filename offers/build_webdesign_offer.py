#!/usr/bin/env python3
"""Offer Builder v7 - Webdesign-Agentur OHNE Performance-Kanal."""

from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

# ============================================================
# DATA: Webdesign-Agentur OHNE Performance-Kanal
# Angle: CONVERSION-GARANTIE auf bestehenden Traffic
# ============================================================
data = {
    "zielgruppe": "Webdesign-Agenturen ohne Performance-Kanal",
    "zielgruppe_kurz": "Webdesign-Agentur",
    "problem": "Kein Lead-Versprechen möglich — Webdesign wirkt austauschbar",
    "dienstleistung": "High-Converting Website — Done-4-You",
    # Seite 2: Zielgruppe + Problemanalyse
    "zielgruppe_kontext": "Webdesign-Agenturen und Freelancer ohne eigenen Performance-Kanal verkaufen ihre Endkunden (KMU, Handwerker, Dienstleister) eine Website — ohne Lead-Garantie geben zu können. Ihre Konkurrenz (Ads-Agenturen) verspricht 'X Anfragen garantiert', sie selbst können nur 'schönes Design' bieten. Das Resultat: Preisdruck, längere Sales-Zyklen, austauschbare Angebote.",
    "markt_situation": "Reine Webdesign-Agenturen verlieren systematisch gegen Performance-Agenturen — weil 'schöne Website' kein verkaufbares Outcome mehr ist. Aber: 80% aller KMU haben bereits Traffic (Empfehlungen, Google, Social) der nicht konvertiert. Wer eine Website bauen kann, die diesen bestehenden Traffic 3-5x besser in Anfragen umwandelt, hat ein verkaufbares, garantierbares Outcome — ohne selbst Ads schalten zu müssen.",
    "pains": [
        "Konkurrenz (Ads-Agenturen) verspricht Leads garantiert, du kannst nur Design versprechen",
        "Kunden vergleichen dich mit 500€ Wix-Builder — Preis wird zum Hauptthema",
        "Lange Sales-Zyklen weil Outcome unklar ist (‘schöne Website’ ist kein ROI)",
        "Keine messbare Erfolgsmetrik nach Launch — Kunde sieht nicht was deine Arbeit gebracht hat",
        "Keine Empfehlungen weil Kunden nicht wissen ob die Website wirklich was bringt",
        "Du verkaufst Stunden statt Ergebnisse — keine Skalierbarkeit, keine Premium-Preise",
    ],
    # Seite 3: Value Equation
    "dream_outcome": "Eine Website, die aus dem bestehenden Traffic des Kunden (Empfehlungen, Google, Social) mindestens 2-3x mehr qualifizierte Anfragen generiert als die alte Seite — messbar, garantiert, in 21 Tagen live.",
    "dream_outcome_kurz": "2-3x mehr Anfragen aus bestehendem Traffic",
    "likelihood_text": "Conversion-Optimierung folgt klaren Regeln (Above-the-Fold, Social Proof, Trust-Elements, klarer CTA). Bewiesenes Framework — keine Designer-Kunst, sondern Conversion-Handwerk. Vorher-Nachher-Tracking macht das Ergebnis nachweisbar.",
    "likelihood_proof": [
        "Conversion-Framework basiert auf 100+ getesteten Websites",
        "Vorher-Nachher Tracking ab Tag 1 — Ergebnis ist messbar",
        "Klare Regeln statt Geschmacksdesign — reproduzierbares Ergebnis",
    ],
    "time_delay_text": "Live in 21 Tagen — statt 3-6 Monaten wie bei klassischen Agenturen. Keine endlosen Feedback-Schleifen, sondern klarer Sprint-Prozess mit fixen Milestones.",
    "time_milestones": [
        ("Tag 1-7", "Audit, Strategie, Wireframes"),
        ("Tag 8-14", "Design, Copy, Build"),
        ("Tag 15-21", "Launch, Tracking, Übergabe"),
    ],
    "effort_text": "Kompletter Done-4-You Prozess. Dein Kunde liefert Logo, Bilder, ein Onboarding-Call — max. 2 Stunden Eigenaufwand. Den Rest übernehmt ihr: Copy, Design, Tech, Tracking, Launch.",
    "effort_items": [
        "Max. 2h Aufwand für den Kunden insgesamt",
        "Copy + Design + Tech — alles aus einer Hand",
        "Klarer Sprint-Prozess statt endloser Feedback-Schleifen",
    ],
    # Seite 2: Process Flow
    "input_line1": "Alte Website mit",
    "input_line2": "schlechter Conversion",
    "process_line1": "Conversion-Framework",
    "process_line2": "+ Speed-Garantie",
    "output_result": "2-3x mehr Anfragen",
    "output_sub": "aus gleichem Traffic",
    "promise_headline": "Mindestens 2x mehr Anfragen — garantiert",
    "promise_sub": "Aus dem gleichen Traffic. In 21 Tagen live. Sonst arbeiten wir kostenlos weiter.",
    # Seite 4: Value Stack
    "value_stack": [
        ("01", "Conversion Audit", "Was bremst die alte Website", "1.500€"),
        ("02", "Positioning & Copy", "Sales-driven Texte die verkaufen", "2.500€"),
        ("03", "Premium UX/Design", "Mobile-first, ladeoptimiert", "3.500€"),
        ("04", "Tech & Speed Setup", "Unter 2s Ladezeit garantiert", "1.500€"),
        ("05", "Tracking & Analytics", "Conversion sichtbar machen", "1.000€"),
        ("06", "21-Tage Sprint-Prozess", "Live statt monatelange Schleifen", "2.000€"),
    ],
    "value_stack_erklaerung": "Sechs Bausteine, die zusammen aus einer austauschbaren Website ein messbares Conversion-Asset machen. Jeder Baustein löst ein konkretes Hindernis das verhindert dass die alte Website Anfragen produziert.",
    "gesamtwert": "12.000€+",
    # Seite 5: Preis + Garantie + Verstärker
    "preisanker": [
        ("Inhouse Webdesigner einstellen", "4.500–6.000€/Mo"),
        ("Klassische Agentur (3-6 Monate)", "15.000–30.000€"),
    ],
    "preis_range": "4.500 – 9.500€",
    "preis_hinweis": "Einmalig · Optional Pflege-Retainer ab 290€/Mo",
    "roi_rechnung": "Aktuell 2 Anfragen/Mo × Auftragswert 5.000€ → nach Launch 5+ Anfragen/Mo",
    "roi_ergebnis": "= +15.000€/Mo Pipeline",
    "garantie_name": "2x Conversion-Garantie",
    "garantie_zeile1": "„Deine neue Website bringt nicht mindestens 2x mehr Anfragen",
    "garantie_zeile2": "aus dem gleichen Traffic? Wir arbeiten kostenlos weiter bis sie es tut.“",
    "garantie_erklaerung": "Eine reine Webdesign-Agentur kann keine Lead-Garantie geben (kein Trafficmotor). Aber sie kann die Conversion-Rate des bestehenden Traffics garantieren — das ist ehrlich, messbar und stark. Gemessen wird Anfragen pro 100 Besucher (alte Seite vs. neue Seite, gleicher Tracking-Zeitraum).",
    "garantie_vorteile": [
        "Ehrlich machbar — du versprühst nichts was du nicht halten kannst",
        "Messbar — Conversion-Rate ist eine harte Zahl",
        "Differenziert dich von 95% der Webdesign-Konkurrenz",
    ],
    # Psychologische Verstärker
    "scarcity": "Maximal 3 Website-Projekte pro Monat — weil der 21-Tage-Sprint volle Konzentration braucht. Keine Massenabfertigung, kein Outsourcing, jedes Projekt mit fixem Senior-Team.",
    "urgency": "Bonus-Paket (Conversion-Audit + 90 Tage Performance-Tracking im Wert von 2.500€) nur bei Vertragsabschluss innerhalb von 7 Tagen nach dem Strategie-Call.",
    "bonuses": [
        ("Conversion-Audit der alten Seite", "Zeigt sofort wo die Anfragen liegenbleiben", "1.500€"),
        ("90-Tage Performance-Tracking", "Wir messen das Ergebnis 3 Monate", "1.000€"),
        ("Lead-Magnet + Funnel-Setup", "PDF Download → E-Mail → Anfrage", "1.500€"),
    ],
    # Seite 7: 3 fertige Offer-Formulierungen
    "offer_varianten": [
        {
            "name": "Conversion-Offer",
            "kurz": "Wir bauen dir eine Website die deinen bestehenden Traffic mindestens 2x besser in Anfragen umwandelt. In 21 Tagen live. Garantiert 2x mehr Anfragen oder wir arbeiten kostenlos weiter bis das Ergebnis steht.",
            "lang": "Du hast Traffic auf deiner Website durch Empfehlungen, Google und Social aber nur ein Bruchteil davon wird zur Anfrage. Wir bauen dir eine Website die genau das ändert. Mit unserem Conversion-Framework verwandeln wir deinen bestehenden Traffic in mindestens doppelt so viele qualifizierte Anfragen. Komplett Done 4 You in 21 Tagen live. Nach 90 Tagen messen wir gegen die alte Seite. Erreichen wir nicht mindestens 2x Anfragen aus gleichem Traffic, arbeiten wir kostenlos weiter bis das Ergebnis steht.",
        },
        {
            "name": "Premium-Positioning Offer",
            "kurz": "Wir bauen dir eine Website mit der du höhere Preise verlangen kannst ohne dass Kunden verhandeln. Garantiert 30% mehr akzeptierte Angebote in 90 Tagen oder du bekommst dein Geld zurück.",
            "lang": "Wenn deine Website aussieht wie aus 2015 zahlen Kunden Preise von 2015. Wir positionieren dich als Premium Anbieter in deiner Nische. Mit klarer Botschaft, Trust Elementen, Cases und Pricing Page die deinen Wert sofort sichtbar macht. Das Ergebnis: Kunden akzeptieren höhere Angebote ohne zu verhandeln. Wir garantieren mindestens 30% mehr akzeptierte Angebote in den ersten 90 Tagen nach Launch. Sonst bekommst du dein komplettes Investment zurück.",
            "highlight": True,
        },
        {
            "name": "Speed Sprint Offer",
            "kurz": "Hochkonvertierende Premium Website in 21 Tagen live. Komplett Done 4 You mit max 2 Stunden Aufwand für dich. Nicht pünktlich live? Du bekommst pro Woche Verspätung 500€ Rabatt zurück.",
            "lang": "Schluss mit Webdesign Projekten die 6 Monate dauern und dann doch nicht konvertieren. Unser 21 Tage Sprint Prozess macht aus deiner alten Seite eine Premium Website mit klarem Conversion Fokus. Copy, Design, Tech, Tracking alles aus einer Hand. Du investierst maximal 2 Stunden Zeit insgesamt. Nach Tag 21 ist die Seite live oder du bekommst pro Woche Verspätung 500€ zurück. Ehrliche Speed Garantie statt vager Versprechen.",
        },
    ],
}

# ============================================================
# AB HIER NICHTS AENDERN
# ============================================================
BG_DARK = HexColor("#0d1521")
BG_WHITE = HexColor("#ffffff")
ACCENT = HexColor("#3b82f6")
ACCENT_LIGHT = HexColor("#60a5fa")
DARK_TEXT = HexColor("#111827")
BODY_TEXT = HexColor("#374151")
MUTED = HexColor("#6b7280")
BORDER = HexColor("#e5e7eb")
GREEN = HexColor("#10b981")
RED = HexColor("#ef4444")
CARD_BG = HexColor("#f8fafc")
DARK_CARD = HexColor("#1a2536")
HEADER_DARK = HexColor("#0f1926")
SUBTLE_LINE = HexColor("#1e3a5f")
WHITE = HexColor("#ffffff")
ORANGE = HexColor("#f59e0b")

WIDTH, HEIGHT = A4
LEFT = 50 * mm
RIGHT = WIDTH - 35 * mm
CW = RIGHT - LEFT
FOOTER_Y = 12 * mm


class OfferPDF:
    def __init__(self, filename, d):
        self.filename = filename
        self.c = canvas.Canvas(filename, pagesize=A4)
        self.pn = 0
        self.d = d

    def _bg(self, color):
        self.c.setFillColor(color)
        self.c.rect(0, 0, WIDTH, HEIGHT, fill=1, stroke=0)

    def _wrap(self, text, font, size, max_w):
        words = text.split()
        lines, cur = [], ""
        for w in words:
            test = (cur + " " + w) if cur else w
            if self.c.stringWidth(test, font, size) <= max_w:
                cur = test
            else:
                if cur:
                    lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)
        return lines

    def _dw(self, text, x, y, font, size, color, max_w, lh=4 * mm):
        self.c.setFont(font, size)
        self.c.setFillColor(color)
        for line in self._wrap(text, font, size, max_w):
            self.c.drawString(x, y, line)
            y -= lh
        return y

    def _footer(self):
        self.pn += 1
        y = FOOTER_Y
        self.c.setFont("Helvetica-Bold", 7.5)
        self.c.setFillColor(ACCENT)
        self.c.drawString(LEFT, y, "C O N S U L T I N G - O G")
        self.c.setFont("Helvetica", 7.5)
        self.c.setFillColor(MUTED)
        t = "Offer-Strategie — " + self.d["zielgruppe_kurz"]
        self.c.drawCentredString(WIDTH / 2, y, t)
        self.c.drawRightString(RIGHT, y, f"{self.pn:02d}")

    def _footer_dark(self):
        self.pn += 1
        y = FOOTER_Y
        self.c.setFont("Helvetica-Bold", 7.5)
        self.c.setFillColor(HexColor("#2a3a4f"))
        self.c.drawString(LEFT, y, "C O N S U L T I N G - O G")
        self.c.setFont("Helvetica", 7.5)
        self.c.setFillColor(HexColor("#4b5563"))
        self.c.drawRightString(RIGHT, y, f"{self.pn:02d}")

    def _hband(self, badge, title, subtitle):
        bh = 75 * mm
        self.c.setFillColor(HEADER_DARK)
        self.c.rect(0, HEIGHT - bh, WIDTH, bh, fill=1, stroke=0)
        y = HEIGHT - 28 * mm
        bw = max(len(badge) * 2.5 + 10, 22) * mm
        badge_h = 7.5 * mm
        self.c.setFillColor(ACCENT)
        self.c.roundRect(LEFT, y - badge_h / 2, bw, badge_h, 3.5 * mm, fill=1, stroke=0)
        self.c.setFillColor(WHITE)
        self.c.setFont("Helvetica-Bold", 7.5)
        self.c.drawCentredString(LEFT + bw / 2, y - 1.1 * mm, badge.upper())
        y -= 18 * mm
        self.c.setFillColor(WHITE)
        self.c.setFont("Helvetica-Bold", 24)
        self.c.drawString(LEFT, y, title)
        y -= 11 * mm
        self.c.setFillColor(ACCENT_LIGHT)
        self.c.setFont("Helvetica-Oblique", 10)
        self.c.drawString(LEFT, y, subtitle)
        y -= 8 * mm
        self.c.setStrokeColor(SUBTLE_LINE)
        self.c.setLineWidth(1.5)
        self.c.line(LEFT, y, RIGHT, y)
        return HEIGHT - bh

    def _sl(self, text, y):
        parts = text.upper().split()
        spaced = "    ".join("  ".join(p) for p in parts)
        self.c.setFillColor(ACCENT)
        self.c.setFont("Helvetica-Bold", 8.5)
        self.c.drawString(LEFT, y, spaced)
        self.c.setStrokeColor(ACCENT)
        self.c.setLineWidth(2)
        self.c.line(LEFT, y - 4 * mm, LEFT + 28 * mm, y - 4 * mm)

    def _card(self, x, y, w, h, bg=CARD_BG, border=True):
        self.c.setFillColor(bg)
        if border:
            self.c.setStrokeColor(BORDER)
            self.c.setLineWidth(0.5)
            self.c.roundRect(x, y, w, h, 3 * mm, fill=1, stroke=1)
        else:
            self.c.roundRect(x, y, w, h, 3 * mm, fill=1, stroke=0)

    def _dcard(self, x, y, w, h):
        self.c.setFillColor(DARK_CARD)
        self.c.roundRect(x, y, w, h, 3 * mm, fill=1, stroke=0)

    def _badge_sm(self, text, x, y, w=9 * mm, h=5.5 * mm):
        self.c.setFillColor(ACCENT)
        self.c.roundRect(x, y - h / 2, w, h, 2.5 * mm, fill=1, stroke=0)
        self.c.setFillColor(WHITE)
        self.c.setFont("Helvetica-Bold", 7.5)
        self.c.drawCentredString(x + w / 2, y - 1.1 * mm, text)

    def page_cover(self):
        self._bg(BG_DARK)
        y = HEIGHT - 85 * mm
        self.c.setFillColor(MUTED)
        self.c.setFont("Helvetica", 10)
        self.c.drawCentredString(WIDTH / 2, y, "C O N S U L T I N G - O G")
        y -= 22 * mm
        self.c.setFillColor(ACCENT)
        self.c.setFont("Helvetica-Bold", 9.5)
        self.c.drawCentredString(WIDTH / 2, y, "G R A N D   S L A M   O F F E R")
        y -= 10 * mm
        self.c.setStrokeColor(SUBTLE_LINE)
        self.c.setLineWidth(1)
        self.c.line(WIDTH / 2 - 30 * mm, y, WIDTH / 2 + 30 * mm, y)
        y -= 20 * mm
        self.c.setFillColor(WHITE)
        self.c.setFont("Helvetica-Bold", 30)
        self.c.drawCentredString(WIDTH / 2, y, "Dein Offer")
        y -= 15 * mm
        self.c.setFont("Helvetica-Bold", 22)
        self.c.drawCentredString(WIDTH / 2, y, "für " + self.d["zielgruppe_kurz"])
        y -= 18 * mm
        self.c.setFillColor(ACCENT_LIGHT)
        self.c.setFont("Helvetica", 10)
        self.c.drawCentredString(WIDTH / 2, y, "Zielgruppe: " + self.d["zielgruppe"])
        y -= 7 * mm
        self.c.drawCentredString(WIDTH / 2, y, "Problem: " + self.d["problem"])
        y -= 7 * mm
        self.c.drawCentredString(WIDTH / 2, y, "Dienstleistung: " + self.d["dienstleistung"])
        y -= 16 * mm
        self.c.setFillColor(HexColor("#4b5563"))
        self.c.setFont("Helvetica", 8)
        self.c.drawCentredString(WIDTH / 2, y,
            "Zielgruppe  |  Value Equation  |  Value Stack  |  Preisgestaltung")
        y -= 5 * mm
        self.c.drawCentredString(WIDTH / 2, y,
            "Garantie  |  Verstärker  |  3 Offer-Formulierungen")
        y_b = 65 * mm
        self.c.setFillColor(HexColor("#4b5563"))
        self.c.setFont("Helvetica", 9)
        self.c.drawCentredString(WIDTH / 2, y_b, "Erstellt von Consulting-OG  |  consulting-og.de")
        y_b -= 10 * mm
        self.c.setFont("Helvetica", 8)
        self.c.setFillColor(HexColor("#374151"))
        self.c.drawCentredString(WIDTH / 2, y_b,
            "Basierend auf dem Grand Slam Offer Framework von Alex Hormozi.")
        y_b -= 6 * mm
        self.c.drawCentredString(WIDTH / 2, y_b,
            "Nutze dieses Offer als Grundlage für deine Ads, Landingpages und Sales-Gespräche.")
        self._footer_dark()
        self.c.showPage()

    def page_zielgruppe(self):
        self._bg(BG_WHITE)
        cs = self._hband("ANALYSE", "Zielgruppe & Problemanalyse",
            "„Verstehe das Problem besser als dein Kunde selbst.“")
        y = cs - 14 * mm
        pad = 6 * mm

        kontext_lines = self._wrap(self.d["zielgruppe_kontext"], "Helvetica", 8.5, CW - 2 * pad)
        markt_lines = self._wrap(self.d["markt_situation"], "Helvetica", 8.5, CW - 2 * pad)
        zg_h = (len(kontext_lines) + len(markt_lines)) * 3.8 * mm + 22 * mm
        self._card(LEFT, y - zg_h, CW, zg_h, bg=HexColor("#f8fafc"))
        zy = y - 5 * mm
        self.c.setFillColor(ACCENT)
        self.c.setFont("Helvetica-Bold", 7)
        self.c.drawString(LEFT + pad, zy, "D E I N E   Z I E L G R U P P E")
        zy -= 7 * mm
        self.c.setFillColor(DARK_TEXT)
        self.c.setFont("Helvetica-Bold", 14)
        self.c.drawString(LEFT + pad, zy, self.d["zielgruppe"])
        zy -= 7 * mm
        zy = self._dw(self.d["zielgruppe_kontext"],
            LEFT + pad, zy, "Helvetica", 8.5, MUTED, CW - 2 * pad, 3.8 * mm)
        zy -= 2 * mm
        zy = self._dw(self.d["markt_situation"],
            LEFT + pad, zy, "Helvetica", 8.5, BODY_TEXT, CW - 2 * pad, 3.8 * mm)

        y -= zg_h + 10 * mm

        pain_total_lines = 0
        for p in self.d["pains"]:
            pain_total_lines += max(1, len(self._wrap(p, "Helvetica", 8.5, CW - 2 * pad - 8 * mm)))
        pain_h = pain_total_lines * 4 * mm + 6 * len(self.d["pains"]) + 14 * mm
        self._dcard(LEFT, y - pain_h, CW, pain_h)
        py = y - 5 * mm
        self.c.setFillColor(RED)
        self.c.setFont("Helvetica-Bold", 7)
        self.c.drawString(LEFT + pad, py, "K E R N P R O B L E M E")
        py -= 8 * mm
        for p in self.d["pains"]:
            self.c.setFillColor(RED)
            self.c.setFont("Helvetica-Bold", 9)
            self.c.drawString(LEFT + pad, py, "✗")
            py = self._dw(p, LEFT + pad + 7 * mm, py,
                "Helvetica", 8.5, HexColor("#d1d5db"), CW - 2 * pad - 8 * mm, 4 * mm)
            py -= 2 * mm

        y -= pain_h + 10 * mm

        third = CW / 3 - 3 * mm
        bh = 20 * mm
        box_cy = y - bh / 2
        self._card(LEFT, y - bh, third, bh)
        self.c.setFillColor(MUTED)
        self.c.setFont("Helvetica-Bold", 6.5)
        self.c.drawCentredString(LEFT + third / 2, box_cy + 4 * mm, "I N P U T")
        self.c.setFillColor(BODY_TEXT)
        self.c.setFont("Helvetica", 8)
        self.c.drawCentredString(LEFT + third / 2, box_cy - 0.5 * mm, self.d["input_line1"])
        self.c.drawCentredString(LEFT + third / 2, box_cy - 4.5 * mm, self.d["input_line2"])
        px = LEFT + third + 4.5 * mm
        self._dcard(px, y - bh, third, bh)
        self.c.setFillColor(ACCENT)
        self.c.setFont("Helvetica-Bold", 6.5)
        self.c.drawCentredString(px + third / 2, box_cy + 4 * mm, "D A S   O F F E R")
        self.c.setFillColor(HexColor("#d1d5db"))
        self.c.setFont("Helvetica", 8)
        self.c.drawCentredString(px + third / 2, box_cy - 0.5 * mm, self.d["process_line1"])
        self.c.drawCentredString(px + third / 2, box_cy - 4.5 * mm, self.d["process_line2"])
        ox = LEFT + 2 * (third + 4.5 * mm)
        self._card(ox, y - bh, third, bh)
        self.c.setFillColor(MUTED)
        self.c.setFont("Helvetica-Bold", 6.5)
        self.c.drawCentredString(ox + third / 2, box_cy + 4 * mm, "O U T P U T")
        self.c.setFillColor(GREEN)
        self.c.setFont("Helvetica-Bold", 8.5)
        self.c.drawCentredString(ox + third / 2, box_cy - 0.5 * mm, self.d["output_result"])
        self.c.setFillColor(BODY_TEXT)
        self.c.setFont("Helvetica", 8)
        self.c.drawCentredString(ox + third / 2, box_cy - 4.5 * mm, self.d["output_sub"])

        y -= bh + 6 * mm

        ph = 15 * mm
        self._card(LEFT, y - ph, CW, ph, bg=HexColor("#eff6ff"))
        pcy = y - ph / 2
        self.c.setFillColor(ACCENT)
        self.c.setFont("Helvetica-Bold", 12)
        self.c.drawCentredString(WIDTH / 2, pcy + 1.5 * mm, self.d["promise_headline"])
        self.c.setFillColor(BODY_TEXT)
        self.c.setFont("Helvetica", 8.5)
        self.c.drawCentredString(WIDTH / 2, pcy - 5 * mm, self.d["promise_sub"])

        self._footer()
        self.c.showPage()

    def page_value_equation(self):
        self._bg(BG_WHITE)
        cs = self._hband("FRAMEWORK", "Die Wert-Gleichung",
            "„Wert = (Traumergebnis × Wahrscheinlichkeit) / (Zeit × Aufwand)“")
        y = cs - 12 * mm
        pad = 6 * mm

        eq_h = 14 * mm
        eq_cy = y - eq_h / 2
        self._dcard(LEFT, y - eq_h, CW, eq_h)
        self.c.setFillColor(WHITE)
        self.c.setFont("Helvetica-Bold", 10)
        self.c.drawCentredString(WIDTH / 2, eq_cy + 1.5 * mm,
            "Wert = (Traumergebnis × Wahrscheinlichkeit) / (Zeit × Aufwand)")
        self.c.setFillColor(ACCENT_LIGHT)
        self.c.setFont("Helvetica", 7.5)
        self.c.drawCentredString(WIDTH / 2, eq_cy - 4.5 * mm,
            "Zähler maximieren ↑  —  Nenner minimieren ↓  =  Preis wird irrelevant")
        y -= eq_h + 8 * mm

        half_w = CW / 2 - 3 * mm
        inner_qw = half_w - 2 * pad
        item_w = inner_qw - 5 * mm
        ms_val_w = inner_qw - 20 * mm

        def _q_height(text, items=None, milestones=None):
            h = 5.5 * mm
            h += 6 * mm
            h += 6 * mm
            text_lines = self._wrap(text, "Helvetica", 8, inner_qw)
            h += len(text_lines) * 3.8 * mm
            h += 2 * mm
            if items:
                for item in items:
                    il = max(1, len(self._wrap(item, "Helvetica", 7.5, item_w)))
                    h += il * 3.8 * mm
            if milestones:
                h += len(milestones) * 3.8 * mm
            h += 4 * mm
            return h

        def _q_card(x, yy, qh, color_tag, color, num, title, text, items=None, milestones=None):
            self._dcard(x, yy - qh, half_w, qh)
            qy = yy - 5.5 * mm
            self.c.setFillColor(color)
            self.c.setFont("Helvetica-Bold", 7)
            self.c.drawString(x + pad, qy, color_tag)
            qy -= 6 * mm
            self.c.setFillColor(WHITE)
            self.c.setFont("Helvetica-Bold", 10.5)
            self.c.drawString(x + pad, qy, f"{num}. {title}")
            qy -= 6 * mm
            qy = self._dw(text, x + pad, qy,
                "Helvetica", 8, HexColor("#d1d5db"), inner_qw, 3.8 * mm)
            qy -= 2 * mm
            if items:
                for item in items:
                    self.c.setFillColor(color)
                    self.c.setFont("Helvetica-Bold", 7.5)
                    self.c.drawString(x + pad, qy, "✓")
                    qy = self._dw(item, x + pad + 5 * mm, qy,
                        "Helvetica", 7.5, HexColor("#d1d5db"), item_w, 3.8 * mm)
            if milestones:
                for zeit, was in milestones:
                    self.c.setFillColor(ACCENT_LIGHT)
                    self.c.setFont("Helvetica-Bold", 7.5)
                    self.c.drawString(x + pad, qy, zeit)
                    self.c.setFillColor(HexColor("#d1d5db"))
                    self.c.setFont("Helvetica", 7.5)
                    self.c.drawString(x + pad + 20 * mm, qy, was)
                    qy -= 3.8 * mm

        qx2 = LEFT + half_w + 6 * mm

        q1_h = _q_height(self.d["dream_outcome"])
        q2_h = _q_height(self.d["likelihood_text"], items=self.d["likelihood_proof"])
        row1_h = max(q1_h, q2_h)

        _q_card(LEFT, y, row1_h, "↑  Z Ä H L E R", GREEN,
            1, "Das Traumergebnis", self.d["dream_outcome"])
        _q_card(qx2, y, row1_h, "↑  Z Ä H L E R", GREEN,
            2, "Wahrscheinlichkeit", self.d["likelihood_text"],
            items=self.d["likelihood_proof"])

        y -= row1_h + 5 * mm

        q3_h = _q_height(self.d["time_delay_text"], milestones=self.d["time_milestones"])
        q4_h = _q_height(self.d["effort_text"], items=self.d["effort_items"])
        row2_h = max(q3_h, q4_h)

        _q_card(LEFT, y, row2_h, "↓  N E N N E R", RED,
            3, "Zeitverzögerung", self.d["time_delay_text"],
            milestones=self.d["time_milestones"])
        _q_card(qx2, y, row2_h, "↓  N E N N E R", RED,
            4, "Aufwand & Opfer", self.d["effort_text"],
            items=self.d["effort_items"])

        y -= row2_h + 8 * mm

        sh = 12 * mm
        s_cy = y - sh / 2
        self._card(LEFT, y - sh, CW, sh, bg=HexColor("#eff6ff"))
        self.c.setFillColor(ACCENT)
        self.c.setFont("Helvetica-Bold", 9)
        self.c.drawCentredString(WIDTH / 2, s_cy + 1.5 * mm,
            "Ergebnis: " + self.d["dream_outcome_kurz"])
        self.c.setFillColor(BODY_TEXT)
        self.c.setFont("Helvetica", 7.5)
        self.c.drawCentredString(WIDTH / 2, s_cy - 4.5 * mm,
            "Hohe Wahrscheinlichkeit · Schnelle Ergebnisse · Minimaler Aufwand = Maximaler Wert")
        self._footer()
        self.c.showPage()

    def page_value_stack(self):
        self._bg(BG_WHITE)
        cs = self._hband("VALUE STACK", "Dein Value Stack",
            "„Jeder Baustein löst ein konkretes Hindernis.“")
        y = cs - 12 * mm
        pad = 6 * mm

        y = self._dw(self.d["value_stack_erklaerung"],
            LEFT, y, "Helvetica", 9, MUTED, CW, 4 * mm)
        y -= 8 * mm

        for i, (num, name, desc, val) in enumerate(self.d["value_stack"]):
            card_h = 16 * mm
            cy = y - card_h / 2
            self._card(LEFT, y - card_h, CW, card_h)
            self.c.setFillColor(ACCENT)
            self.c.roundRect(LEFT, y - card_h, 2.5 * mm, card_h, 1.5 * mm, fill=1, stroke=0)
            self.c.rect(LEFT + 1.5 * mm, y - card_h, 1.5 * mm, card_h, fill=1, stroke=0)
            self._badge_sm(num, LEFT + 7 * mm, cy, w=8 * mm)
            self.c.setFillColor(DARK_TEXT)
            self.c.setFont("Helvetica-Bold", 10.5)
            self.c.drawString(LEFT + 18 * mm, cy + 1.5 * mm, name)
            self.c.setFillColor(MUTED)
            self.c.setFont("Helvetica", 8.5)
            self.c.drawString(LEFT + 18 * mm, cy - 5.5 * mm, desc)
            self.c.setFillColor(ACCENT)
            self.c.setFont("Helvetica-Bold", 12)
            self.c.drawRightString(RIGHT - pad, cy + 1.5 * mm, val)
            self.c.setFillColor(MUTED)
            self.c.setFont("Helvetica", 7)
            self.c.drawRightString(RIGHT - pad, cy - 5.5 * mm, "Wert")
            y -= card_h + 4 * mm

        y -= 4 * mm

        gw_h = 18 * mm
        gw_cy = y - gw_h / 2
        self._dcard(LEFT, y - gw_h, CW, gw_h)
        self.c.setFillColor(ACCENT)
        self.c.setFont("Helvetica-Bold", 7)
        self.c.drawString(LEFT + pad, gw_cy + 3 * mm, "G E S A M T W E R T")
        self.c.setFillColor(WHITE)
        self.c.setFont("Helvetica-Bold", 13)
        self.c.drawString(LEFT + pad, gw_cy - 4 * mm, "Gesamtwert deines Angebots:")
        self.c.setFillColor(ACCENT)
        self.c.setFont("Helvetica-Bold", 22)
        self.c.drawRightString(RIGHT - pad, gw_cy - 4 * mm, self.d["gesamtwert"])

        y -= gw_h + 5 * mm
        self.c.setFillColor(MUTED)
        self.c.setFont("Helvetica", 8.5)
        self.c.drawString(LEFT, y,
            "Tipp: Nenne den Gesamtwert im Sales-Gespräch — dann den Preis. Der Kontrast verkauft.")
        self._footer()
        self.c.showPage()

    def page_pricing(self):
        self._bg(BG_WHITE)
        cs = self._hband("PRICING", "Preisgestaltung & Garantie",
            "„Der Preis ist nur ein Problem, wenn der Wert unklar ist.“")
        y = cs - 14 * mm
        pad = 6 * mm

        self.c.setFillColor(MUTED)
        self.c.setFont("Helvetica", 8.5)
        self.c.drawString(LEFT, y, "Zeige deinem Kunden die teuren Alternativen:")
        y -= 8 * mm
        for label, val in self.d["preisanker"]:
            ah = 12 * mm
            acy = y - ah / 2
            self._card(LEFT, y - ah, CW, ah)
            self.c.setFillColor(RED)
            self.c.roundRect(LEFT, y - ah, 2.5 * mm, ah, 1.5 * mm, fill=1, stroke=0)
            self.c.rect(LEFT + 1.5 * mm, y - ah, 1.5 * mm, ah, fill=1, stroke=0)
            self.c.setFillColor(BODY_TEXT)
            self.c.setFont("Helvetica", 9.5)
            self.c.drawString(LEFT + 7 * mm, acy - 1.5 * mm, label)
            self.c.setFillColor(MUTED)
            self.c.setFont("Helvetica-Bold", 10)
            self.c.drawRightString(RIGHT - pad, acy - 1.5 * mm, val)
            tw = self.c.stringWidth(val, "Helvetica-Bold", 10)
            self.c.setStrokeColor(RED)
            self.c.setLineWidth(1.5)
            self.c.line(RIGHT - pad - tw - 2 * mm, acy + 1 * mm,
                        RIGHT - pad + 2 * mm, acy + 1 * mm)
            y -= ah + 4 * mm

        y -= 4 * mm

        preis_h = 28 * mm
        self._card(LEFT, y - preis_h, CW, preis_h, bg=HexColor("#eff6ff"))
        py = y - 5 * mm
        self.c.setFillColor(ACCENT)
        self.c.setFont("Helvetica-Bold", 7)
        self.c.drawString(LEFT + pad, py, "E M P F O H L E N E R   P R E I S")
        py -= 10 * mm
        self.c.setFillColor(ACCENT)
        self.c.setFont("Helvetica-Bold", 26)
        self.c.drawString(LEFT + pad, py, self.d["preis_range"])
        py -= 6 * mm
        self.c.setFillColor(MUTED)
        self.c.setFont("Helvetica", 8)
        self.c.drawString(LEFT + pad, py, self.d["preis_hinweis"])

        y -= preis_h + 4 * mm

        rh = 12 * mm
        rcy = y - rh / 2
        self._card(LEFT, y - rh, CW, rh)
        self.c.setFillColor(GREEN)
        self.c.roundRect(LEFT, y - rh, 2.5 * mm, rh, 1.5 * mm, fill=1, stroke=0)
        self.c.rect(LEFT + 1.5 * mm, y - rh, 1.5 * mm, rh, fill=1, stroke=0)
        self.c.setFillColor(DARK_TEXT)
        self.c.setFont("Helvetica-Bold", 9)
        self.c.drawString(LEFT + 7 * mm, rcy + 1.5 * mm, "ROI-Argument:")
        self.c.setFillColor(BODY_TEXT)
        self.c.setFont("Helvetica", 8.5)
        self.c.drawString(LEFT + 7 * mm, rcy - 4.5 * mm, self.d["roi_rechnung"])
        self.c.setFillColor(GREEN)
        self.c.setFont("Helvetica-Bold", 10)
        self.c.drawRightString(RIGHT - pad, rcy - 1.5 * mm, self.d["roi_ergebnis"])

        y -= rh + 10 * mm

        gar_lines = self._wrap(self.d["garantie_erklaerung"], "Helvetica", 8.5, CW - 2 * pad)
        gar_h = len(gar_lines) * 3.8 * mm + 40 * mm + len(self.d["garantie_vorteile"]) * 4.5 * mm
        self._dcard(LEFT, y - gar_h, CW, gar_h)
        gy = y - 5 * mm
        self.c.setFillColor(GREEN)
        self.c.setFont("Helvetica-Bold", 7)
        self.c.drawString(LEFT + pad, gy, "D E I N E   G A R A N T I E")
        gy -= 8 * mm
        self.c.setFillColor(WHITE)
        self.c.setFont("Helvetica-Bold", 12)
        self.c.drawString(LEFT + pad, gy, self.d["garantie_name"])
        gy -= 8 * mm
        self.c.setFillColor(ACCENT_LIGHT)
        self.c.setFont("Helvetica-Oblique", 9)
        self.c.drawString(LEFT + pad, gy, self.d["garantie_zeile1"])
        gy -= 5 * mm
        self.c.drawString(LEFT + pad, gy, self.d["garantie_zeile2"])
        gy -= 8 * mm
        gy = self._dw(self.d["garantie_erklaerung"], LEFT + pad, gy,
            "Helvetica", 8.5, HexColor("#9ca3af"), CW - 2 * pad, 3.8 * mm)
        gy -= 3 * mm
        for tip in self.d["garantie_vorteile"]:
            self.c.setFillColor(GREEN)
            self.c.setFont("Helvetica-Bold", 8)
            self.c.drawString(LEFT + pad, gy, "✓")
            self.c.setFillColor(HexColor("#d1d5db"))
            self.c.setFont("Helvetica", 8)
            self.c.drawString(LEFT + pad + 6 * mm, gy, tip)
            gy -= 4.5 * mm

        self._footer()
        self.c.showPage()

    def page_verstaerker(self):
        self._bg(BG_WHITE)
        cs = self._hband("PSYCHOLOGIE", "Psychologische Verstärker",
            "„Die letzten 3 Hebel, die aus Interesse Kaufentscheidungen machen.“")
        y = cs - 14 * mm
        pad = 6 * mm
        inner_w = CW - 2 * pad

        half_w = CW / 2 - 3 * mm

        sc_lines = self._wrap(self.d["scarcity"], "Helvetica", 8.5, half_w - 2 * pad)
        ur_lines = self._wrap(self.d["urgency"], "Helvetica", 8.5, half_w - 2 * pad)
        card_text_h = max(len(sc_lines), len(ur_lines)) * 4 * mm
        card_h = card_text_h + 18 * mm

        self._dcard(LEFT, y - card_h, half_w, card_h)
        sy = y - 5 * mm
        self.c.setFillColor(ORANGE)
        self.c.setFont("Helvetica-Bold", 7)
        self.c.drawString(LEFT + pad, sy, "S C A R C I T Y")
        sy -= 7 * mm
        self.c.setFillColor(WHITE)
        self.c.setFont("Helvetica-Bold", 11)
        self.c.drawString(LEFT + pad, sy, "Verknappung")
        sy -= 7 * mm
        self._dw(self.d["scarcity"], LEFT + pad, sy,
            "Helvetica", 8.5, HexColor("#d1d5db"), half_w - 2 * pad, 4 * mm)

        ux = LEFT + half_w + 6 * mm
        self._dcard(ux, y - card_h, half_w, card_h)
        uy = y - 5 * mm
        self.c.setFillColor(RED)
        self.c.setFont("Helvetica-Bold", 7)
        self.c.drawString(ux + pad, uy, "U R G E N C Y")
        uy -= 7 * mm
        self.c.setFillColor(WHITE)
        self.c.setFont("Helvetica-Bold", 11)
        self.c.drawString(ux + pad, uy, "Dringlichkeit")
        uy -= 7 * mm
        self._dw(self.d["urgency"], ux + pad, uy,
            "Helvetica", 8.5, HexColor("#d1d5db"), half_w - 2 * pad, 4 * mm)

        y -= card_h + 12 * mm

        self._sl("BONUSES (BONI)", y)
        y -= 9 * mm
        self.c.setFillColor(MUTED)
        self.c.setFont("Helvetica", 9)
        self.c.drawString(LEFT, y, "Anstatt den Preis zu senken — stapelst du Boni oben drauf:")
        y -= 10 * mm

        for bname, bdesc, bval in self.d["bonuses"]:
            bh = 18 * mm
            bcy = y - bh / 2
            self._card(LEFT, y - bh, CW, bh)
            self.c.setFillColor(GREEN)
            self.c.roundRect(LEFT, y - bh, 2.5 * mm, bh, 1.5 * mm, fill=1, stroke=0)
            self.c.rect(LEFT + 1.5 * mm, y - bh, 1.5 * mm, bh, fill=1, stroke=0)
            self.c.setFillColor(DARK_TEXT)
            self.c.setFont("Helvetica-Bold", 11)
            self.c.drawString(LEFT + 8 * mm, bcy + 2 * mm, bname)
            self.c.setFillColor(MUTED)
            self.c.setFont("Helvetica", 9)
            self.c.drawString(LEFT + 8 * mm, bcy - 5 * mm, bdesc)
            self.c.setFillColor(ACCENT)
            self.c.setFont("Helvetica-Bold", 12)
            self.c.drawRightString(RIGHT - 6 * mm, bcy + 2 * mm, bval)
            self.c.setFillColor(MUTED)
            self.c.setFont("Helvetica", 7)
            self.c.drawRightString(RIGHT - 6 * mm, bcy - 5 * mm, "Wert")
            y -= bh + 5 * mm

        y -= 5 * mm
        hint_h = 12 * mm
        hcy = y - hint_h / 2
        self._card(LEFT, y - hint_h, CW, hint_h, bg=HexColor("#eff6ff"))
        self.c.setFillColor(ACCENT)
        self.c.setFont("Helvetica-Bold", 9)
        self.c.drawCentredString(WIDTH / 2, hcy + 1.5 * mm,
            "Scarcity + Urgency + Bonuses = Kaufentscheidung JETZT")
        self.c.setFillColor(BODY_TEXT)
        self.c.setFont("Helvetica", 7.5)
        self.c.drawCentredString(WIDTH / 2, hcy - 4.5 * mm,
            "Diese 3 Hebel machen aus „Ich überlege noch“ ein „Wo muss ich unterschreiben?“")

        self._footer()
        self.c.showPage()

    def page_varianten(self):
        self._bg(BG_WHITE)
        cs = self._hband("3 FORMULIERUNGEN", "Dein Offer — 3x fertig formuliert",
            "„3 komplett ausformulierte Angebote. Wähle das stärkste für deine Zielgruppe.“")
        y = cs - 10 * mm

        varianten = self.d["offer_varianten"]
        var_gap = 6 * mm
        pad = 6 * mm
        inner_w = CW - 2 * pad

        for idx, v in enumerate(varianten):
            is_hl = v.get("highlight", False)

            badge_w = 7 * mm
            badge_h = 5.5 * mm
            self.c.setFillColor(ACCENT)
            self.c.roundRect(LEFT, y - badge_h / 2, badge_w, badge_h, 2.5 * mm, fill=1, stroke=0)
            self.c.setFillColor(WHITE)
            self.c.setFont("Helvetica-Bold", 7.5)
            self.c.drawCentredString(LEFT + badge_w / 2, y - 1.1 * mm, f"{idx + 1}")
            self.c.setFillColor(DARK_TEXT)
            self.c.setFont("Helvetica-Bold", 10)
            self.c.drawString(LEFT + badge_w + 3 * mm, y - 1.5 * mm, v["name"])

            if is_hl:
                self.c.setFillColor(GREEN)
                self.c.setFont("Helvetica-Bold", 6)
                self.c.drawRightString(RIGHT, y - 1.5 * mm,
                    "★  E M P F O H L E N")

            y -= 9 * mm

            kurz_lines = self._wrap(v["kurz"], "Helvetica-Bold", 8.5, inner_w)
            kurz_h = len(kurz_lines) * 4 * mm + 8 * mm

            if is_hl:
                self.c.setStrokeColor(ACCENT)
                self.c.setLineWidth(1.5)
                self.c.setFillColor(DARK_CARD)
                self.c.roundRect(LEFT, y - kurz_h, CW, kurz_h, 3 * mm, fill=1, stroke=1)
            else:
                self._dcard(LEFT, y - kurz_h, CW, kurz_h)

            ky = y - 4.5 * mm
            self.c.setFillColor(ACCENT)
            self.c.setFont("Helvetica-Bold", 6.5)
            self.c.drawString(LEFT + pad, ky, "K U R Z - V E R S I O N")
            ky -= 5 * mm
            self._dw(v["kurz"], LEFT + pad, ky,
                "Helvetica-Bold", 8.5, HexColor("#e5e7eb"), inner_w, 4 * mm)

            y -= kurz_h + 3 * mm

            lang_lines = self._wrap(v["lang"], "Helvetica", 8, inner_w)
            lang_h = len(lang_lines) * 3.8 * mm + 8 * mm

            if is_hl:
                self.c.setStrokeColor(ACCENT)
                self.c.setLineWidth(1.5)
                self.c.setFillColor(DARK_CARD)
                self.c.roundRect(LEFT, y - lang_h, CW, lang_h, 3 * mm, fill=1, stroke=1)
            else:
                self._dcard(LEFT, y - lang_h, CW, lang_h)

            ly = y - 4.5 * mm
            self.c.setFillColor(ACCENT)
            self.c.setFont("Helvetica-Bold", 6.5)
            self.c.drawString(LEFT + pad, ly, "L A N G - V E R S I O N")
            ly -= 5 * mm
            self._dw(v["lang"], LEFT + pad, ly,
                "Helvetica", 8, HexColor("#d1d5db"), inner_w, 3.8 * mm)

            y -= lang_h + var_gap

        self._footer()
        self.c.showPage()

    def build(self):
        self.page_cover()
        self.page_zielgruppe()
        self.page_value_equation()
        self.page_value_stack()
        self.page_pricing()
        self.page_verstaerker()
        self.page_varianten()
        self.c.save()
        print("PDF erstellt: " + self.filename)


if __name__ == "__main__":
    out = "/Users/alexandergoldmann/Desktop/agency-core-os/offers/offer-webdesign-no-performance-v7.pdf"
    OfferPDF(out, data).build()
