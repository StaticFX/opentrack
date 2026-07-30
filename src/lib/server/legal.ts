import type { ImpressumConfig } from '$lib/server/config';

export type Lang = 'de' | 'en';

/** Normalise an untrusted `?lang` value to a supported language (default English). */
export function resolveLang(raw: string | null | undefined): Lang {
	return raw === 'de' ? 'de' : 'en';
}

function hostOf(origin: string): string {
	try {
		return new URL(origin).host;
	} catch {
		return origin;
	}
}

function controllerBlock(imp: ImpressumConfig, lang: Lang): string {
	const providerFallback =
		lang === 'de'
			? '[Name des Betreibers — im Impressum eintragen]'
			: '[Operator name — set in the legal notice]';
	const emailFallback =
		lang === 'de'
			? '[Kontakt-E-Mail — im Impressum eintragen]'
			: '[Contact e-mail — set in the legal notice]';
	const addressFallback =
		lang === 'de' ? '[Anschrift — im Impressum eintragen]' : '[Address — set in the legal notice]';

	const provider = imp.provider.trim() || providerFallback;
	const email = imp.email.trim() || emailFallback;
	const addressLines = imp.address.trim()
		? imp.address
				.trim()
				.split('\n')
				.map((l) => l.trim())
				.filter(Boolean)
		: [addressFallback];
	return [provider, ...addressLines, `E-Mail: ${email}`].join('  \n');
}

/**
 * Build a GDPR privacy-policy template that accurately describes what an
 * OpenTrack instance actually processes (server logs, strictly-necessary
 * cookies, accounts, OAuth, GitHub sync, opt-in web push, third-country
 * transfers). Available in German (`de`) and English (`en`).
 *
 * It is a starting point the operator MUST review — it is not legal advice.
 * When the stored policy for a language is blank, this template is rendered
 * as-is on `/datenschutz`; the admin editor also seeds its textareas from it.
 */
export function buildPrivacyPolicy(
	imp: ImpressumConfig,
	opts: { origin: string; siteName: string },
	lang: Lang
): string {
	const host = hostOf(opts.origin);
	const controller = controllerBlock(imp, lang);
	const email = imp.email.trim() || (lang === 'de' ? '[Kontakt-E-Mail]' : '[Contact e-mail]');

	return lang === 'de'
		? germanTemplate(host, controller, email)
		: englishTemplate(host, controller, email);
}

/** German privacy-policy template (legally authoritative for DE compliance). */
function germanTemplate(host: string, controller: string, email: string): string {
	return `# Datenschutzerklärung

## 1. Verantwortlicher

Verantwortlich für die Datenverarbeitung auf dieser Website (${host}) im Sinne der
Datenschutz-Grundverordnung (DSGVO) ist:

${controller}

Weitere Angaben findest du im [Impressum](/impressum).

## 2. Allgemeines zur Datenverarbeitung

Wir verarbeiten personenbezogene Daten nur, soweit dies zur Bereitstellung einer
funktionsfähigen Website sowie unserer Inhalte und Leistungen erforderlich ist.
Rechtsgrundlagen sind insbesondere Art. 6 Abs. 1 lit. a (Einwilligung),
lit. b (Vertrag/Nutzungsverhältnis) und lit. f DSGVO (berechtigtes Interesse am
sicheren, funktionsfähigen Betrieb).

## 3. Hosting und Server-Logfiles

Beim Aufruf dieser Website werden durch den Browser automatisch Informationen an
den Server gesendet und vorübergehend in sogenannten Logfiles gespeichert:

- IP-Adresse des anfragenden Geräts,
- Datum und Uhrzeit des Zugriffs,
- aufgerufene Adresse (URL) und HTTP-Statuscode,
- übertragene Datenmenge, Referrer und verwendeter Browser (User-Agent).

Diese Daten dienen der Auslieferung der Seite, der Systemsicherheit und der
Stabilität. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Die Logfiles werden
gelöscht, sobald sie für den genannten Zweck nicht mehr erforderlich sind.

> Hinweis: Wird die Seite über einen vorgeschalteten Dienst (z. B. ein
> Content-Delivery-Network wie Cloudflare) ausgeliefert, ergänze hier den
> jeweiligen Auftragsverarbeiter und dessen Datenschutzhinweise.

## 4. Cookies

Diese Website verwendet ausschließlich **technisch notwendige Cookies**. Sie sind
für den Betrieb erforderlich, dienen nicht der Analyse oder Werbung und werden
nicht an Dritte zu Marketingzwecken weitergegeben. Rechtsgrundlage ist
§ 25 Abs. 2 TTDSG in Verbindung mit Art. 6 Abs. 1 lit. f DSGVO.

| Cookie | Zweck | Speicherdauer |
| --- | --- | --- |
| \`ot_session\` | Anmeldung / Sitzungsverwaltung eingeloggter Nutzer | Sitzung |
| \`ot_2fa_pending\` | Zwischenschritt der Zwei-Faktor-Anmeldung | wenige Minuten |
| \`ot_oauth_state\`, \`ot_oauth_redirect\`, \`ot_oauth_link\` | Absicherung des Logins über Drittanbieter (OAuth) | wenige Minuten |
| \`ot_anon\` | Missbrauchsschutz bei anonymen Abstimmungen (Zufalls-ID, mit der IP verkettet und als HMAC gespeichert — keine Klaridentität) | bis zu 12 Monate |

Ein Cookie-Hinweis informiert dich beim ersten Besuch. Da ausschließlich
notwendige Cookies gesetzt werden, ist keine Einwilligung erforderlich.

## 5. Nutzerkonto und Anmeldung

Legst du ein Konto an oder meldest dich an, verarbeiten wir die dabei angegebenen
Daten (Benutzername, Anzeigename, ggf. E-Mail-Adresse, ein sicher gehashtes
Passwort sowie optional eine Zwei-Faktor-Konfiguration). Zweck ist die
Bereitstellung des Kontos und der zugehörigen Funktionen. Rechtsgrundlage ist
Art. 6 Abs. 1 lit. b DSGVO. Die Daten werden gespeichert, bis du dein Konto
löschst oder die Löschung verlangst.

## 6. Anmeldung über Drittanbieter (OAuth)

Optional kannst du dich über externe Anbieter (z. B. GitHub, Discord, Modrinth
oder weitere vom Betreiber eingerichtete Dienste) anmelden. Dabei werden Daten
zwischen dir und dem jeweiligen Anbieter ausgetauscht; wir erhalten die zur
Anmeldung notwendigen Profilangaben (etwa Kennung, Anzeigename und ggf.
E-Mail-Adresse). Es gelten zusätzlich die Datenschutzhinweise des jeweiligen
Anbieters. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b bzw. lit. a DSGVO.

## 7. Öffentliche Beiträge (Kommentare, Vorschläge, Abstimmungen)

Beiträge wie Kommentare und Vorschläge sind öffentlich sichtbar und werden mit
deinem Anzeigenamen dargestellt. Abstimmungen sind angemeldet oder anonym
möglich; anonyme Stimmen werden ausschließlich zum Schutz vor Mehrfachabstimmung
über den unter Ziffer 4 beschriebenen, nicht personenbeziehbaren Schlüssel
verarbeitet. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b bzw. lit. f DSGVO.

## 8. Synchronisation mit GitHub

Ist ein Projekt mit GitHub verbunden, werden Vorgänge (Tickets) und Kommentare
mit dem verknüpften GitHub-Repository synchronisiert und dorthin übertragen.
Anbieter ist die GitHub, Inc. Es gelten ergänzend deren Datenschutzhinweise.
Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO.

## 9. Push-Benachrichtigungen

Nur wenn du dies ausdrücklich im Browser aktivierst, versenden wir
Push-Benachrichtigungen. Hierzu wird ein vom Browser bereitgestellter Endpunkt
gespeichert. Du kannst die Benachrichtigungen jederzeit im Browser oder in deinen
Kontoeinstellungen wieder deaktivieren. Rechtsgrundlage ist Art. 6 Abs. 1 lit. a
DSGVO (Einwilligung).

## 10. Weitergabe von Daten

Eine Übermittlung deiner Daten an Dritte findet nur statt, soweit dies für den
Betrieb erforderlich ist (z. B. an den Hosting-Dienstleister als
Auftragsverarbeiter), du eingewilligt hast (z. B. OAuth, GitHub-Sync) oder wir
gesetzlich dazu verpflichtet sind.

## 11. Übermittlung in Drittländer

Soweit du dich über einen Anbieter mit Sitz außerhalb der EU/des EWR anmeldest
(z. B. GitHub oder Discord in den USA) oder ein Projekt mit GitHub verbunden ist,
können personenbezogene Daten in ein Drittland — insbesondere die USA —
übermittelt werden. Eine solche Übermittlung erfolgt nur auf Grundlage eines
Angemessenheitsbeschlusses der EU-Kommission (z. B. EU-US Data Privacy Framework,
sofern der Empfänger zertifiziert ist) oder geeigneter Garantien im Sinne des
Art. 46 DSGVO (insbesondere Standardvertragsklauseln). Eine Kopie der Garantien
kann beim Verantwortlichen angefordert werden.

> Hinweis: Ergänze hier, auf welcher Grundlage (Data-Privacy-Framework-Zertifizierung
> des jeweiligen Anbieters oder Standardvertragsklauseln) die Übermittlung im
> konkreten Fall erfolgt.

## 12. Speicherdauer

Wir verarbeiten personenbezogene Daten nur so lange, wie es für die jeweiligen
Zwecke erforderlich ist oder gesetzliche Aufbewahrungspflichten bestehen.
Anschließend werden die Daten gelöscht.

## 13. Deine Rechte

Dir stehen gegenüber dem Verantwortlichen folgende Rechte hinsichtlich deiner
personenbezogenen Daten zu:

- Auskunft (Art. 15 DSGVO),
- Berichtigung (Art. 16 DSGVO),
- Löschung (Art. 17 DSGVO),
- Einschränkung der Verarbeitung (Art. 18 DSGVO),
- Datenübertragbarkeit (Art. 20 DSGVO),
- Widerspruch gegen die Verarbeitung (Art. 21 DSGVO) sowie
- Widerruf einer erteilten Einwilligung mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO).

Zur Ausübung genügt eine formlose Nachricht an ${email}.

## 14. Beschwerderecht bei einer Aufsichtsbehörde

Unbeschadet anderweitiger Rechtsbehelfe steht dir ein Beschwerderecht bei einer
Datenschutz-Aufsichtsbehörde zu, insbesondere in dem Mitgliedstaat deines
Aufenthalts, deines Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes.

## 15. Kontakt

Bei Fragen zum Datenschutz erreichst du uns unter ${email}.

_Diese Datenschutzerklärung ist eine Vorlage und vom Betreiber vor
Veröffentlichung zu prüfen und anzupassen. Sie stellt keine Rechtsberatung dar._
`;
}

/** English translation of the privacy-policy template. */
function englishTemplate(host: string, controller: string, email: string): string {
	return `# Privacy Policy

## 1. Controller

The controller responsible for data processing on this website (${host}) within
the meaning of the General Data Protection Regulation (GDPR) is:

${controller}

Further details can be found in the [legal notice](/impressum?lang=en).

## 2. General information on data processing

We process personal data only to the extent necessary to provide a functional
website together with our content and services. The legal bases are in particular
Art. 6(1)(a) (consent), (b) (contract/usage relationship) and (f) GDPR
(legitimate interest in secure, functional operation).

## 3. Hosting and server log files

When you access this website, your browser automatically transmits information to
the server, which is temporarily stored in so-called log files:

- the IP address of the requesting device,
- the date and time of access,
- the requested address (URL) and HTTP status code,
- the amount of data transferred, the referrer and the browser used (user agent).

This data is used to deliver the page and to ensure system security and
stability. The legal basis is Art. 6(1)(f) GDPR. The log files are deleted as
soon as they are no longer required for the stated purpose.

> Note: If the site is delivered via an upstream service (e.g. a content delivery
> network such as Cloudflare), add the respective processor and its privacy
> information here.

## 4. Cookies

This website uses **strictly necessary cookies only**. They are required for
operation, are not used for analytics or advertising, and are not shared with
third parties for marketing purposes. The legal basis is § 25(2) TTDSG in
conjunction with Art. 6(1)(f) GDPR.

| Cookie | Purpose | Storage period |
| --- | --- | --- |
| \`ot_session\` | Sign-in / session management for logged-in users | Session |
| \`ot_2fa_pending\` | Intermediate step of two-factor sign-in | A few minutes |
| \`ot_oauth_state\`, \`ot_oauth_redirect\`, \`ot_oauth_link\` | Securing sign-in via third-party providers (OAuth) | A few minutes |
| \`ot_anon\` | Abuse prevention for anonymous votes (a random id combined with the IP and stored as an HMAC — not a clear identity) | Up to 12 months |

A cookie notice informs you on your first visit. As only necessary cookies are
set, no consent is required.

## 5. User account and sign-in

If you create an account or sign in, we process the data you provide (username,
display name, optionally an e-mail address, a securely hashed password and,
optionally, a two-factor configuration). The purpose is to provide the account
and its associated features. The legal basis is Art. 6(1)(b) GDPR. The data is
stored until you delete your account or request its deletion.

## 6. Sign-in via third-party providers (OAuth)

Optionally, you can sign in via external providers (e.g. GitHub, Discord,
Modrinth or other services configured by the operator). In doing so, data is
exchanged between you and the respective provider; we receive the profile
information required for sign-in (such as an identifier, display name and,
where applicable, an e-mail address). The privacy notices of the respective
provider apply in addition. The legal basis is Art. 6(1)(b) or (a) GDPR.

## 7. Public contributions (comments, suggestions, votes)

Contributions such as comments and suggestions are publicly visible and shown
with your display name. Votes can be cast while signed in or anonymously;
anonymous votes are processed solely to prevent duplicate voting, using the
non-identifiable key described in section 4. The legal basis is Art. 6(1)(b)
or (f) GDPR.

## 8. Synchronisation with GitHub

If a project is connected to GitHub, items (tickets) and comments are
synchronised with, and transferred to, the linked GitHub repository. The provider
is GitHub, Inc. Its privacy notices apply in addition. The legal basis is
Art. 6(1)(f) GDPR.

## 9. Push notifications

Only if you explicitly enable this in your browser do we send push notifications.
For this purpose, an endpoint provided by your browser is stored. You can disable
notifications at any time in your browser or in your account settings. The legal
basis is Art. 6(1)(a) GDPR (consent).

## 10. Disclosure of data

Your data is disclosed to third parties only where this is necessary for
operation (e.g. to the hosting provider as a processor), where you have consented
(e.g. OAuth, GitHub sync), or where we are legally obliged to do so.

## 11. Transfers to third countries

Where you sign in via a provider based outside the EU/EEA (e.g. GitHub or Discord
in the USA), or where a project is connected to GitHub, personal data may be
transferred to a third country — in particular the USA. Any such transfer takes
place only on the basis of an adequacy decision of the EU Commission (e.g. the
EU-US Data Privacy Framework, where the recipient is certified) or appropriate
safeguards within the meaning of Art. 46 GDPR (in particular standard contractual
clauses). A copy of the safeguards can be requested from the controller.

> Note: Add here the basis on which the transfer takes place in the specific case
> (the provider's Data Privacy Framework certification or standard contractual
> clauses).

## 12. Storage period

We process personal data only for as long as necessary for the respective
purposes or as required by statutory retention obligations. The data is deleted
thereafter.

## 13. Your rights

You have the following rights regarding your personal data vis-à-vis the
controller:

- access (Art. 15 GDPR),
- rectification (Art. 16 GDPR),
- erasure (Art. 17 GDPR),
- restriction of processing (Art. 18 GDPR),
- data portability (Art. 20 GDPR),
- objection to processing (Art. 21 GDPR), and
- withdrawal of a given consent with effect for the future (Art. 7(3) GDPR).

To exercise them, an informal message to ${email} is sufficient.

## 14. Right to lodge a complaint with a supervisory authority

Without prejudice to any other remedy, you have the right to lodge a complaint
with a data protection supervisory authority, in particular in the Member State
of your residence, place of work or the place of the alleged infringement.

## 15. Contact

For questions about data protection, you can reach us at ${email}.

_This privacy policy is a template and must be reviewed and adapted by the
operator before publication. It does not constitute legal advice._
`;
}
